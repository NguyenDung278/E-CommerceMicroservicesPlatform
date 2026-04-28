package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

func (s *OrderService) GetShipmentTracking(
	ctx context.Context,
	orderID, actorID, actorRole string,
) (*model.ShipmentTracking, error) {
	order, err := s.loadOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if !isOperatorRole(actorRole) && order.UserID != actorID {
		return nil, ErrOrderNotFound
	}
	return s.repo.GetShipmentTrackingByOrderID(ctx, orderID)
}

func (s *OrderService) UpsertShipmentTracking(
	ctx context.Context,
	orderID string,
	req dto.UpdateShipmentTrackingRequest,
) (*model.ShipmentTracking, error) {
	if _, err := s.loadOrderByID(ctx, orderID); err != nil {
		return nil, err
	}

	now := time.Now()
	existing, err := s.repo.GetShipmentTrackingByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	tracking := &model.ShipmentTracking{
		ID:                  uuid.New().String(),
		OrderID:             orderID,
		Carrier:             normalizeShippingTrackingText(req.Carrier),
		TrackingNumber:      strings.TrimSpace(req.TrackingNumber),
		TrackingURL:         strings.TrimSpace(req.TrackingURL),
		Status:              strings.TrimSpace(strings.ToLower(req.Status)),
		EstimatedDeliveryAt: req.EstimatedDeliveryAt,
		LastCheckedAt:       req.LastCheckedAt,
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	if existing != nil {
		tracking.ID = existing.ID
		tracking.CreatedAt = existing.CreatedAt
	}
	if tracking.LastCheckedAt == nil {
		tracking.LastCheckedAt = &now
	}

	if err := s.repo.UpsertShipmentTracking(ctx, tracking); err != nil {
		return nil, err
	}

	return s.repo.GetShipmentTrackingByOrderID(ctx, orderID)
}

func normalizeShippingTrackingText(value string) string {
	parts := strings.Fields(strings.TrimSpace(value))
	return strings.Join(parts, " ")
}
