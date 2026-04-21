package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

const (
	paymentOutboxPollInterval = time.Second
	paymentOutboxLease        = 30 * time.Second
	paymentOutboxClaimLimit   = 50
	paymentWebhookConsumer    = "momo-webhook"
)

// buildPaymentOutboxMessage materializes the durable broker message that must
// be committed with the authoritative payment state change.
//
// Inputs:
//   - ctx carries request metadata such as request id for trace propagation.
//   - payment is the enriched payment state to publish.
//   - userEmail is forwarded for downstream notification consumers.
//
// Returns:
//   - a ready-to-persist outbox row.
//   - an error when event serialization fails.
//
// Edge cases:
//   - callers may pass an empty email for system-driven callbacks.
//
// Side effects:
//   - none; this helper only builds an in-memory payload.
//
// Performance:
//   - O(1) application work plus JSON marshaling.
func buildPaymentOutboxMessage(ctx context.Context, payment *model.Payment, userEmail string) (*model.OutboxMessage, error) {
	eventID := uuid.NewString()
	requestID := appobs.RequestIDFromContext(ctx)
	now := time.Now()
	routingKey := paymentEventRoutingKey(payment)
	payload, err := json.Marshal(PaymentEvent{
		EventID:            eventID,
		PaymentID:          payment.ID,
		OrderID:            payment.OrderID,
		UserID:             payment.UserID,
		UserEmail:          userEmail,
		Amount:             payment.Amount,
		Status:             string(payment.Status),
		TransactionType:    string(payment.TransactionType),
		NetPaidAmount:      payment.NetPaidAmount,
		OutstandingAmount:  payment.OutstandingAmount,
		FullyPaid:          payment.OutstandingAmount <= 0 && payment.TransactionType == model.PaymentTransactionTypeCharge && payment.Status == model.PaymentStatusCompleted,
		FullyRefunded:      payment.NetPaidAmount <= 0 && payment.TransactionType == model.PaymentTransactionTypeRefund && payment.Status == model.PaymentStatusRefunded,
		GatewayProvider:    payment.GatewayProvider,
		GatewayTransaction: payment.GatewayTransactionID,
		RequestID:          requestID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payment outbox payload: %w", err)
	}

	return &model.OutboxMessage{
		ID:            eventID,
		AggregateType: "payment",
		AggregateID:   payment.ID,
		EventType:     routingKey,
		RoutingKey:    routingKey,
		Payload:       payload,
		RequestID:     requestID,
		AvailableAt:   now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}, nil
}

// publishPaymentEvent keeps a direct broker publish helper for tests and
// low-level diagnostics, while production flows enqueue the same payload via
// the outbox table.
func (s *PaymentService) publishPaymentEvent(ctx context.Context, payment *model.Payment, userEmail string) {
	message, err := buildPaymentOutboxMessage(ctx, payment, userEmail)
	if err != nil {
		appobs.LoggerWithContext(s.log, ctx,
			zap.String("payment_id", payment.ID),
			zap.String("order_id", payment.OrderID),
		).Error("failed to build direct payment event payload", zap.Error(err))
		return
	}
	_ = s.publishOutboxMessage(ctx, message)
}

// StartOutboxRelay continuously drains durable outbox rows to RabbitMQ.
//
// Scalability:
//   - the relay stays stateless and replica-safe because claims use
//     `FOR UPDATE SKIP LOCKED` instead of in-process ownership.
//
// Failure mode:
//   - broker outages delay publication but do not lose events because the row
//     remains durable in PostgreSQL until a future relay attempt succeeds.
func (s *PaymentService) StartOutboxRelay(ctx context.Context) {
	if s.amqpCh == nil {
		s.log.Warn("RabbitMQ channel not available, payment outbox relay is disabled")
		return
	}

	ticker := time.NewTicker(paymentOutboxPollInterval)
	defer ticker.Stop()

	for {
		if err := s.flushOutboxBatch(ctx); err != nil && ctx.Err() == nil {
			s.log.Warn("payment outbox relay batch failed", zap.Error(err))
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *PaymentService) flushOutboxBatch(ctx context.Context) error {
	for {
		messages, err := s.repo.ClaimPendingOutbox(ctx, paymentOutboxClaimLimit, paymentOutboxLease)
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
					s.log.Warn("failed to mark payment outbox message failed",
						zap.String("outbox_id", message.ID),
						zap.Error(markErr),
					)
				}
				continue
			}

			if err := s.repo.MarkOutboxPublished(ctx, message.ID, time.Now()); err != nil {
				s.log.Warn("failed to mark payment outbox message published",
					zap.String("outbox_id", message.ID),
					zap.Error(err),
				)
			}
		}
	}
}

func (s *PaymentService) publishOutboxMessage(ctx context.Context, message *model.OutboxMessage) error {
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
		appobs.ObserveOperation("payment-service", "publish_payment_outbox_event", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("failed to publish payment outbox event", zap.Error(err))
		return err
	}

	appobs.ObserveOperation("payment-service", "publish_payment_outbox_event", appobs.OutcomeSuccess, time.Since(startedAt))
	requestLog.Info("published payment outbox event")
	return nil
}

// paymentEventRoutingKey maps a payment state into the RabbitMQ routing key used
// by downstream consumers.
//
// Inputs:
//   - payment is the payment lifecycle snapshot being published.
//
// Returns:
//   - the routing key that best represents the current lifecycle event.
//
// Edge cases:
//   - refund events take precedence over failure and completion semantics.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func paymentEventRoutingKey(payment *model.Payment) string {
	if payment.TransactionType == model.PaymentTransactionTypeRefund && payment.Status == model.PaymentStatusRefunded {
		return "payment.refunded"
	}
	if payment.Status == model.PaymentStatusFailed {
		return "payment.failed"
	}
	return "payment.completed"
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
