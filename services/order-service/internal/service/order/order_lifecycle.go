package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

// CreateOrder turns a validated order request into a persisted order and emits
// the corresponding asynchronous event.
//
// Inputs:
//   - ctx carries cancellation to pricing, persistence, and event publication.
//   - userID and userEmail identify the order owner and notification target.
//   - req contains the requested items, shipping data, and optional coupon.
//
// Returns:
//   - the persisted order aggregate.
//   - a validation, dependency, or persistence error.
//
// Edge cases:
//   - coupon validation errors remain business errors even when they surface
//     during persistence because the repository locks and consumes coupons in the
//     transaction.
//
// Side effects:
//   - writes order state to PostgreSQL.
//   - publishes an `order.created` RabbitMQ event when a channel is configured.
//
// Performance:
//   - O(n) over order items plus downstream product lookups and one repository
//     transaction.
func (s *OrderService) CreateOrder(ctx context.Context, userID, userEmail, idempotencyKey string, req dto.CreateOrderRequest) (*model.Order, error) {
	startedAt := time.Now()
	outcome := appobs.OutcomeSuccess
	requestLog := appobs.LoggerWithContext(s.log, ctx, zap.String("user_id", userID))
	defer func() {
		appobs.ObserveOperation("order-service", "create_order", outcome, time.Since(startedAt))
	}()

	normalizedKey, err := normalizeOrderIdempotencyKey(idempotencyKey)
	if err != nil {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("create order failed due to invalid idempotency key", zap.Error(err))
		return nil, err
	}

	requestHash := hashCreateOrderRequest(req)
	replayedOrder, err := s.findIdempotentOrder(ctx, userID, normalizedKey, requestHash)
	if err != nil || replayedOrder != nil {
		if err != nil {
			outcome = appobs.OutcomeFromError(err, ErrIdempotencyKeyConflict)
			requestLog.Warn("create order failed during idempotency lookup", zap.Error(err))
			return nil, err
		}
		requestLog.Info("order create request replayed from idempotency key",
			zap.String("idempotency_key", normalizedKey),
			zap.String("order_id", replayedOrder.ID),
		)
		return replayedOrder, nil
	}

	quote, err := s.quoteOrder(ctx, req)
	if err != nil {
		outcome = appobs.OutcomeFromError(
			err,
			ErrEmptyOrder,
			ErrProductNotFound,
			ErrProductUnavailable,
			ErrInsufficientStock,
			ErrInvalidShippingMethod,
			ErrShippingAddressRequired,
			ErrCouponNotFound,
			ErrCouponInactive,
			ErrCouponExpired,
			ErrCouponMinimumNotMet,
			ErrCouponUsageLimit,
		)
		requestLog.Warn("create order failed during quote", zap.String("outcome", outcome), zap.Error(err))
		return nil, err
	}

	now := time.Now()
	order := newOrderFromQuote(userID, quote, now)
	createdOutbox, err := buildCreatedOrderOutbox(ctx, order, userEmail)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("create order failed while building outbox payload", zap.Error(err))
		return nil, err
	}

	var idempotencyRecord *model.OrderIdempotencyRecord
	if normalizedKey != "" && order.ReservationExpiresAt != nil {
		idempotencyRecord = &model.OrderIdempotencyRecord{
			UserID:               userID,
			IdempotencyKey:       normalizedKey,
			RequestHash:          requestHash,
			OrderID:              order.ID,
			ReservationExpiresAt: *order.ReservationExpiresAt,
			CreatedAt:            now,
			UpdatedAt:            now,
		}
	}

	if err := s.reserveCreatedOrderStock(ctx, requestLog, order); err != nil {
		outcome = appobs.OutcomeFromError(err, ErrProductNotFound, ErrInsufficientStock)
		requestLog.Warn("create order failed while reserving stock", zap.String("outcome", outcome), zap.Error(err))
		return nil, err
	}

	if err := s.persistCreatedOrder(ctx, requestLog, order, createdOutbox, idempotencyRecord); err != nil {
		s.releaseOrphanReservation(ctx, order.ID)
		if normalizedKey != "" && isOrderUniqueViolation(err) {
			replayedOrder, replayErr := s.findIdempotentOrder(ctx, userID, normalizedKey, requestHash)
			if replayErr == nil && replayedOrder != nil {
				requestLog.Info("order request replayed after idempotency unique violation",
					zap.String("idempotency_key", normalizedKey),
					zap.String("order_id", replayedOrder.ID),
				)
				return replayedOrder, nil
			}
			if replayErr != nil {
				requestLog.Error("order idempotency replay failed after unique violation",
					zap.String("idempotency_key", normalizedKey),
					zap.Error(replayErr),
				)
				return nil, replayErr
			}
		}
		outcome = appobs.OutcomeFromError(
			err,
			ErrIdempotencyKeyConflict,
			ErrCouponNotFound,
			ErrCouponInactive,
			ErrCouponExpired,
			ErrCouponMinimumNotMet,
			ErrCouponUsageLimit,
		)
		return nil, err
	}

	requestLog.Info("order created",
		zap.String("order_id", order.ID),
		zap.Int("item_count", len(order.Items)),
		zap.Float64("subtotal_price", order.SubtotalPrice),
		zap.Float64("total_price", order.TotalPrice),
		zap.String("shipping_method", order.ShippingMethod),
	)

	return order, nil
}

