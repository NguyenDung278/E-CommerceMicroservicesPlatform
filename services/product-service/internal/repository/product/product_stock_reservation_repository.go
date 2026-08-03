package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

// ErrProductNotFound is returned by reservation writes when a referenced
// product row does not exist.
var ErrProductNotFound = errors.New("product not found")

// ErrProductVariantNotFound is returned when a reservation names a sku that the
// product does not declare.
var ErrProductVariantNotFound = errors.New("product variant not found")

// ErrProductVariantRequired is returned when a reservation targets the
// product-level stock pool of a product that declares variants. Such a hold is
// ambiguous: it cannot say which size or colour is leaving the warehouse, and
// letting it through is exactly how per-variant oversell happens.
var ErrProductVariantRequired = errors.New("product variant sku is required")

// productStockRow is the locked snapshot the reservation writes work from.
type productStockRow struct {
	stock    int
	variants []model.ProductVariant
}

// ReserveStockForOrder reserves stock for every item of one order inside a
// single transaction: either every line item is ledgered and decremented, or
// nothing changes. The ledger row makes the whole reservation idempotent per
// order_id.
//
// The oversell guard is a `SELECT ... FOR UPDATE` row lock on the product plus
// an in-transaction stock check, rather than the single-statement compare-and-set
// this function used while stock was one plain column. Variant stock lives
// inside the `variants` JSONB document, and a CAS predicate reading that array
// in the same statement that rewrites it is not safe under READ COMMITTED: the
// subquery feeding the predicate can be evaluated against a snapshot taken
// before the lock was granted. Holding the row lock across read-check-write
// gives the same all-or-nothing guarantee with SQL that stays readable, and is
// the pattern `lockAndConsumeCoupon` already uses in order-service.
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
	// share products but list them differently. Two variants of one product lock
	// the same row twice inside this transaction, which is free.
	sorted := make([]model.StockReservationItem, len(items))
	copy(sorted, items)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].ProductID != sorted[j].ProductID {
			return sorted[i].ProductID < sorted[j].ProductID
		}
		return sorted[i].SKU < sorted[j].SKU
	})

	for _, item := range sorted {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO stock_reservations (order_id, product_id, sku, quantity) VALUES ($1, $2, $3, $4)`,
			orderID, item.ProductID, item.SKU, item.Quantity,
		); err != nil {
			// A concurrent reserve for the same order_id committed first; the
			// blocked INSERT surfaces it as a unique violation, which is a replay.
			var pqErr *pq.Error
			if errors.As(err, &pqErr) && pqErr.Code == "23505" {
				return true, nil
			}
			return false, fmt.Errorf("failed to insert stock reservation for product %s: %w", item.ProductID, err)
		}

		if err := holdStockForItem(ctx, tx, item); err != nil {
			return false, err
		}
	}

	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("failed to commit stock reservation: %w", err)
	}
	return false, nil
}

// holdStockForItem decrements the stock pool one reserved line item draws from,
// under the row lock taken by lockProductStock.
func holdStockForItem(ctx context.Context, tx *sql.Tx, item model.StockReservationItem) error {
	locked, err := lockProductStock(ctx, tx, item.ProductID)
	if err != nil {
		return err
	}

	if item.SKU == "" {
		if len(locked.variants) > 0 {
			return fmt.Errorf("%w: product %s", ErrProductVariantRequired, item.ProductID)
		}
		if locked.stock < item.Quantity {
			return fmt.Errorf("%w: product %s", ErrInsufficientStock, item.ProductID)
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2`,
			item.Quantity, item.ProductID,
		); err != nil {
			return fmt.Errorf("failed to decrement stock for product %s: %w", item.ProductID, err)
		}
		return nil
	}

	index := model.FindVariantIndex(locked.variants, item.SKU)
	if index < 0 {
		return fmt.Errorf("%w: product %s sku %s", ErrProductVariantNotFound, item.ProductID, item.SKU)
	}
	if locked.variants[index].Stock < item.Quantity {
		return fmt.Errorf("%w: product %s sku %s", ErrInsufficientStock, item.ProductID, item.SKU)
	}

	return writeVariantStock(
		ctx, tx, item.ProductID, index,
		locked.variants[index].Stock-item.Quantity,
		-item.Quantity,
	)
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

	sort.Slice(released, func(i, j int) bool {
		if released[i].ProductID != released[j].ProductID {
			return released[i].ProductID < released[j].ProductID
		}
		return released[i].SKU < released[j].SKU
	})
	for _, item := range released {
		if err := returnStockForItem(ctx, tx, item); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit stock release: %w", err)
	}
	return released, nil
}

