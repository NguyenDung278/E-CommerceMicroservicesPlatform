package service

import (
	"context"
	"fmt"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

func buildOrderReservationExpiry(now time.Time) *time.Time {
	expiresAt := now.Add(orderReservationHoldDuration)
	return &expiresAt
}

func isPendingReservationExpired(order *model.Order, now time.Time) bool {
	if order == nil {
		return false
	}
	if order.Status != model.OrderStatusPending {
		return false
	}
	if order.ReservationAllocatedAt != nil {
		return false
	}
	if order.ReservationExpiresAt == nil {
		return false
	}

	return !order.ReservationExpiresAt.After(now)
}

func (s *OrderService) finalizeOrderReservationState(ctx context.Context, order *model.Order) (*model.Order, error) {
	if !isPendingReservationExpired(order, time.Now()) {
		return order, nil
	}

	cancelledOrder := *order
	cancelledOrder.Status = model.OrderStatusCancelled
	cancelledOrder.ReservationExpiresAt = nil
	cancelledOrder.ReservationAllocatedAt = nil
	cancelOutbox, err := buildCancelledOrderOutbox(ctx, &cancelledOrder)
	if err != nil {
		appobs.LoggerWithContext(s.log, ctx, zap.String("order_id", order.ID)).
			Error("failed to build reservation expiry outbox payload", zap.Error(err))
		return nil, err
	}

	transitioned, err := s.repo.ExpirePendingReservation(
		ctx,
		order.ID,
		"system",
		"system",
		"order cancelled because reserved stock expired before payment completed",
		cancelOutbox,
	)
	if err != nil {
		return nil, err
	}
	if transitioned {
		appobs.RecordStateTransition(
			"order-service",
			"order",
			string(model.OrderStatusPending),
			string(model.OrderStatusCancelled),
			appobs.OutcomeSuccess,
		)
		appobs.LoggerWithContext(s.log, ctx,
			zap.String("order_id", order.ID),
			zap.Time("reservation_expires_at", *order.ReservationExpiresAt),
		).Info("expired pending order reservation")
		s.releaseOrderStock(ctx, order.ID, "expired reservation stock release")
	}

	refreshedOrder, err := s.repo.GetByID(ctx, order.ID)
	if err != nil {
		return nil, err
	}
	if refreshedOrder == nil {
		return nil, fmt.Errorf("expired reservation order %s disappeared after transition", order.ID)
	}

	return refreshedOrder, nil
}