// UpdateStatus changes an order status for operator workflows after validating
// the requested target status.
//
// Inputs:
//   - ctx carries cancellation to repository operations.
//   - orderID identifies the order to update.
//   - status is the requested target status.
//   - actorID, actorRole, and message describe the transition actor.
//
// Returns:
//   - nil on success or when the order is already in the target state.
//   - an error when validation or persistence fails.
//
// Edge cases:
//   - repeated status updates short-circuit without hitting the repository.
//
// Side effects:
//   - writes an order status transition and emits observability signals.
//
// Performance:
//   - dominated by one read and, when needed, one update.
func (s *OrderService) UpdateStatus(ctx context.Context, orderID string, status model.OrderStatus, actorID, actorRole, message string) error {
	if !isValidOrderStatus(status) {
		return ErrInvalidOrderStatus
	}

	order, err := s.loadOrderByID(ctx, orderID)
	if err != nil {
		return err
	}
	if order.Status == status {
		return nil
	}

	if err := s.repo.UpdateStatus(ctx, orderID, status, actorID, actorRole, message, nil); err != nil {
		appobs.RecordStateTransition("order-service", "order", string(order.Status), string(status), appobs.OutcomeSystemError)
		appobs.LoggerWithContext(s.log, ctx,
			zap.String("order_id", orderID),
			zap.String("actor_id", actorID),
			zap.String("actor_role", actorRole),
			zap.String("from_status", string(order.Status)),
			zap.String("to_status", string(status)),
		).Error("failed to update order status", zap.Error(err))
		return err
	}

	appobs.RecordStateTransition("order-service", "order", string(order.Status), string(status), appobs.OutcomeSuccess)
	appobs.LoggerWithContext(s.log, ctx,
		zap.String("order_id", orderID),
		zap.String("actor_id", actorID),
		zap.String("actor_role", actorRole),
		zap.String("from_status", string(order.Status)),
		zap.String("to_status", string(status)),
	).Info("order status updated")

	return nil
}

// CancelOrder cancels a pending order on behalf of the owning user.
//
// Inputs:
//   - ctx carries cancellation to repository, stock, and event calls.
//   - orderID identifies the order to cancel.
//   - userID identifies the caller and enforces ownership.
//
// Returns:
//   - nil on successful cancellation.
//   - ErrOrderNotFound or ErrOrderNotCancellable for rejected requests.
//
// Edge cases:
//   - only pending orders may be cancelled by end users.
//
// Side effects:
//   - updates order status, records an audit entry, restores stock, and publishes
//     an async cancellation event.
//
// Performance:
//   - dominated by one order read, one update, and one stock restore call per
//     order item.
func (s *OrderService) CancelOrder(ctx context.Context, orderID, userID string) error {
	order, err := s.loadOrderByID(ctx, orderID)
	if err != nil {
		return err
	}
	if order.UserID != userID {
		return ErrOrderNotFound
	}
	if order.Status != model.OrderStatusPending {
		return ErrOrderNotCancellable
	}

	return s.cancelOrderWithActor(ctx, order, userID, "user", "Order cancelled by user")
}

