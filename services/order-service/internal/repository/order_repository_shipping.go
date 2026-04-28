package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

func (r *postgresOrderRepository) GetShipmentTrackingByOrderID(ctx context.Context, orderID string) (*model.ShipmentTracking, error) {
	query := `
		SELECT id, order_id, carrier, tracking_number, tracking_url, status, estimated_delivery_at, last_checked_at, created_at, updated_at
		FROM order_shipments
		WHERE order_id = $1
	`

	tracking, err := scanShipmentTracking(r.db.QueryRowContext(ctx, query, orderID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get shipment tracking: %w", err)
	}
	return tracking, nil
}

func (r *postgresOrderRepository) UpsertShipmentTracking(ctx context.Context, tracking *model.ShipmentTracking) error {
	query := `
		INSERT INTO order_shipments (
			id, order_id, carrier, tracking_number, tracking_url, status,
			estimated_delivery_at, last_checked_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (order_id)
		DO UPDATE SET
			carrier = EXCLUDED.carrier,
			tracking_number = EXCLUDED.tracking_number,
			tracking_url = EXCLUDED.tracking_url,
			status = EXCLUDED.status,
			estimated_delivery_at = EXCLUDED.estimated_delivery_at,
			last_checked_at = EXCLUDED.last_checked_at,
			updated_at = EXCLUDED.updated_at
	`

	_, err := r.db.ExecContext(ctx, query,
		tracking.ID,
		tracking.OrderID,
		tracking.Carrier,
		tracking.TrackingNumber,
		tracking.TrackingURL,
		tracking.Status,
		tracking.EstimatedDeliveryAt,
		tracking.LastCheckedAt,
		tracking.CreatedAt,
		tracking.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to upsert shipment tracking: %w", err)
	}
	return nil
}
