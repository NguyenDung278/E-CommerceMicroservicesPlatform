package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/mail"
	"strings"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/email"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/inbox"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/messaging"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/monitoring"
)

// EventHandler processes RabbitMQ events with bounded retries, duplicate
// protection, and DLQ-safe failure classification.
type EventHandler struct {
	log            *zap.Logger
	sender         email.Sender
	preferences    notificationPreferenceReader
	inboxStore     inbox.Store
	historyStore   inbox.HistoryStore
	retryPublisher retryPublisher
	maxRetries     int
	inboxTTL       time.Duration
	processingTTL  time.Duration
}

type notificationPreferenceReader interface {
	PreferenceMap(ctx context.Context, userID string) (map[string]bool, error)
}

type retryPublisher interface {
	Publish(ctx context.Context, msg amqp.Delivery, retryCount int, firstSeenAt time.Time) (time.Time, time.Duration, error)
}

func NewEventHandler(
	log *zap.Logger,
	sender email.Sender,
	preferences notificationPreferenceReader,
	inboxStore inbox.Store,
	historyStore inbox.HistoryStore,
	retryPublisher retryPublisher,
	maxRetries int,
	inboxTTL time.Duration,
	processingTTL time.Duration,
) *EventHandler {
	if maxRetries < 0 {
		maxRetries = 0
	}
	if inboxTTL <= 0 {
		inboxTTL = 7 * 24 * time.Hour
	}
	if processingTTL <= 0 {
		processingTTL = 5 * time.Minute
	}

	return &EventHandler{
		log:            log,
		sender:         sender,
		preferences:    preferences,
		inboxStore:     inboxStore,
		historyStore:   historyStore,
		retryPublisher: retryPublisher,
		maxRetries:     maxRetries,
		inboxTTL:       inboxTTL,
		processingTTL:  processingTTL,
	}
}

// HandleMessage processes one RabbitMQ delivery with duplicate protection,
// retry scheduling, and DLQ handoff for permanent failures.
//
// Scalability:
//   - the handler remains stateless at the process layer; duplicate suppression
//     is coordinated through Redis so multiple replicas can share one queue safely.
//
// Async reliability:
//   - transient failures are re-enqueued via the retry queue with a bounded
//     retry count.
//   - permanent failures are rejected to the DLQ instead of looping forever.
//
// Security:
//   - raw payloads are never logged because they may contain PII such as email
//     addresses or payment context.
func (h *EventHandler) HandleMessage(ctx context.Context, msg amqp.Delivery) {
	meta := messaging.BuildDeliveryMetadata(msg)
	requestLog := h.log.With(
		zap.String("routing_key", msg.RoutingKey),
		zap.String("message_id", meta.MessageID),
		zap.Int("retry_count", meta.RetryCount),
	)

	if meta.RetryCount > 0 {
		monitoring.ObserveRetryAge(msg.RoutingKey, time.Since(meta.FirstSeenAt))
	}

	if h.inboxStore != nil {
		claimStatus, err := h.inboxStore.Claim(ctx, meta.MessageID, h.processingTTL)
		if err != nil {
			monitoring.ObserveDelivery(msg.RoutingKey, "inbox_error")
			requestLog.Error("failed to claim notification inbox message", zap.Error(err))
			_ = msg.Nack(false, true)
			return
		}

		switch claimStatus {
		case inbox.AlreadyProcessed:
			monitoring.ObserveDuplicate(msg.RoutingKey)
			monitoring.ObserveDelivery(msg.RoutingKey, "duplicate")
			requestLog.Info("skipped duplicate notification event")
			_ = msg.Ack(false)
			return
		case inbox.AlreadyClaimed:
			monitoring.ObserveDelivery(msg.RoutingKey, "claim_busy")
			requestLog.Warn("notification inbox claim already exists, requeueing message")
			_ = msg.Nack(false, true)
			return
		}
	}

	historyItem, err := h.processMessage(ctx, msg, meta.MessageID, msg.RoutingKey, meta.FirstSeenAt)
	if err != nil {
		if h.inboxStore != nil {
			if releaseErr := h.inboxStore.Release(ctx, meta.MessageID); releaseErr != nil {
				requestLog.Warn("failed to release notification inbox claim", zap.Error(releaseErr))
			}
		}

		if isPermanentDeliveryError(err) {
			h.appendHistoryBestEffort(ctx, requestLog, buildRetryAuditItem(
				meta.MessageID,
				msg.RoutingKey,
				meta.FirstSeenAt,
				meta.RetryCount,
				"failed",
				err.Error(),
				nil,
			))
			monitoring.ObserveDelivery(msg.RoutingKey, "permanent_failure")
			requestLog.Warn("notification event rejected to dlq", zap.Error(err))
			_ = msg.Reject(false)
			return
		}

		if meta.RetryCount >= h.maxRetries {
			h.appendHistoryBestEffort(ctx, requestLog, buildRetryAuditItem(
				meta.MessageID,
				msg.RoutingKey,
				meta.FirstSeenAt,
				meta.RetryCount,
				"retry_exhausted",
				err.Error(),
				nil,
			))
			monitoring.ObserveDelivery(msg.RoutingKey, "retry_exhausted")
			requestLog.Warn("notification retries exhausted, rejecting to dlq", zap.Error(err))
			_ = msg.Reject(false)
			return
		}

		retryCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		nextRetryAt, delay, retryErr := h.retryPublisher.Publish(retryCtx, msg, meta.RetryCount+1, meta.FirstSeenAt)
		cancel()
		if retryErr != nil {
			monitoring.ObserveDelivery(msg.RoutingKey, "retry_publish_error")
			requestLog.Error("failed to publish notification retry message", zap.Error(retryErr))
			_ = msg.Nack(false, true)
			return
		}

		monitoring.ObserveRetryDelay(msg.RoutingKey, delay)
		h.appendHistoryBestEffort(ctx, requestLog, buildRetryAuditItem(
			meta.MessageID,
			msg.RoutingKey,
			meta.FirstSeenAt,
			meta.RetryCount+1,
			"retry_scheduled",
			err.Error(),
			&nextRetryAt,
		))
		monitoring.ObserveDelivery(msg.RoutingKey, "retry_scheduled")
		requestLog.Warn("scheduled notification retry",
			zap.Int("next_retry_count", meta.RetryCount+1),
			zap.Duration("retry_delay", delay),
			zap.Time("next_retry_at", nextRetryAt),
			zap.Error(err),
		)
		_ = msg.Ack(false)
		return
	}

	h.appendHistoryBestEffort(ctx, requestLog, historyItem)

	if h.inboxStore != nil {
		if err := h.inboxStore.MarkProcessed(ctx, meta.MessageID, h.inboxTTL); err != nil {
			// Keep the processing lock alive for its short TTL rather than deleting it,
			// which reduces the chance of immediate duplicate delivery after a successful send.
			monitoring.ObserveDelivery(msg.RoutingKey, "processed_marker_error")
			requestLog.Warn("notification delivered but processed marker could not be stored", zap.Error(err))
		}
	}

	monitoring.ObserveDelivery(msg.RoutingKey, "success")
	requestLog.Info("notification event processed successfully")
	_ = msg.Ack(false)
}

