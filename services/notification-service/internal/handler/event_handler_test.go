package handler

import (
	"encoding/json"
	"errors"
	"testing"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	notificationemail "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/email"
)

type stubSender struct {
	messages []notificationemail.Message
	err      error
}

func (s *stubSender) Send(message notificationemail.Message) error {
	s.messages = append(s.messages, message)
	return s.err
}

type fakeAcknowledger struct {
	acked   bool
	nacked  bool
	requeue bool
}

func (a *fakeAcknowledger) Ack(uint64, bool) error {
	a.acked = true
	return nil
}

func (a *fakeAcknowledger) Nack(uint64, bool, bool) error {
	a.nacked = true
	a.requeue = true
	return nil
}

func (a *fakeAcknowledger) Reject(uint64, bool) error {
	return nil
}

func TestHandleMessagePaymentRefundedAcknowledgesAndSendsEmail(t *testing.T) {
	sender := &stubSender{}
	handler := NewEventHandler(zap.NewNop(), sender)
	ack := &fakeAcknowledger{}

	body, err := json.Marshal(PaymentEvent{
		PaymentID: "pay_refund_1",
		OrderID:   "order_1",
		UserID:    "user_1",
		UserEmail: "alice@example.com",
		Amount:    49.99,
		Status:    "refunded",
	})
	if err != nil {
		t.Fatalf("failed to marshal payment refund event: %v", err)
	}

	handler.HandleMessage(amqp.Delivery{
		Acknowledger: ack,
		DeliveryTag:  1,
		RoutingKey:   "payment.refunded",
		Body:         body,
	})

	if !ack.acked || ack.nacked {
		t.Fatalf("expected refund event to be acked once, got acked=%v nacked=%v", ack.acked, ack.nacked)
	}
	if len(sender.messages) != 1 {
		t.Fatalf("expected 1 refund email, got %d", len(sender.messages))
	}
	if sender.messages[0].Subject != "Hoan tien thanh cong" {
		t.Fatalf("unexpected refund subject: %s", sender.messages[0].Subject)
	}
}

func TestHandleMessageOrderCancelledRequeuesWhenSendFails(t *testing.T) {
	sender := &stubSender{err: errors.New("smtp unavailable")}
	handler := NewEventHandler(zap.NewNop(), sender)
	ack := &fakeAcknowledger{}

	body, err := json.Marshal(OrderEvent{
		OrderID:    "order_1",
		UserID:     "user_1",
		UserEmail:  "alice@example.com",
		TotalPrice: 120,
		Status:     "cancelled",
	})
	if err != nil {
		t.Fatalf("failed to marshal order cancel event: %v", err)
	}

	handler.HandleMessage(amqp.Delivery{
		Acknowledger: ack,
		DeliveryTag:  1,
		RoutingKey:   "order.cancelled",
		Body:         body,
	})

	if ack.acked || !ack.nacked || !ack.requeue {
		t.Fatalf("expected order cancellation send failure to nack with requeue, got acked=%v nacked=%v requeue=%v", ack.acked, ack.nacked, ack.requeue)
	}
}
