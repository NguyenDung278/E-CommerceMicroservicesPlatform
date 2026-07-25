package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

func scanOrderIDs(rows *sql.Rows) ([]string, error) {
	ids := make([]string, 0, 8)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan order id: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate order ids: %w", err)
	}
	return ids, nil
}

// ListExpiredPendingReservationOrderIDs returns pending orders whose stock hold
// expired without an allocated payment, oldest deadline first. The worker
// re-checks each order before acting, so this listing needs no row lock.
func (r *postgresOrderRepository) ListExpiredPendingReservationOrderIDs(ctx context.Context, limit int) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id
		FROM orders
		WHERE status = $1
		  AND reservation_allocated_at IS NULL
		  AND reservation_expires_at IS NOT NULL
		  AND reservation_expires_at <= NOW()
		ORDER BY reservation_expires_at ASC
		LIMIT $2
	`, model.OrderStatusPending, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list expired pending reservations: %w", err)
	}
	defer rows.Close()

	return scanOrderIDs(rows)
}

// ListCancelledOrdersPendingStockRelease returns cancelled orders whose
// reserved stock has not been confirmed released yet. Because the release RPC
// is idempotent per order, handing the same id to two ticks is harmless.
func (r *postgresOrderRepository) ListCancelledOrdersPendingStockRelease(ctx context.Context, limit int) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id
		FROM orders
		WHERE status = $1
		  AND stock_released_at IS NULL
		ORDER BY updated_at ASC
		LIMIT $2
	`, model.OrderStatusCancelled, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list cancelled orders pending stock release: %w", err)
	}
	defer rows.Close()

	return scanOrderIDs(rows)
}

// MarkOrderStockReleased records that the reserved stock of one order made it
// back to product-service, which removes the order from the release retry scan.
func (r *postgresOrderRepository) MarkOrderStockReleased(ctx context.Context, orderID string) error {
	if _, err := r.db.ExecContext(ctx, `
		UPDATE orders
		SET stock_released_at = NOW()
		WHERE id = $1
		  AND stock_released_at IS NULL
	`, orderID); err != nil {
		return fmt.Errorf("failed to mark order stock released: %w", err)
	}
	return nil
}