// CancelOrderAsAdmin cancels a pending or paid order on behalf of staff.
//
// Inputs:
//   - ctx carries cancellation to repository, stock, and event calls.
//   - orderID identifies the order to cancel.
//   - actorID and actorRole describe the operator performing the action.
//   - message is the human-readable cancellation reason.
//
// Returns:
//   - nil on success.
//   - ErrOrderNotFound or ErrAdminCancelNotAllowed for rejected requests.
//
// Edge cases:
//   - blank messages are replaced with a stable default for auditability.
//
// Side effects:
//   - updates order state, writes an audit entry, restores stock, and publishes
//     an async cancellation event.
//
// Performance:
//   - dominated by one order read, one update, and stock restoration per item.
func (s *OrderService) CancelOrderAsAdmin(ctx context.Context, orderID, actorID, actorRole, message string) error {
	order, err := s.loadOrderByID(ctx, orderID)
	if err != nil {
		return err
	}

	switch order.Status {
	case model.OrderStatusPending, model.OrderStatusPaid:
	default:
		return ErrAdminCancelNotAllowed
	}

	if strings.TrimSpace(message) == "" {
		message = "Order cancelled manually by staff"
	}

	return s.cancelOrderWithActor(ctx, order, actorID, actorRole, message)
}

// cancelOrderWithActor executes the shared cancellation flow for user and admin
// callers.
//
// Inputs:
//   - ctx carries cancellation to all downstream work.
//   - order is the preloaded order aggregate.
//   - actorID, actorRole, and message describe the cancellation actor.
//
// Returns:
//   - nil when the cancellation flow completes.
//   - the first repository error encountered when marking the order cancelled.
//
// Edge cases:
//   - stock restoration failures are logged and tolerated so the primary order
//     state remains cancelled.
//
// Side effects:
//   - updates order status, records an audit entry, restores stock best-effort,
//     and publishes an async event.
//
// Performance:
//   - O(n) over order items for the stock restoration portion.
func (s *OrderService) cancelOrderWithActor(ctx context.Context, order *model.Order, actorID, actorRole, message string) error {
	previousStatus := order.Status
	order.Status = model.OrderStatusCancelled
	cancelOutbox, err := buildCancelledOrderOutbox(ctx, order)
	if err != nil {
		order.Status = previousStatus
		appobs.LoggerWithContext(s.log, ctx,
			zap.String("order_id", order.ID),
			zap.String("actor_id", actorID),
			zap.String("actor_role", actorRole),
		).Error("failed to build cancellation outbox payload", zap.Error(err))
		return err
	}
	if err := s.markOrderCancelled(ctx, order, actorID, actorRole, message, cancelOutbox); err != nil {
		order.Status = previousStatus
		appobs.RecordStateTransition("order-service", "order", string(previousStatus), string(model.OrderStatusCancelled), appobs.OutcomeSystemError)
		return err
	}

	appobs.RecordStateTransition("order-service", "order", string(previousStatus), string(model.OrderStatusCancelled), appobs.OutcomeSuccess)
	appobs.LoggerWithContext(s.log, ctx,
		zap.String("order_id", order.ID),
		zap.String("actor_id", actorID),
		zap.String("actor_role", actorRole),
		zap.String("from_status", string(previousStatus)),
		zap.String("to_status", string(model.OrderStatusCancelled)),
	).Info("order cancelled")

	s.recordAuditEntry(ctx, &model.AuditEntry{
		ID:         uuid.New().String(),
		EntityType: "order",
		EntityID:   order.ID,
		Action:     "order.cancelled",
		ActorID:    actorID,
		ActorRole:  actorRole,
		Metadata: map[string]any{
			"previous_status": previousStatus,
			"current_status":  model.OrderStatusCancelled,
			"user_id":         order.UserID,
			"total_price":     order.TotalPrice,
			"message":         message,
		},
		CreatedAt: time.Now(),
	})

	s.releaseOrderStock(ctx, order.ID, "cancelled order stock release")
	return nil
}

