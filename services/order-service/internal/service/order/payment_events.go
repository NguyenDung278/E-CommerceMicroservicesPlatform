package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
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
	RequestID         string  `json:"request_id,omitempty"`
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
					zap.String("message_id", messageIDFromDelivery(msg)),
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
	startedAt := time.Now()
	var event PaymentLifecycleEvent
	if err := json.Unmarshal(msg.Body, &event); err != nil {
		appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeSystemError, time.Since(startedAt))
		return fmt.Errorf("failed to decode payment event: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if event.RequestID != "" {
		ctx = appobs.WithRequestID(ctx, event.RequestID)
	}
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("message_id", messageIDFromDelivery(msg)),
		zap.String("routing_key", msg.RoutingKey),
		zap.String("order_id", event.OrderID),
		zap.String("payment_id", event.PaymentID),
		zap.String("payment_status", event.Status),
	)

	switch msg.RoutingKey {
	case "payment.completed":
		if !event.FullyPaid {
			appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeBusinessError, time.Since(startedAt))
			requestLog.Info("payment completed event did not trigger status transition", zap.Bool("fully_paid", event.FullyPaid))
			return nil
		}
		result, err := s.repo.ApplyInboxStatusTransition(ctx, &model.InboxMessage{
			Consumer:   orderInboxConsumer,
			MessageID:  messageIDFromDelivery(msg),
			RoutingKey: msg.RoutingKey,
			CreatedAt:  time.Now(),
		}, event.OrderID, model.OrderStatusPending, model.OrderStatusPaid, "payment-service", "system", paymentEventMessage("paid", event))
		if err != nil {
			appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeSystemError, time.Since(startedAt))
			requestLog.Error("failed to transition order to paid from payment event", zap.Error(err))
			return err
		}
		if result.Duplicate {
			appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeSuccess, time.Since(startedAt))
			requestLog.Info("payment completed event skipped because inbox message already exists")
			return nil
		}
		if !result.OrderFound {
			appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeBusinessError, time.Since(startedAt))
			requestLog.Warn("payment event ignored because order no longer exists")
			return nil
		}
		if !result.Transitioned {
			appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeBusinessError, time.Since(startedAt))
			requestLog.Info("payment completed event did not trigger status transition",
				zap.String("current_order_status", string(result.PreviousStatus)),
			)
			return nil
		}
		appobs.RecordStateTransition("order-service", "order", string(result.PreviousStatus), string(model.OrderStatusPaid), appobs.OutcomeSuccess)
		appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeSuccess, time.Since(startedAt))
		requestLog.Info("order transitioned to paid from payment event")
		return nil
	case "payment.refunded":
		if !event.FullyRefunded {
			appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeBusinessError, time.Since(startedAt))
			requestLog.Info("payment refunded event did not trigger status transition", zap.Bool("fully_refunded", event.FullyRefunded))
			return nil
		}
		result, err := s.repo.ApplyInboxStatusTransition(ctx, &model.InboxMessage{
			Consumer:   orderInboxConsumer,
			MessageID:  messageIDFromDelivery(msg),
			RoutingKey: msg.RoutingKey,
			CreatedAt:  time.Now(),
		}, event.OrderID, "", model.OrderStatusRefunded, "payment-service", "system", paymentEventMessage("refunded", event))
		if err != nil {
			appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeSystemError, time.Since(startedAt))
			requestLog.Error("failed to transition order to refunded from payment event", zap.Error(err))
			return err
		}
		if result.Duplicate {
			appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeSuccess, time.Since(startedAt))
			requestLog.Info("payment refunded event skipped because inbox message already exists")
			return nil
		}
		if !result.OrderFound {
			appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeBusinessError, time.Since(startedAt))
			requestLog.Warn("payment event ignored because order no longer exists")
			return nil
		}
		if !result.Transitioned {
			appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeBusinessError, time.Since(startedAt))
			requestLog.Info("payment refunded event did not trigger status transition",
				zap.String("current_order_status", string(result.PreviousStatus)),
			)
			return nil
		}
		appobs.RecordStateTransition("order-service", "order", string(result.PreviousStatus), string(model.OrderStatusRefunded), appobs.OutcomeSuccess)
		appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeSuccess, time.Since(startedAt))
		requestLog.Info("order transitioned to refunded from payment event")
		return nil
	default:
		appobs.ObserveOperation("order-service", "payment_event_consume", appobs.OutcomeBusinessError, time.Since(startedAt))
		requestLog.Info("payment event ignored because routing key is not handled")
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