func (h *EventHandler) processMessage(
	ctx context.Context,
	msg amqp.Delivery,
	messageID string,
	routingKey string,
	createdAt time.Time,
) (*inbox.HistoryItem, error) {
	switch msg.RoutingKey {
	case "order.created":
		var event OrderEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			return nil, newPermanentDeliveryError(fmt.Errorf("failed to decode order created event: %w", err))
		}
		return h.handleOrderCreated(ctx, messageID, routingKey, createdAt, event)

	case "payment.completed":
		var event PaymentEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			return nil, newPermanentDeliveryError(fmt.Errorf("failed to decode payment completed event: %w", err))
		}
		return h.handlePaymentCompleted(ctx, messageID, routingKey, createdAt, event)

	case "payment.failed":
		var event PaymentEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			return nil, newPermanentDeliveryError(fmt.Errorf("failed to decode payment failed event: %w", err))
		}
		return h.handlePaymentFailed(ctx, messageID, routingKey, createdAt, event)

	case "payment.refunded":
		var event PaymentEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			return nil, newPermanentDeliveryError(fmt.Errorf("failed to decode payment refunded event: %w", err))
		}
		return h.handlePaymentRefunded(ctx, messageID, routingKey, createdAt, event)

	case "order.cancelled":
		var event OrderEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			return nil, newPermanentDeliveryError(fmt.Errorf("failed to decode order cancelled event: %w", err))
		}
		return h.handleOrderCancelled(ctx, messageID, routingKey, createdAt, event)
	}

	if strings.HasPrefix(msg.RoutingKey, "return.") {
		var event ReturnEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			return nil, newPermanentDeliveryError(fmt.Errorf("failed to decode return event: %w", err))
		}
		return h.handleReturnEvent(ctx, messageID, routingKey, createdAt, event)
	}

	return nil, newPermanentDeliveryError(fmt.Errorf("unsupported routing key %s", msg.RoutingKey))
}

func (h *EventHandler) appendHistoryBestEffort(ctx context.Context, requestLog *zap.Logger, item *inbox.HistoryItem) {
	if h.historyStore == nil || item == nil {
		return
	}
	if err := h.historyStore.Append(ctx, *item, h.inboxTTL); err != nil {
		requestLog.Warn("failed to append notification history item", zap.Error(err))
	}
}

func (h *EventHandler) sendEmail(to, subject, body string) error {
	to = strings.TrimSpace(to)
	if to == "" {
		h.log.Warn("notification event missing user email, skipping email delivery")
		return nil
	}

	if _, err := mail.ParseAddress(to); err != nil {
		h.log.Warn("notification event contains invalid user email",
			zap.String("recipient", to),
			zap.Error(err),
		)
		return nil
	}

	if err := h.sender.Send(email.Message{
		To:      []string{to},
		Subject: subject,
		Body:    body,
	}); err != nil {
		return newTransientDeliveryError(err)
	}

	return nil
}
