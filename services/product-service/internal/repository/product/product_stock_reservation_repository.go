package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

// ErrProductNotFound is returned by reservation writes when a referenced
// product row does not exist.
var ErrProductNotFound = errors.New("product not found")

// ReserveStockForOrder reserves stock for every item of one order inside a
// single transaction: either every line item is ledgered and decremented, or
// nothing changes. The compare-and-set predicate `stock >= quantity` stays the
// oversell guard; the ledger row makes the whole reservation idempotent per
// order_id.
//
// Returns replayed=true when the order already holds a reservation, in which
// case stock is left untouched.
func (r *postgresProductRepository) ReserveStockForOrder(
	ctx context.Context,
	orderID string,
	items []model.StockReservationItem,
) (bool, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return false, fmt.Errorf("failed to begin stock reservation transaction: %w", err)
	}
	defer tx.Rollback()

	var existing int
	if err := tx.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM stock_reservations WHERE order_id = $1`,
		orderID,
	).Scan(&existing); err != nil {
		return false, fmt.Errorf("failed to check existing stock reservation: %w", err)
	}
	if existing > 0 {
		if err := tx.Commit(); err != nil {
			return false, fmt.Errorf("failed to commit replayed stock reservation: %w", err)
		}
		return true, nil
	}

	// Locking rows in a stable order prevents deadlocks between two orders that
	// share products but list them differently.
	sorted := make([]model.StockReservationItem, len(items))
	copy(sorted, items)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].ProductID < sorted[j].ProductID })

	for _, item := range sorted {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO stock_reservations (order_id, product_id, quantity) VALUES ($1, $2, $3)`,
			orderID, item.ProductID, item.Quantity,
		); err != nil {
			// A concurrent reserve for the same order_id committed first; the
			// blocked INSERT surfaces it as a unique violation, which is a replay.
			var pqErr *pq.Error
			if errors.As(err, &pqErr) && pqErr.Code == "23505" {
				return true, nil
			}
			return false, fmt.Errorf("failed to insert stock reservation for product %s: %w", item.ProductID, err)
		}

		result, err := tx.ExecContext(ctx,
			`UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND stock >= $1`,
			item.Quantity, item.ProductID,
		)
		if err != nil {
			return false, fmt.Errorf("failed to decrement stock for product %s: %w", item.ProductID, err)
		}
		rows, err := result.RowsAffected()
		if err != nil {
			return false, fmt.Errorf("failed to read stock decrement result for product %s: %w", item.ProductID, err)
		}
		if rows == 0 {
			var productExists bool
			if err := tx.QueryRowContext(ctx,
				`SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)`,
				item.ProductID,
			).Scan(&productExists); err != nil {
				return false, fmt.Errorf("failed to check product existence for %s: %w", item.ProductID, err)
			}
			if !productExists {
				return false, fmt.Errorf("%w: product %s", ErrProductNotFound, item.ProductID)
			}
			return false, fmt.Errorf("%w: product %s", ErrInsufficientStock, item.ProductID)
		}
	}

	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("failed to commit stock reservation: %w", err)
	}
	return false, nil
}

// ReleaseStockForOrder returns every still-active reservation of one order back
// into stock inside a single transaction. It is idempotent: a second call, or a
// call for an order without an active reservation, releases nothing and
// returns an empty slice.
func (r *postgresProductRepository) ReleaseStockForOrder(
	ctx context.Context,
	orderID string,
) ([]model.StockReservationItem, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin stock release transaction: %w", err)
	}
	defer tx.Rollback()

	released, err := flipActiveReservationsToReleased(ctx, tx, orderID)
	if err != nil {
		return nil, err
	}
	if len(released) == 0 {
		if err := tx.Commit(); err != nil {
			return nil, fmt.Errorf("failed to commit no-op stock release: %w", err)
		}
		return []model.StockReservationItem{}, nil
	}

	sort.Slice(released, func(i, j int) bool { return released[i].ProductID < released[j].ProductID })
	for _, item := range released {
		if _, err := tx.ExecContext(ctx,
			`UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2`,
			item.Quantity, item.ProductID,
		); err != nil {
			return nil, fmt.Errorf("failed to restore stock for product %s: %w", item.ProductID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit stock release: %w", err)
	}
	return released, nil
}

func flipActiveReservationsToReleased(ctx context.Context, tx *sql.Tx, orderID string) ([]model.StockReservationItem, error) {
	rows, err := tx.QueryContext(ctx, `
		UPDATE stock_reservations
		SET status = 'released', released_at = NOW()
		WHERE order_id = $1 AND status = 'active'
		RETURNING product_id, quantity
	`, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to release stock reservations: %w", err)
	}
	defer rows.Close()

	released := make([]model.StockReservationItem, 0, 4)
	for rows.Next() {
		var item model.StockReservationItem
		if err := rows.Scan(&item.ProductID, &item.Quantity); err != nil {
			return nil, fmt.Errorf("failed to scan released reservation: %w", err)
		}
		released = append(released, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate released reservations: %w", err)
	}
	return released, nil
}
