package service

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

const (
	orderOutboxPollInterval = time.Second
	orderOutboxLease        = 30 * time.Second
	orderOutboxClaimLimit   = 50
	orderInboxConsumer      = "payment-lifecycle-events"
)

// buildCreatedOrderOutbox materializes the durable broker message that must be
// committed with the newly created order.
//
// Inputs:
//   - ctx carries request metadata such as request id for trace propagation.
//   - order is the newly built aggregate that will be persisted in the same transaction.
//   - userEmail is included for downstream notification consumers.
//
// Returns:
//   - a ready-to-persist outbox row.
//   - an error when event serialization fails.
//
// Edge cases:
//   - request ids may be blank for non-HTTP flows; the payload still remains valid.
//
// Side effects:
//   - none; this helper only builds an in-memory payload.
//
// Performance:
//   - O(1) application work plus JSON marshaling.
func buildCreatedOrderOutbox(ctx context.Context, order *model.Order, userEmail string) (*model.OutboxMessage, error) {
	return buildOrderOutboxMessage(ctx, order, userEmail, "order.created", string(order.Status))
}

// buildCancelledOrderOutbox materializes the durable broker message that tracks
// a cancellation side effect in the same transaction as the status change.
//
// Inputs:
//   - ctx carries request metadata such as request id for trace propagation.
//   - order is the cancelled order aggregate.
//
// Returns:
//   - a ready-to-persist outbox row.
//   - an error when event serialization fails.
//
// Edge cases:
//   - callers are responsible for setting the order status to cancelled before building the payload.
//
// Side effects:
//   - none; this helper only builds an in-memory payload.
//
// Performance:
//   - O(1) application work plus JSON marshaling.
func buildCancelledOrderOutbox(ctx context.Context, order *model.Order) (*model.OutboxMessage, error) {
	return buildOrderOutboxMessage(ctx, order, "", "order.cancelled", string(model.OrderStatusCancelled))
}

func buildOrderOutboxMessage(ctx context.Context, order *model.Order, userEmail, routingKey, status string) (*model.OutboxMessage, error) {
	eventID := uuid.NewString()
	requestID := appobs.RequestIDFromContext(ctx)
	now := time.Now()
	payload, err := json.Marshal(OrderEvent{
		EventID:    eventID,
		OrderID:    order.ID,
		UserID:     order.UserID,
		UserEmail:  userEmail,
		TotalPrice: order.TotalPrice,
		Status:     status,
		RequestID:  requestID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal order outbox payload: %w", err)
	}

	return &model.OutboxMessage{
		ID:            eventID,
		AggregateType: "order",
		AggregateID:   order.ID,
		EventType:     routingKey,
		RoutingKey:    routingKey,
		Payload:       payload,
		RequestID:     requestID,
		AvailableAt:   now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}, nil
}

// publishOrderEvent keeps a direct broker publish helper for tests and
// low-level diagnostics, while production flows enqueue the same payload via
// the outbox table.
func (s *OrderService) publishOrderEvent(ctx context.Context, order *model.Order, userEmail string) {
	message, err := buildCreatedOrderOutbox(ctx, order, userEmail)
	if err != nil {
		appobs.LoggerWithContext(s.log, ctx,
			zap.String("order_id", order.ID),
			zap.String("routing_key", "order.created"),
		).Error("failed to build direct order event payload", zap.Error(err))
		return
	}
	_ = s.publishOutboxMessage(ctx, message)
}

// publishCancelEvent keeps a direct broker publish helper for tests and
// low-level diagnostics, while production flows enqueue the same payload via
// the outbox table.
func (s *OrderService) publishCancelEvent(ctx context.Context, order *model.Order) {
	message, err := buildCancelledOrderOutbox(ctx, order)
	if err != nil {
		appobs.LoggerWithContext(s.log, ctx,
			zap.String("order_id", order.ID),
			zap.String("routing_key", "order.cancelled"),
		).Error("failed to build direct cancel event payload", zap.Error(err))
		return
	}
	_ = s.publishOutboxMessage(ctx, message)
}

// StartOutboxRelay continuously drains durable outbox rows to RabbitMQ.
//
// Scalability:
//   - the worker is safe to run on multiple replicas because claims use
//     `FOR UPDATE SKIP LOCKED` with a short lease instead of process-local state.
//
// Failure mode:
//   - when RabbitMQ is unavailable, rows remain pending in PostgreSQL and are
//     retried later rather than being lost after the order transaction commits.
func (s *OrderService) StartOutboxRelay(ctx context.Context) {
	if s.amqpCh == nil {
		s.log.Warn("RabbitMQ channel not available, order outbox relay is disabled")
		return
	}

	ticker := time.NewTicker(orderOutboxPollInterval)
	defer ticker.Stop()

	for {
		if err := s.flushOutboxBatch(ctx); err != nil && ctx.Err() == nil {
			s.log.Warn("order outbox relay batch failed", zap.Error(err))
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *OrderService) flushOutboxBatch(ctx context.Context) error {
	for {
		messages, err := s.repo.ClaimPendingOutbox(ctx, orderOutboxClaimLimit, orderOutboxLease)
		if err != nil {
			return err
		}
		if len(messages) == 0 {
			return nil
		}

		for _, message := range messages {
			publishCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			err := s.publishOutboxMessage(publishCtx, message)
			cancel()
			if err != nil {
				backoff := time.Duration(minInt(message.Attempts, 5)) * time.Second
				if markErr := s.repo.MarkOutboxFailed(ctx, message.ID, err.Error(), time.Now().Add(backoff)); markErr != nil {
					s.log.Warn("failed to mark order outbox message failed",
						zap.String("outbox_id", message.ID),
						zap.Error(markErr),
					)
				}
				continue
			}

			if err := s.repo.MarkOutboxPublished(ctx, message.ID, time.Now()); err != nil {
				s.log.Warn("failed to mark order outbox message published",
					zap.String("outbox_id", message.ID),
					zap.Error(err),
				)
			}
		}
	}
}

func (s *OrderService) publishOutboxMessage(ctx context.Context, message *model.OutboxMessage) error {
	if s.amqpCh == nil {
		return fmt.Errorf("rabbitmq channel not available")
	}

	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("outbox_id", message.ID),
		zap.String("aggregate_type", message.AggregateType),
		zap.String("aggregate_id", message.AggregateID),
		zap.String("routing_key", message.RoutingKey),
	)

	headers := amqp.Table{
		"x-event-id": message.ID,
	}
	if message.RequestID != "" {
		headers["x-request-id"] = message.RequestID
	}

	err := s.amqpCh.PublishWithContext(
		ctx,
		"events",
		message.RoutingKey,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         message.Payload,
			Timestamp:    time.Now(),
			MessageId:    message.ID,
			DeliveryMode: amqp.Persistent,
			Headers:      headers,
		},
	)
	if err != nil {
		appobs.ObserveOperation("order-service", "publish_order_outbox_event", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("failed to publish order outbox event", zap.Error(err))
		return err
	}

	appobs.ObserveOperation("order-service", "publish_order_outbox_event", appobs.OutcomeSuccess, time.Since(startedAt))
	requestLog.Info("published order outbox event")
	return nil
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

func messageIDFromDelivery(msg amqp.Delivery) string {
	if msg.MessageId != "" {
		return msg.MessageId
	}

	sum := sha256.Sum256(append([]byte(msg.RoutingKey), msg.Body...))
	return fmt.Sprintf("%x", sum[:])
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
