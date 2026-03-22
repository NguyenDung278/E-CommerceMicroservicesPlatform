package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

type PaymentLifecycleEvent struct {
	PaymentID         string  `json:"payment_id"`
	OrderID           string  `json:"order_id"`
	UserID            string  `json:"user_id"`
	Amount            float64 `json:"amount"`
	Status            string  `json:"status"`
	TransactionType   string  `json:"transaction_type"`
	NetPaidAmount     float64 `json:"net_paid_amount"`
	OutstandingAmount float64 `json:"outstanding_amount"`
	FullyPaid         bool    `json:"fully_paid"`
	FullyRefunded     bool    `json:"fully_refunded"`
	GatewayProvider   string  `json:"gateway_provider"`
}

func StartPaymentEventConsumer(ch *amqp.Channel, log *zap.Logger, service *OrderService) error {
	if ch == nil {
		return nil
	}

	queue, err := ch.QueueDeclare(
		"order-service-payment-events",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to declare payment event queue: %w", err)
	}

	for _, routingKey := range []string{"payment.completed", "payment.refunded", "payment.failed"} {
		if err := ch.QueueBind(queue.Name, routingKey, "events", false, nil); err != nil {
			return fmt.Errorf("failed to bind payment event queue: %w", err)
		}
	}

	msgs, err := ch.Consume(queue.Name, "", false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("failed to consume payment events: %w", err)
	}

	go func() {
		for msg := range msgs {
			if err := service.handlePaymentEventMessage(msg); err != nil {
				log.Error("failed to handle payment lifecycle event",
					zap.String("routing_key", msg.RoutingKey),
					zap.ByteString("body", msg.Body),
					zap.Error(err),
				)
				_ = msg.Nack(false, true)
				continue
			}
			_ = msg.Ack(false)
		}
	}()

	return nil
}

func (s *OrderService) handlePaymentEventMessage(msg amqp.Delivery) error {
	var event PaymentLifecycleEvent
	if err := json.Unmarshal(msg.Body, &event); err != nil {
		return fmt.Errorf("failed to decode payment event: %w", err)
	}

	order, err := s.repo.GetByID(context.Background(), event.OrderID)
	if err != nil {
		return err
	}
	if order == nil {
		return nil
	}

	switch msg.RoutingKey {
	case "payment.completed":
		if !event.FullyPaid || order.Status != model.OrderStatusPending {
			return nil
		}
		return s.repo.UpdateStatus(context.Background(), order.ID, model.OrderStatusPaid, "payment-service", "system", paymentEventMessage("paid", event))
	case "payment.refunded":
		if !event.FullyRefunded || order.Status == model.OrderStatusRefunded {
			return nil
		}
		return s.repo.UpdateStatus(context.Background(), order.ID, model.OrderStatusRefunded, "payment-service", "system", paymentEventMessage("refunded", event))
	default:
		return nil
	}
}

func paymentEventMessage(targetStatus string, event PaymentLifecycleEvent) string {
	if strings.EqualFold(targetStatus, "paid") {
		return fmt.Sprintf(
			"order marked paid after payment %s completed via %s (outstanding %.2f)",
			event.PaymentID,
			event.GatewayProvider,
			event.OutstandingAmount,
		)
	}

	return fmt.Sprintf(
		"order marked refunded after payment %s refund completed (net paid %.2f)",
		event.PaymentID,
		event.NetPaidAmount,
	)
}
