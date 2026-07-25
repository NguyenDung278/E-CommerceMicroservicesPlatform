package service

import (
	"context"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

const (
	reservationExpiryPollInterval  = 5 * time.Second
	reservationExpiryClaimLimit    = 20
	reservationExpiryWorkerActorID = "reservation-expiry-worker"
)

// StartReservationExpiryWorker cancels pending orders whose stock hold expired
// before payment completed and releases their reserved stock. Before this
// worker existed, expiry only happened lazily when someone read the order, so
// unread pending orders could hold stock forever.
//
// Both steps are idempotent per order: ExpirePendingReservation is guarded by a
// compare-and-set on order status, and the release RPC replays as a no-op, so
// crashing between steps or racing the lazy expiry path is safe.
func (s *OrderService) StartReservationExpiryWorker(ctx context.Context) {
	ticker := time.NewTicker(reservationExpiryPollInterval)
	defer ticker.Stop()

	for {
		if err := s.expireDueOrderReservations(ctx); err != nil && ctx.Err() == nil {
			s.log.Warn("reservation expiry batch failed", zap.Error(err))
		}
		if err := s.releasePendingCancelledOrderStock(ctx); err != nil && ctx.Err() == nil {
			s.log.Warn("cancelled order stock release batch failed", zap.Error(err))
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// expireDueOrderReservations cancels one batch of pending orders whose
// reservation deadline passed without a completed payment. Processing exactly
// one batch per tick keeps a persistently failing order from spinning the
// worker in a tight loop.
func (s *OrderService) expireDueOrderReservations(ctx context.Context) error {
	orderIDs, err := s.repo.ListExpiredPendingReservationOrderIDs(ctx, reservationExpiryClaimLimit)
	if err != nil {
		return err
	}

	for _, orderID := range orderIDs {
		order, err := s.repo.GetByID(ctx, orderID)
		if err != nil {
			s.log.Warn("failed to load order for reservation expiry",
				zap.String("order_id", orderID),
				zap.Error(err),
			)
			continue
		}
		if order == nil || !isPendingReservationExpired(order, time.Now()) {
			continue
		}

		cancelledOrder := *order
		cancelledOrder.Status = model.OrderStatusCancelled
		cancelledOrder.ReservationExpiresAt = nil
		cancelledOrder.ReservationAllocatedAt = nil
		cancelOutbox, err := buildCancelledOrderOutbox(ctx, &cancelledOrder)
		if err != nil {
			s.log.Error("failed to build reservation expiry outbox payload",
				zap.String("order_id", orderID),
				zap.Error(err),
			)
			continue
		}

		transitioned, err := s.repo.ExpirePendingReservation(
			ctx,
			orderID,
			reservationExpiryWorkerActorID,
			"system",
			"order cancelled because reserved stock expired before payment completed",
			cancelOutbox,
		)
		if err != nil {
			s.log.Warn("failed to expire pending reservation",
				zap.String("order_id", orderID),
				zap.Error(err),
			)
			continue
		}
		if !transitioned {
			continue
		}

		appobs.RecordStateTransition(
			"order-service",
			"order",
			string(model.OrderStatusPending),
			string(model.OrderStatusCancelled),
			appobs.OutcomeSuccess,
		)
		s.log.Info("reservation expiry worker cancelled pending order",
			zap.String("order_id", orderID),
		)
	}

	return nil
}

// releasePendingCancelledOrderStock releases one batch of cancelled orders
// whose reserved stock has not made it back to product-service yet. This is the
// retry path for every cancellation flow: rows stay claimed only after the
// release RPC succeeds, so failures are retried on the next tick.
func (s *OrderService) releasePendingCancelledOrderStock(ctx context.Context) error {
	orderIDs, err := s.repo.ListCancelledOrdersPendingStockRelease(ctx, reservationExpiryClaimLimit)
	if err != nil {
		return err
	}

	for _, orderID := range orderIDs {
		s.releaseOrderStock(ctx, orderID, "reservation expiry worker release")
	}

	return nil
}