// returnStockForItem puts one released line item back into the pool it was
// taken from.
//
// Unlike the reserve path this never rejects: the ledger row proves the stock
// was taken, so refusing to give it back would leak inventory permanently. A
// sku that no longer exists in the catalog (variant deleted while an order was
// in flight) falls back to the product-level aggregate so the units stay
// countable somewhere instead of vanishing.
func returnStockForItem(ctx context.Context, tx *sql.Tx, item model.StockReservationItem) error {
	locked, err := lockProductStock(ctx, tx, item.ProductID)
	if err != nil {
		// A product deleted after the hold was taken leaves nothing to credit
		// back; the ledger row is already flipped to released, so stop here
		// rather than failing the whole release of the order.
		if errors.Is(err, ErrProductNotFound) {
			return nil
		}
		return err
	}

	index := model.FindVariantIndex(locked.variants, item.SKU)
	if index >= 0 {
		return writeVariantStock(
			ctx, tx, item.ProductID, index,
			locked.variants[index].Stock+item.Quantity,
			item.Quantity,
		)
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2`,
		item.Quantity, item.ProductID,
	); err != nil {
		return fmt.Errorf("failed to restore stock for product %s: %w", item.ProductID, err)
	}
	return nil
}

// lockProductStock takes a row lock on one product and returns its current
// stock pools. Every reservation write goes through here so that the
// read-check-write sequence above cannot interleave with another order.
func lockProductStock(ctx context.Context, tx *sql.Tx, productID string) (productStockRow, error) {
	var (
		locked      productStockRow
		rawVariants []byte
	)
	err := tx.QueryRowContext(ctx,
		`SELECT stock, variants FROM products WHERE id = $1 FOR UPDATE`,
		productID,
	).Scan(&locked.stock, &rawVariants)
	if errors.Is(err, sql.ErrNoRows) {
		return productStockRow{}, fmt.Errorf("%w: product %s", ErrProductNotFound, productID)
	}
	if err != nil {
		return productStockRow{}, fmt.Errorf("failed to lock stock for product %s: %w", productID, err)
	}

	if err := json.Unmarshal(rawVariants, &locked.variants); err != nil {
		return productStockRow{}, fmt.Errorf("failed to decode variants for product %s: %w", productID, err)
	}
	return locked, nil
}

// writeVariantStock rewrites one variant's stock inside the JSONB document and
// moves the product-level aggregate by the same delta, so listing queries that
// filter or badge on `products.stock` keep agreeing with the variants.
func writeVariantStock(
	ctx context.Context,
	tx *sql.Tx,
	productID string,
	variantIndex int,
	variantStock int,
	aggregateDelta int,
) error {
	_, err := tx.ExecContext(ctx, `
		UPDATE products
		SET variants = jsonb_set(variants, ARRAY[$2::text, 'stock'], to_jsonb($3::int)),
		    stock = GREATEST(stock + $4, 0),
		    updated_at = NOW()
		WHERE id = $1
	`, productID, strconv.Itoa(variantIndex), variantStock, aggregateDelta)
	if err != nil {
		return fmt.Errorf("failed to write variant stock for product %s: %w", productID, err)
	}
	return nil
}

func flipActiveReservationsToReleased(ctx context.Context, tx *sql.Tx, orderID string) ([]model.StockReservationItem, error) {
	rows, err := tx.QueryContext(ctx, `
		UPDATE stock_reservations
		SET status = 'released', released_at = NOW()
		WHERE order_id = $1 AND status = 'active'
		RETURNING product_id, sku, quantity
	`, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to release stock reservations: %w", err)
	}
	defer rows.Close()

	released := make([]model.StockReservationItem, 0, 4)
	for rows.Next() {
		var item model.StockReservationItem
		if err := rows.Scan(&item.ProductID, &item.SKU, &item.Quantity); err != nil {
			return nil, fmt.Errorf("failed to scan released reservation: %w", err)
		}
		released = append(released, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate released reservations: %w", err)
	}
	return released, nil
}