// newOrderFromQuote materializes a persisted order aggregate from the canonical
// pricing quote.
//
// Inputs:
//   - userID identifies the order owner.
//   - quote contains already normalized totals and shipping data.
//   - now is injected for deterministic timestamps in tests.
//
// Returns:
//   - a new order aggregate ready for repository persistence.
//
// Edge cases:
//   - coupon and shipping fields may be empty for non-discounted pickup orders.
//
// Side effects:
//   - allocates a new order and one item object per quoted line item.
//
// Performance:
//   - O(n) over quoted items.
func newOrderFromQuote(userID string, quote *pricedOrderQuote, now time.Time) *model.Order {
	orderID := uuid.New().String()

	return &model.Order{
		ID:                   orderID,
		UserID:               userID,
		Status:               model.OrderStatusPending,
		Items:                buildOrderItems(orderID, quote.Items),
		CouponCode:           quote.CouponCode,
		SubtotalPrice:        quote.SubtotalPrice,
		DiscountAmount:       quote.DiscountAmount,
		ShippingMethod:       quote.ShippingMethod,
		ShippingFee:          quote.ShippingFee,
		ShippingAddress:      quote.ShippingAddress,
		ReservationExpiresAt: buildOrderReservationExpiry(now),
		TotalPrice:           quote.TotalPrice,
		CreatedAt:            now,
		UpdatedAt:            now,
	}
}

// buildOrderItems converts priced quote lines into persisted order items.
//
// Inputs:
//   - orderID identifies the parent order.
//   - items contains the priced line items from quoteOrder.
//
// Returns:
//   - the persisted order item slice.
//
// Edge cases:
//   - empty input yields an empty but non-nil slice.
//
// Side effects:
//   - allocates one item struct per input line.
//
// Performance:
//   - O(n) over the item slice with pre-sized capacity to avoid repeated growth.
func buildOrderItems(orderID string, items []pricedOrderItem) []model.OrderItem {
	orderItems := make([]model.OrderItem, 0, len(items))
	for _, item := range items {
		orderItems = append(orderItems, model.OrderItem{
			ID:        uuid.New().String(),
			OrderID:   orderID,
			ProductID: item.ProductID,
			Name:      item.Name,
			Price:     item.Price,
			Quantity:  item.Quantity,
		})
	}

	return orderItems
}

// persistCreatedOrder writes the order aggregate and logs failures at the
// correct severity.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - requestLog is the request-scoped logger with caller context attached.
//   - order is the aggregate to persist.
//
// Returns:
//   - nil on success.
//   - the repository error on failure.
//
// Edge cases:
//   - coupon failures are treated as business warnings instead of system errors.
//
// Side effects:
//   - writes to PostgreSQL and emits logs.
//
// Performance:
//   - dominated by one repository transaction.
func (s *OrderService) persistCreatedOrder(
	ctx context.Context,
	requestLog *zap.Logger,
	order *model.Order,
	outbox *model.OutboxMessage,
	record *model.OrderIdempotencyRecord,
) error {
	var err error
	if record != nil {
		err = s.repo.CreateWithIdempotency(ctx, order, outbox, record)
	} else {
		err = s.repo.Create(ctx, order, outbox)
	}
	if err != nil {
		logCreateOrderPersistenceError(requestLog, order, err)
		return err
	}

	return nil
}

// logCreateOrderPersistenceError chooses an appropriate log level for order
// persistence failures.
//
// Inputs:
//   - requestLog is the request-scoped logger.
//   - order is the attempted aggregate.
//   - err is the persistence failure to log.
//
// Returns:
//   - none.
//
// Edge cases:
//   - coupon-specific failures are logged as warnings to avoid noisy error logs.
//
// Side effects:
//   - emits one log entry.
//
// Performance:
//   - O(1).
func logCreateOrderPersistenceError(requestLog *zap.Logger, order *model.Order, err error) {
	if isCouponError(err) {
		requestLog.Warn("create order failed while persisting business state",
			zap.String("order_id", order.ID),
			zap.String("coupon_code", order.CouponCode),
			zap.Error(err),
		)
		return
	}

	requestLog.Error("create order failed while persisting order",
		zap.String("order_id", order.ID),
		zap.Error(err),
	)
}

