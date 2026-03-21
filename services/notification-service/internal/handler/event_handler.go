package handler

import (
	"encoding/json"
	"fmt"
	"strings"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/email"
)

// EventHandler processes RabbitMQ events.
//
// WHY A SEPARATE HANDLER PACKAGE: Even though this service has no HTTP endpoints,
// we maintain the same project structure for consistency. The "handler" here
// handles incoming messages instead of HTTP requests.
type EventHandler struct {
	log    *zap.Logger
	sender email.Sender
}

func NewEventHandler(log *zap.Logger, sender email.Sender) *EventHandler {
	return &EventHandler{log: log, sender: sender}
}

// OrderEvent represents an order event from the Order Service.
type OrderEvent struct {
	OrderID    string  `json:"order_id"`
	UserID     string  `json:"user_id"`
	UserEmail  string  `json:"user_email"`
	TotalPrice float64 `json:"total_price"`
	Status     string  `json:"status"`
}

// PaymentEvent represents a payment event from the Payment Service.
type PaymentEvent struct {
	PaymentID string  `json:"payment_id"`
	OrderID   string  `json:"order_id"`
	UserID    string  `json:"user_id"`
	UserEmail string  `json:"user_email"`
	Amount    float64 `json:"amount"`
	Status    string  `json:"status"`
}

// HandleMessage processes a single RabbitMQ message based on its routing key.
//
// IN PRODUCTION: This would call real notification providers:
//   - Email: SendGrid, SES, Mailgun
//   - SMS: Twilio, Vonage
//   - Push: Firebase Cloud Messaging
//
// FOR THIS DEMO: We log the notification that would be sent.
func (h *EventHandler) HandleMessage(msg amqp.Delivery) {
	h.log.Info("received event",
		zap.String("routing_key", msg.RoutingKey),
		zap.ByteString("body", msg.Body),
	)

	switch msg.RoutingKey {
	case "order.created":
		var event OrderEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			h.log.Error("failed to unmarshal order event", zap.Error(err))
			// Negative acknowledgement — message will be requeued.
			msg.Nack(false, true)
			return
		}
		if err := h.handleOrderCreated(event); err != nil {
			h.log.Error("failed to send order notification", zap.Error(err))
			msg.Nack(false, true)
			return
		}

	case "payment.completed":
		var event PaymentEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			h.log.Error("failed to unmarshal payment event", zap.Error(err))
			msg.Nack(false, true)
			return
		}
		if err := h.handlePaymentCompleted(event); err != nil {
			h.log.Error("failed to send payment completion notification", zap.Error(err))
			msg.Nack(false, true)
			return
		}

	case "payment.failed":
		var event PaymentEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			h.log.Error("failed to unmarshal payment event", zap.Error(err))
			msg.Nack(false, true)
			return
		}
		if err := h.handlePaymentFailed(event); err != nil {
			h.log.Error("failed to send payment failure notification", zap.Error(err))
			msg.Nack(false, true)
			return
		}

	case "order.cancelled":
		var event OrderEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			h.log.Error("failed to unmarshal order cancel event", zap.Error(err))
			msg.Nack(false, true)
			return
		}
		h.handleOrderCancelled(event)

	default:
		h.log.Warn("received unknown event type", zap.String("routing_key", msg.RoutingKey))
	}

	// Acknowledge the message — RabbitMQ will remove it from the queue.
	msg.Ack(false)
}

func (h *EventHandler) handleOrderCreated(event OrderEvent) error {
	h.log.Info("📧 NOTIFICATION: Order confirmation",
		zap.String("user_id", event.UserID),
		zap.String("user_email", event.UserEmail),
		zap.String("order_id", event.OrderID),
		zap.Float64("total", event.TotalPrice),
		zap.String("message", "Your order has been placed successfully!"),
	)
	return h.sendEmail(event.UserEmail, "Xac nhan don hang", fmt.Sprintf(
		"Chao ban,\n\nDon hang %s da duoc tao thanh cong.\nTong thanh toan: %.2f\nTrang thai: %s\n\nCam on ban da mua hang tai ND Shop.",
		event.OrderID,
		event.TotalPrice,
		event.Status,
	))
}

func (h *EventHandler) handlePaymentCompleted(event PaymentEvent) error {
	h.log.Info("📧 NOTIFICATION: Payment receipt",
		zap.String("user_id", event.UserID),
		zap.String("user_email", event.UserEmail),
		zap.String("order_id", event.OrderID),
		zap.String("payment_id", event.PaymentID),
		zap.Float64("amount", event.Amount),
		zap.String("message", "Your payment has been processed successfully!"),
	)
	return h.sendEmail(event.UserEmail, "Bien lai thanh toan", fmt.Sprintf(
		"Chao ban,\n\nThanh toan %s cho don hang %s da thanh cong.\nSo tien: %.2f\n\nCam on ban da mua hang tai ND Shop.",
		event.PaymentID,
		event.OrderID,
		event.Amount,
	))
}

func (h *EventHandler) handlePaymentFailed(event PaymentEvent) error {
	h.log.Warn("📧 NOTIFICATION: Payment failed",
		zap.String("user_id", event.UserID),
		zap.String("user_email", event.UserEmail),
		zap.String("order_id", event.OrderID),
		zap.String("payment_id", event.PaymentID),
		zap.Float64("amount", event.Amount),
		zap.String("message", "Your payment has failed. Please try again."),
	)
	return h.sendEmail(event.UserEmail, "Thanh toan that bai", fmt.Sprintf(
		"Chao ban,\n\nThanh toan %s cho don hang %s da that bai.\nSo tien: %.2f\nVui long thu lai hoac chon phuong thuc thanh toan khac.",
		event.PaymentID,
		event.OrderID,
		event.Amount,
	))
}

func (h *EventHandler) sendEmail(to, subject, body string) error {
	if strings.TrimSpace(to) == "" {
		h.log.Warn("notification event missing user email, skipping email delivery")
		return nil
	}

	return h.sender.Send(email.Message{
		To:      []string{to},
		Subject: subject,
		Body:    body,
	})
}

func (h *EventHandler) handleOrderCancelled(event OrderEvent) {
	h.log.Info("📧 NOTIFICATION: Order cancelled",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.Float64("total", event.TotalPrice),
		zap.String("message", "Your order has been cancelled."),
	)

	if event.UserEmail != "" {
		_ = h.sendEmail(event.UserEmail, "Don hang da bi huy", fmt.Sprintf(
			"Chao ban,\n\nDon hang %s da duoc huy thanh cong.\nSo tien: %.2f\n\nNeu ban can ho tro, vui long lien he chung toi.",
			event.OrderID,
			event.TotalPrice,
		))
	}
}
