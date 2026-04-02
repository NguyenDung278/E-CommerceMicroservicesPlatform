package handler

import (
	"context"
	"encoding/json"
	"errors"
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
	inboxStore     inbox.Store
	retryPublisher retryPublisher
	maxRetries     int
	inboxTTL       time.Duration
	processingTTL  time.Duration
}

type retryPublisher interface {
	Publish(ctx context.Context, msg amqp.Delivery, retryCount int, firstSeenAt time.Time) error
}

func NewEventHandler(
	log *zap.Logger,
	sender email.Sender,
	inboxStore inbox.Store,
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
		inboxStore:     inboxStore,
		retryPublisher: retryPublisher,
		maxRetries:     maxRetries,
		inboxTTL:       inboxTTL,
		processingTTL:  processingTTL,
	}
}

// OrderEvent represents an order event from the Order Service.
type OrderEvent struct {
	EventID    string  `json:"event_id,omitempty"`
	OrderID    string  `json:"order_id"`
	UserID     string  `json:"user_id"`
	UserEmail  string  `json:"user_email"`
	TotalPrice float64 `json:"total_price"`
	Status     string  `json:"status"`
	RequestID  string  `json:"request_id,omitempty"`
}

// PaymentEvent represents a payment event from the Payment Service.
type PaymentEvent struct {
	EventID   string  `json:"event_id,omitempty"`
	PaymentID string  `json:"payment_id"`
	OrderID   string  `json:"order_id"`
	UserID    string  `json:"user_id"`
	UserEmail string  `json:"user_email"`
	Amount    float64 `json:"amount"`
	Status    string  `json:"status"`
	RequestID string  `json:"request_id,omitempty"`
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

	if err := h.processMessage(msg); err != nil {
		if h.inboxStore != nil {
			if releaseErr := h.inboxStore.Release(ctx, meta.MessageID); releaseErr != nil {
				requestLog.Warn("failed to release notification inbox claim", zap.Error(releaseErr))
			}
		}

		if isPermanentDeliveryError(err) {
			monitoring.ObserveDelivery(msg.RoutingKey, "permanent_failure")
			requestLog.Warn("notification event rejected to dlq", zap.Error(err))
			_ = msg.Reject(false)
			return
		}

		if meta.RetryCount >= h.maxRetries {
			monitoring.ObserveDelivery(msg.RoutingKey, "retry_exhausted")
			requestLog.Warn("notification retries exhausted, rejecting to dlq", zap.Error(err))
			_ = msg.Reject(false)
			return
		}

		retryCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		retryErr := h.retryPublisher.Publish(retryCtx, msg, meta.RetryCount+1, meta.FirstSeenAt)
		cancel()
		if retryErr != nil {
			monitoring.ObserveDelivery(msg.RoutingKey, "retry_publish_error")
			requestLog.Error("failed to publish notification retry message", zap.Error(retryErr))
			_ = msg.Nack(false, true)
			return
		}

		monitoring.ObserveDelivery(msg.RoutingKey, "retry_scheduled")
		requestLog.Warn("scheduled notification retry",
			zap.Int("next_retry_count", meta.RetryCount+1),
			zap.Error(err),
		)
		_ = msg.Ack(false)
		return
	}

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

func (h *EventHandler) processMessage(msg amqp.Delivery) error {
	switch msg.RoutingKey {
	case "order.created":
		var event OrderEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			return newPermanentDeliveryError(fmt.Errorf("failed to decode order created event: %w", err))
		}
		return h.handleOrderCreated(event)

	case "payment.completed":
		var event PaymentEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			return newPermanentDeliveryError(fmt.Errorf("failed to decode payment completed event: %w", err))
		}
		return h.handlePaymentCompleted(event)

	case "payment.failed":
		var event PaymentEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			return newPermanentDeliveryError(fmt.Errorf("failed to decode payment failed event: %w", err))
		}
		return h.handlePaymentFailed(event)

	case "payment.refunded":
		var event PaymentEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			return newPermanentDeliveryError(fmt.Errorf("failed to decode payment refunded event: %w", err))
		}
		return h.handlePaymentRefunded(event)

	case "order.cancelled":
		var event OrderEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			return newPermanentDeliveryError(fmt.Errorf("failed to decode order cancelled event: %w", err))
		}
		return h.handleOrderCancelled(event)
	}

	return newPermanentDeliveryError(fmt.Errorf("unsupported routing key %s", msg.RoutingKey))
}

