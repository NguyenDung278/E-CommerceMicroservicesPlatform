package handler

import (
	"encoding/json"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

// EventHandler processes RabbitMQ events.
//
// WHY A SEPARATE HANDLER PACKAGE: Even though this service has no HTTP endpoints,
// we maintain the same project structure for consistency. The "handler" here
// handles incoming messages instead of HTTP requests.
type EventHandler struct {
	log *zap.Logger
}

func NewEventHandler(log *zap.Logger) *EventHandler {
	return &EventHandler{log: log}
}

// OrderEvent represents an order event from the Order Service.
type OrderEvent struct {
	OrderID    string  `json:"order_id"`
	UserID     string  `json:"user_id"`
	TotalPrice float64 `json:"total_price"`
	Status     string  `json:"status"`
}

// PaymentEvent represents a payment event from the Payment Service.
type PaymentEvent struct {
	PaymentID string  `json:"payment_id"`
	OrderID   string  `json:"order_id"`
	UserID    string  `json:"user_id"`
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
		h.handleOrderCreated(event)

	case "payment.completed":
		var event PaymentEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			h.log.Error("failed to unmarshal payment event", zap.Error(err))
			msg.Nack(false, true)
			return
		}
		h.handlePaymentCompleted(event)

	case "payment.failed":
		var event PaymentEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			h.log.Error("failed to unmarshal payment event", zap.Error(err))
			msg.Nack(false, true)
			return
		}
		h.handlePaymentFailed(event)

	default:
		h.log.Warn("received unknown event type", zap.String("routing_key", msg.RoutingKey))
	}

	// Acknowledge the message — RabbitMQ will remove it from the queue.
	msg.Ack(false)
}

func (h *EventHandler) handleOrderCreated(event OrderEvent) {
	// IN PRODUCTION: Send order confirmation email.
	h.log.Info("📧 NOTIFICATION: Order confirmation",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.Float64("total", event.TotalPrice),
		zap.String("message", "Your order has been placed successfully!"),
	)
}

func (h *EventHandler) handlePaymentCompleted(event PaymentEvent) {
	// IN PRODUCTION: Send payment receipt email.
	h.log.Info("📧 NOTIFICATION: Payment receipt",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("payment_id", event.PaymentID),
		zap.Float64("amount", event.Amount),
		zap.String("message", "Your payment has been processed successfully!"),
	)
}

func (h *EventHandler) handlePaymentFailed(event PaymentEvent) {
	// IN PRODUCTION: Send payment failure notification.
	h.log.Warn("📧 NOTIFICATION: Payment failed",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("payment_id", event.PaymentID),
		zap.Float64("amount", event.Amount),
		zap.String("message", "Your payment has failed. Please try again."),
	)
}
