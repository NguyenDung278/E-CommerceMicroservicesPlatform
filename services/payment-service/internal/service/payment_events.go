package service

import (
	"context"
	"encoding/json"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

// publishPaymentEvent emits an asynchronous lifecycle event so order and
// notification services stay in sync with payment state.
//
// Inputs:
//   - ctx carries request metadata and timeout budget.
//   - payment is the enriched payment state to publish.
//   - userEmail is forwarded for downstream notification consumers.
//
// Returns:
//   - none; publication failures are logged because payment persistence already
//     succeeded.
//
// Edge cases:
//   - nil RabbitMQ channels degrade gracefully and skip publication.
//
// Side effects:
//   - publishes one RabbitMQ message with up to three attempts.
//   - emits observability metrics and logs.
//
// Performance:
//   - O(1) application work plus JSON marshaling and network I/O.
func (s *PaymentService) publishPaymentEvent(ctx context.Context, payment *model.Payment, userEmail string) {
	if s.amqpCh == nil {
		return
	}

	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("payment_id", payment.ID),
		zap.String("order_id", payment.OrderID),
	)

	event := PaymentEvent{
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
		RequestID:          appobs.RequestIDFromContext(ctx),
	}

	body, err := json.Marshal(event)
	if err != nil {
		appobs.ObserveOperation("payment-service", "publish_payment_event", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("failed to marshal payment event", zap.Error(err))
		return
	}

	publishCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	routingKey := paymentEventRoutingKey(payment)
	for attempt := 0; attempt < 3; attempt++ {
		err = s.amqpCh.PublishWithContext(
			publishCtx,
			"events",
			routingKey,
			false,
			false,
			amqp.Publishing{
				ContentType: "application/json",
				Body:        body,
				Timestamp:   time.Now(),
			},
		)
		if err == nil {
			appobs.ObserveOperation("payment-service", "publish_payment_event", appobs.OutcomeSuccess, time.Since(startedAt))
			requestLog.Info("published payment event",
				zap.String("routing_key", routingKey),
				zap.String("payment_status", string(payment.Status)),
			)
			return
		}

		time.Sleep(time.Duration(attempt+1) * 150 * time.Millisecond)
	}

	appobs.ObserveOperation("payment-service", "publish_payment_event", appobs.OutcomeSystemError, time.Since(startedAt))
	requestLog.Error("failed to publish payment event", zap.Error(err))
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