func (h *EventHandler) handleOrderCreated(event OrderEvent) error {
	h.log.Info("notification: order confirmation",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("status", event.Status),
	)
	return h.sendEmail(event.UserEmail, "Xac nhan don hang", fmt.Sprintf(
		"Chao ban,\n\nDon hang %s da duoc tao thanh cong.\nTong thanh toan: %.2f\nTrang thai: %s\n\nCam on ban da mua hang tai ND Shop.",
		event.OrderID,
		event.TotalPrice,
		event.Status,
	))
}

func (h *EventHandler) handlePaymentCompleted(event PaymentEvent) error {
	h.log.Info("notification: payment completed",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("payment_id", event.PaymentID),
	)
	return h.sendEmail(event.UserEmail, "Bien lai thanh toan", fmt.Sprintf(
		"Chao ban,\n\nThanh toan %s cho don hang %s da thanh cong.\nSo tien: %.2f\n\nCam on ban da mua hang tai ND Shop.",
		event.PaymentID,
		event.OrderID,
		event.Amount,
	))
}

func (h *EventHandler) handlePaymentFailed(event PaymentEvent) error {
	h.log.Warn("notification: payment failed",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("payment_id", event.PaymentID),
	)
	return h.sendEmail(event.UserEmail, "Thanh toan that bai", fmt.Sprintf(
		"Chao ban,\n\nThanh toan %s cho don hang %s da that bai.\nSo tien: %.2f\nVui long thu lai hoac chon phuong thuc thanh toan khac.",
		event.PaymentID,
		event.OrderID,
		event.Amount,
	))
}

func (h *EventHandler) handlePaymentRefunded(event PaymentEvent) error {
	h.log.Info("notification: payment refunded",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("payment_id", event.PaymentID),
	)
	return h.sendEmail(event.UserEmail, "Hoan tien thanh cong", fmt.Sprintf(
		"Chao ban,\n\nKhoan hoan tien %s cho don hang %s da duoc xu ly thanh cong.\nSo tien hoan: %.2f\n\nNeu ban can ho tro them, vui long lien he chung toi.",
		event.PaymentID,
		event.OrderID,
		event.Amount,
	))
}

func (h *EventHandler) handleOrderCancelled(event OrderEvent) error {
	h.log.Info("notification: order cancelled",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("status", event.Status),
	)
	return h.sendEmail(event.UserEmail, "Don hang da bi huy", fmt.Sprintf(
		"Chao ban,\n\nDon hang %s da duoc huy thanh cong.\nSo tien: %.2f\n\nNeu ban can ho tro, vui long lien he chung toi.",
		event.OrderID,
		event.TotalPrice,
	))
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

type deliveryError struct {
	err       error
	permanent bool
}

func (e *deliveryError) Error() string {
	return e.err.Error()
}

func (e *deliveryError) Unwrap() error {
	return e.err
}

func newPermanentDeliveryError(err error) error {
	if err == nil {
		return nil
	}
	return &deliveryError{err: err, permanent: true}
}

func newTransientDeliveryError(err error) error {
	if err == nil {
		return nil
	}
	return &deliveryError{err: err}
}

func isPermanentDeliveryError(err error) bool {
	var deliveryErr *deliveryError
	return errors.As(err, &deliveryErr) && deliveryErr.permanent
}
