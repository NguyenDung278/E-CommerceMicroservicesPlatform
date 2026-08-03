package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

// ErrStockAdjustmentWouldGoNegative is returned when an outbound adjustment asks
// for more units than the pool holds. Stock is a physical count, so letting it
// go negative would quietly corrupt every oversell guard built on top of it.
var ErrStockAdjustmentWouldGoNegative = errors.New("stock adjustment would drive stock negative")

// AdjustStock applies one manual stock movement and records it in the ledger
// inside a single transaction.
//
// It takes the same `SELECT ... FOR UPDATE` row lock as ReserveStockForOrder,
// and that is the whole point: receiving goods and holding stock for a checkout
// both mutate the same counters, so they must serialize against each other. A
// blind `stock = stock + $1` would not — it would race with a concurrent
// reservation reading a stale count.
//
// Returns the persisted ledger row. When idempotencyKey is non-empty and was
// already used, the earlier row is returned unchanged and stock is left alone.
func (r *postgresProductRepository) AdjustStock(
	ctx context.Context,
	adjustment *model.StockAdjustment,
) (*model.StockAdjustment, error) {
	if adjustment.IdempotencyKey != "" {
		existing, err := r.findStockAdjustmentByKey(ctx, adjustment.IdempotencyKey)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return existing, nil
		}
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin stock adjustment transaction: %w", err)
	}
	defer tx.Rollback()

	locked, err := lockProductStock(ctx, tx, adjustment.ProductID)
	if err != nil {
		return nil, err
	}

	resultingStock, err := applyAdjustmentToPool(ctx, tx, locked, adjustment)
	if err != nil {
		return nil, err
	}
	adjustment.ResultingStock = resultingStock

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO stock_adjustments (
			id, product_id, sku, delta, resulting_stock, reason, note,
			actor_id, actor_role, idempotency_key, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`,
		adjustment.ID,
		adjustment.ProductID,
		adjustment.SKU,
		adjustment.Delta,
		adjustment.ResultingStock,
		string(adjustment.Reason),
		adjustment.Note,
		adjustment.ActorID,
		adjustment.ActorRole,
		adjustment.IdempotencyKey,
		adjustment.CreatedAt,
	); err != nil {
		// Một request trùng key vừa commit trước; unique index biến nó thành
		// replay chứ không phải lỗi.
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" && adjustment.IdempotencyKey != "" {
			existing, findErr := r.findStockAdjustmentByKey(ctx, adjustment.IdempotencyKey)
			if findErr != nil {
				return nil, findErr
			}
			if existing != nil {
				return existing, nil
			}
		}
		return nil, fmt.Errorf("failed to insert stock adjustment: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit stock adjustment: %w", err)
	}
	return adjustment, nil
}

// applyAdjustmentToPool moves the counter the adjustment targets and returns the
// resulting stock of that pool.
func applyAdjustmentToPool(
	ctx context.Context,
	tx *sql.Tx,
	locked productStockRow,
	adjustment *model.StockAdjustment,
) (int, error) {
	if adjustment.SKU == "" {
		if len(locked.variants) > 0 {
			return 0, fmt.Errorf("%w: product %s", ErrProductVariantRequired, adjustment.ProductID)
		}
		resulting := locked.stock + adjustment.Delta
		if resulting < 0 {
			return 0, fmt.Errorf("%w: product %s has %d", ErrStockAdjustmentWouldGoNegative, adjustment.ProductID, locked.stock)
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2`,
			resulting, adjustment.ProductID,
		); err != nil {
			return 0, fmt.Errorf("failed to adjust stock for product %s: %w", adjustment.ProductID, err)
		}
		return resulting, nil
	}

	index := model.FindVariantIndex(locked.variants, adjustment.SKU)
	if index < 0 {
		return 0, fmt.Errorf("%w: product %s sku %s", ErrProductVariantNotFound, adjustment.ProductID, adjustment.SKU)
	}

	resulting := locked.variants[index].Stock + adjustment.Delta
	if resulting < 0 {
		return 0, fmt.Errorf("%w: product %s sku %s has %d",
			ErrStockAdjustmentWouldGoNegative, adjustment.ProductID, adjustment.SKU, locked.variants[index].Stock)
	}

	if err := writeVariantStock(ctx, tx, adjustment.ProductID, index, resulting, adjustment.Delta); err != nil {
		return 0, err
	}
	return resulting, nil
}

// ListStockAdjustments returns the ledger of one product, newest first.
func (r *postgresProductRepository) ListStockAdjustments(
	ctx context.Context,
	productID string,
	limit int,
) ([]*model.StockAdjustment, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, product_id, sku, delta, resulting_stock, reason, note,
		       actor_id, actor_role, created_at
		FROM stock_adjustments
		WHERE product_id = $1
		ORDER BY created_at DESC, id DESC
		LIMIT $2
	`, productID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list stock adjustments: %w", err)
	}
	defer rows.Close()

	adjustments := make([]*model.StockAdjustment, 0, limit)
	for rows.Next() {
		adjustment, err := scanStockAdjustment(rows)
		if err != nil {
			return nil, err
		}
		adjustments = append(adjustments, adjustment)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate stock adjustments: %w", err)
	}
	return adjustments, nil
}

func (r *postgresProductRepository) findStockAdjustmentByKey(
	ctx context.Context,
	idempotencyKey string,
) (*model.StockAdjustment, error) {
	adjustment, err := scanStockAdjustment(r.db.QueryRowContext(ctx, `
		SELECT id, product_id, sku, delta, resulting_stock, reason, note,
		       actor_id, actor_role, created_at
		FROM stock_adjustments
		WHERE idempotency_key = $1
	`, idempotencyKey))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	adjustment.IdempotencyKey = idempotencyKey
	return adjustment, nil
}

type stockAdjustmentScanner interface {
	Scan(dest ...any) error
}

func scanStockAdjustment(scanner stockAdjustmentScanner) (*model.StockAdjustment, error) {
	var (
		adjustment model.StockAdjustment
		reason     string
		createdAt  time.Time
	)
	if err := scanner.Scan(
		&adjustment.ID,
		&adjustment.ProductID,
		&adjustment.SKU,
		&adjustment.Delta,
		&adjustment.ResultingStock,
		&reason,
		&adjustment.Note,
		&adjustment.ActorID,
		&adjustment.ActorRole,
		&createdAt,
	); err != nil {
		return nil, err
	}
	adjustment.Reason = model.StockAdjustmentReason(reason)
	adjustment.CreatedAt = createdAt
	return &adjustment, nil
}