// markOrderCancelled delegates the authoritative cancellation transition to the
// repository.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - order is the aggregate being cancelled.
//   - actorID, actorRole, and message describe the actor for audit trails.
//
// Returns:
//   - any repository update error.
//
// Edge cases:
//   - callers must validate allowed source states before invoking this helper.
//
// Side effects:
//   - writes the cancelled status and order event.
//
// Performance:
//   - dominated by one repository update.
func (s *OrderService) markOrderCancelled(
	ctx context.Context,
	order *model.Order,
	actorID, actorRole, message string,
	outbox *model.OutboxMessage,
) error {
	return s.repo.UpdateStatus(ctx, order.ID, model.OrderStatusCancelled, actorID, actorRole, message, outbox)
}

func (s *OrderService) reserveCreatedOrderStock(ctx context.Context, requestLog *zap.Logger, order *model.Order) error {
	stockReserveStartedAt := time.Now()
	replayed, err := s.productClient.ReserveOrderStock(ctx, order.ID, order.Items)
	if err != nil {
		mapped := mapCreateOrderStockError(err)
		appobs.ObserveOperation("order-service", "reserve_stock",
			appobs.OutcomeFromError(mapped, ErrProductNotFound, ErrInsufficientStock), time.Since(stockReserveStartedAt))
		return mapped
	}

	appobs.ObserveOperation("order-service", "reserve_stock", appobs.OutcomeSuccess, time.Since(stockReserveStartedAt))
	requestLog.Info("reserved stock for order",
		zap.String("order_id", order.ID),
		zap.Int("item_count", len(order.Items)),
		zap.Bool("already_reserved", replayed),
	)
	return nil
}

// releaseOrderStock returns the reserved stock of one order and, on success,
// marks the order row so the reservation expiry worker stops retrying it.
//
// Edge cases:
//   - the release RPC is idempotent per order, so a failure here is safe to
//     retry later; the caller decides whether a worker picks it up.
//   - a failed MarkOrderStockReleased only causes one extra no-op release.
func (s *OrderService) releaseOrderStock(ctx context.Context, orderID, reason string) bool {
	stockReleaseStartedAt := time.Now()
	if _, err := s.productClient.ReleaseOrderStock(ctx, orderID); err != nil {
		appobs.ObserveOperation("order-service", "release_stock", appobs.OutcomeSystemError, time.Since(stockReleaseStartedAt))
		s.log.Warn("failed to release reserved stock, worker will retry",
			zap.String("order_id", orderID),
			zap.String("reason", reason),
			zap.Error(err),
		)
		return false
	}
	appobs.ObserveOperation("order-service", "release_stock", appobs.OutcomeSuccess, time.Since(stockReleaseStartedAt))

	if err := s.repo.MarkOrderStockReleased(ctx, orderID); err != nil {
		s.log.Warn("failed to mark order stock released",
			zap.String("order_id", orderID),
			zap.Error(err),
		)
	}
	return true
}

// releaseOrphanReservation compensates a reservation whose order row was never
// persisted. There is no order row for the worker to find, so this path retries
// inline before giving up loudly.
func (s *OrderService) releaseOrphanReservation(ctx context.Context, orderID string) {
	const maxAttempts = 3
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if _, err := s.productClient.ReleaseOrderStock(ctx, orderID); err == nil {
			return
		} else if attempt == maxAttempts {
			appobs.IncEvent("order-service", "orphan_reservation_release_failed", appobs.OutcomeSystemError)
			s.log.Error("reservation has no persisted order and could not be released; manual release required",
				zap.String("order_id", orderID),
				zap.Error(err),
			)
		}
	}
}

func mapCreateOrderStockError(err error) error {
	switch grpcstatus.Code(err) {
	case codes.NotFound:
		return ErrProductNotFound
	case codes.FailedPrecondition:
		return ErrInsufficientStock
	default:
		return err
	}
}

// isValidOrderStatus validates external status transitions against the known
// order status enum.
//
// Inputs:
//   - status is the requested target status.
//
// Returns:
//   - true when the status belongs to the supported order lifecycle.
//
// Edge cases:
//   - this helper validates membership only; it does not enforce allowed
//     transition paths.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func isValidOrderStatus(status model.OrderStatus) bool {
	switch status {
	case model.OrderStatusPending,
		model.OrderStatusPaid,
		model.OrderStatusShipped,
		model.OrderStatusDelivered,
		model.OrderStatusCancelled,
		model.OrderStatusRefunded:
		return true
	default:
		return false
	}
}
