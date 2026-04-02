package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

// publishOrderEvent emits the asynchronous `order.created` event after the order
// transaction commits.
//
// Inputs:
//   - ctx carries request metadata and timeout budget.
//   - order is the newly persisted order aggregate.
//   - userEmail is included for downstream notification consumers.
//
// Returns:
//   - none; publication failures are logged because the order is already
//     persisted.
//
// Edge cases:
//   - nil RabbitMQ channels degrade gracefully and simply skip publication.
//
// Side effects:
//   - publishes one RabbitMQ message with up to three attempts.
//   - emits observability metrics and logs.
//
// Performance:
//   - O(1) application work plus JSON marshaling and network I/O.
func (s *OrderService) publishOrderEvent(ctx context.Context, order *model.Order, userEmail string) {
	if s.amqpCh == nil {
		s.log.Warn("RabbitMQ channel not available, skipping event publish")
		return
	}

	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("order_id", order.ID),
		zap.String("routing_key", "order.created"),
	)

	event := OrderEvent{
		OrderID:    order.ID,
		UserID:     order.UserID,
		UserEmail:  userEmail,
		TotalPrice: order.TotalPrice,
		Status:     string(order.Status),
		RequestID:  appobs.RequestIDFromContext(ctx),
	}

	body, err := json.Marshal(event)
	if err != nil {
		appobs.ObserveOperation("order-service", "publish_order_created_event", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("failed to marshal order event", zap.Error(err))
		return
	}

	publishCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	for attempt := 0; attempt < 3; attempt++ {
		err = s.amqpCh.PublishWithContext(
			publishCtx,
			"events",
			"order.created",
			false,
			false,
			amqp.Publishing{
				ContentType: "application/json",
				Body:        body,
				Timestamp:   time.Now(),
			},
		)
		if err == nil {
			appobs.ObserveOperation("order-service", "publish_order_created_event", appobs.OutcomeSuccess, time.Since(startedAt))
			requestLog.Info("published order event")
			return
		}

		time.Sleep(time.Duration(attempt+1) * 150 * time.Millisecond)
	}

	appobs.ObserveOperation("order-service", "publish_order_created_event", appobs.OutcomeSystemError, time.Since(startedAt))
	requestLog.Error("failed to publish order event", zap.Error(err))
}

// publishCancelEvent emits the asynchronous `order.cancelled` event after a
// cancellation succeeds.
//
// Inputs:
//   - ctx carries request metadata and timeout budget.
//   - order is the cancelled order aggregate.
//
// Returns:
//   - none; publication failures are logged because the primary state change has
//     already completed.
//
// Edge cases:
//   - nil RabbitMQ channels degrade gracefully and simply skip publication.
//
// Side effects:
//   - publishes one RabbitMQ message with up to three attempts.
//   - emits observability metrics and logs.
//
// Performance:
//   - O(1) application work plus JSON marshaling and network I/O.
func (s *OrderService) publishCancelEvent(ctx context.Context, order *model.Order) {
	if s.amqpCh == nil {
		s.log.Warn("RabbitMQ channel not available, skipping cancel event publish")
		return
	}

	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("order_id", order.ID),
		zap.String("routing_key", "order.cancelled"),
	)

	event := OrderEvent{
		OrderID:    order.ID,
		UserID:     order.UserID,
		TotalPrice: order.TotalPrice,
		Status:     string(model.OrderStatusCancelled),
		RequestID:  appobs.RequestIDFromContext(ctx),
	}

	body, err := json.Marshal(event)
	if err != nil {
		appobs.ObserveOperation("order-service", "publish_order_cancel_event", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("failed to marshal cancel event", zap.Error(err))
		return
	}

	publishCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	for attempt := 0; attempt < 3; attempt++ {
		err = s.amqpCh.PublishWithContext(
			publishCtx,
			"events",
			"order.cancelled",
			false,
			false,
			amqp.Publishing{
				ContentType: "application/json",
				Body:        body,
				Timestamp:   time.Now(),
			},
		)
		if err == nil {
			appobs.ObserveOperation("order-service", "publish_order_cancel_event", appobs.OutcomeSuccess, time.Since(startedAt))
			requestLog.Info("published order cancel event")
			return
		}

		time.Sleep(time.Duration(attempt+1) * 150 * time.Millisecond)
	}

	appobs.ObserveOperation("order-service", "publish_order_cancel_event", appobs.OutcomeSystemError, time.Since(startedAt))
	requestLog.Error("failed to publish order cancel event", zap.Error(err))
}

// SetupExchange declares the RabbitMQ exchange used by order lifecycle events.
//
// Inputs:
//   - ch is the RabbitMQ channel used during service startup.
//
// Returns:
//   - nil on success.
//   - an error when the exchange declaration fails.
//
// Edge cases:
//   - callers are responsible for nil checking before invoking this helper.
//
// Side effects:
//   - creates or verifies the durable `events` topic exchange in RabbitMQ.
//
// Performance:
//   - O(1) application work plus one broker round-trip.
func SetupExchange(ch *amqp.Channel) error {
	if err := ch.ExchangeDeclare(
		"events",
		"topic",
		true,
		false,
		false,
		false,
		nil,
	); err != nil {
		return fmt.Errorf("failed to declare exchange: %w", err)
	}

	return nil
}

// recordAuditEntry persists optional audit metadata without failing the primary
// business flow.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - entry is the audit entry to persist.
//
// Returns:
//   - none.
//
// Edge cases:
//   - nil entries are ignored.
//   - repository failures are logged as warnings because audit persistence is
//     best-effort here.
//
// Side effects:
//   - writes one audit record when possible.
//   - emits a warning log on failure.
//
// Performance:
//   - O(1) application work plus one repository insert.
func (s *OrderService) recordAuditEntry(ctx context.Context, entry *model.AuditEntry) {
	if entry == nil {
		return
	}

	if err := s.repo.CreateAuditEntry(ctx, entry); err != nil {
		s.log.Warn("failed to persist audit entry",
			zap.String("entity_type", entry.EntityType),
			zap.String("entity_id", entry.EntityID),
			zap.String("action", entry.Action),
			zap.Error(err),
		)
	}
}
