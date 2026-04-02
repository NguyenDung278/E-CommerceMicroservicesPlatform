package handler

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/email"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/inbox"
)

type stubSender struct {
	messages []email.Message
	err      error
}

func (s *stubSender) Send(message email.Message) error {
	s.messages = append(s.messages, message)
	return s.err
}

type fakeInboxStore struct {
	claimStatus      inbox.ClaimStatus
	claimErr         error
	markProcessedErr error
	released         []string
	processed        []string
}

func (s *fakeInboxStore) Claim(_ context.Context, _ string, _ time.Duration) (inbox.ClaimStatus, error) {
	if s.claimErr != nil {
		return 0, s.claimErr
	}
	return s.claimStatus, nil
}

func (s *fakeInboxStore) MarkProcessed(_ context.Context, messageID string, _ time.Duration) error {
	s.processed = append(s.processed, messageID)
	return s.markProcessedErr
}

func (s *fakeInboxStore) Release(_ context.Context, messageID string) error {
	s.released = append(s.released, messageID)
	return nil
}

type fakeRetryPublisher struct {
	calls      int
	retryCount int
	err        error
}

func (p *fakeRetryPublisher) Publish(_ context.Context, _ amqp.Delivery, retryCount int, _ time.Time) error {
	p.calls++
	p.retryCount = retryCount
	return p.err
}

type fakeAcknowledger struct {
	acked    bool
	nacked   bool
	rejected bool
	requeue  bool
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
	a.rejected = true
	return nil
}

func TestHandleMessagePaymentRefundedAcknowledgesAndSendsEmail(t *testing.T) {
	sender := &stubSender{}
	inboxStore := &fakeInboxStore{claimStatus: inbox.Claimed}
	handler := NewEventHandler(zap.NewNop(), sender, inboxStore, &fakeRetryPublisher{}, 3, 24*time.Hour, time.Minute)
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

	handler.HandleMessage(context.Background(), amqp.Delivery{
		Acknowledger: ack,
		DeliveryTag:  1,
		MessageId:    "msg-1",
		RoutingKey:   "payment.refunded",
		Body:         body,
	})

	if !ack.acked || ack.nacked || ack.rejected {
		t.Fatalf("expected refund event to be acked once, got acked=%v nacked=%v rejected=%v", ack.acked, ack.nacked, ack.rejected)
	}
	if len(sender.messages) != 1 {
		t.Fatalf("expected 1 refund email, got %d", len(sender.messages))
	}
	if len(inboxStore.processed) != 1 || inboxStore.processed[0] != "msg-1" {
		t.Fatalf("expected message to be marked processed, got %#v", inboxStore.processed)
	}
}

func TestHandleMessageOrderCancelledSchedulesRetryWhenSendFails(t *testing.T) {
	sender := &stubSender{err: errors.New("smtp unavailable")}
	inboxStore := &fakeInboxStore{claimStatus: inbox.Claimed}
	retryPublisher := &fakeRetryPublisher{}
	handler := NewEventHandler(zap.NewNop(), sender, inboxStore, retryPublisher, 3, 24*time.Hour, time.Minute)
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

	handler.HandleMessage(context.Background(), amqp.Delivery{
		Acknowledger: ack,
		DeliveryTag:  1,
		MessageId:    "msg-2",
		RoutingKey:   "order.cancelled",
		Body:         body,
	})

	if !ack.acked || ack.nacked || ack.rejected {
		t.Fatalf("expected transient failure to ack original after scheduling retry, got acked=%v nacked=%v rejected=%v", ack.acked, ack.nacked, ack.rejected)
	}
	if retryPublisher.calls != 1 || retryPublisher.retryCount != 1 {
		t.Fatalf("expected exactly one retry publish with retry count 1, got calls=%d retry=%d", retryPublisher.calls, retryPublisher.retryCount)
	}
	if len(inboxStore.released) != 1 || inboxStore.released[0] != "msg-2" {
		t.Fatalf("expected inbox claim release on retry path, got %#v", inboxStore.released)
	}
}

func TestHandleMessageSkipsDuplicateEvent(t *testing.T) {
	sender := &stubSender{}
	inboxStore := &fakeInboxStore{claimStatus: inbox.AlreadyProcessed}
	handler := NewEventHandler(zap.NewNop(), sender, inboxStore, &fakeRetryPublisher{}, 3, 24*time.Hour, time.Minute)
	ack := &fakeAcknowledger{}

	handler.HandleMessage(context.Background(), amqp.Delivery{
		Acknowledger: ack,
		DeliveryTag:  1,
		MessageId:    "msg-3",
		RoutingKey:   "payment.completed",
		Body:         []byte(`{"payment_id":"pay_1"}`),
	})

	if !ack.acked || ack.nacked || ack.rejected {
		t.Fatalf("expected duplicate event to be acked, got acked=%v nacked=%v rejected=%v", ack.acked, ack.nacked, ack.rejected)
	}
	if len(sender.messages) != 0 {
		t.Fatalf("expected duplicate event to skip sending, got %d messages", len(sender.messages))
	}
}

func TestHandleMessageRejectsPermanentDecodeFailuresToDLQ(t *testing.T) {
	sender := &stubSender{}
	inboxStore := &fakeInboxStore{claimStatus: inbox.Claimed}
	handler := NewEventHandler(zap.NewNop(), sender, inboxStore, &fakeRetryPublisher{}, 3, 24*time.Hour, time.Minute)
	ack := &fakeAcknowledger{}

	handler.HandleMessage(context.Background(), amqp.Delivery{
		Acknowledger: ack,
		DeliveryTag:  1,
		MessageId:    "msg-4",
		RoutingKey:   "payment.completed",
		Body:         []byte(`{invalid-json`),
	})

	if ack.acked || ack.nacked || !ack.rejected {
		t.Fatalf("expected invalid payload to be rejected to DLQ, got acked=%v nacked=%v rejected=%v", ack.acked, ack.nacked, ack.rejected)
	}
	if len(inboxStore.released) != 1 || inboxStore.released[0] != "msg-4" {
		t.Fatalf("expected inbox claim release on permanent failure, got %#v", inboxStore.released)
	}
}
