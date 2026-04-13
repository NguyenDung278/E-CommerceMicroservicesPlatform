package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"testing"
	"time"

	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

type fakePaymentRepo struct {
	payments           []*model.Payment
	createdOutbox      *model.OutboxMessage
	idempotencyRecords map[string]*model.PaymentIdempotencyRecord
}

func (r *fakePaymentRepo) Create(_ context.Context, payment *model.Payment, outbox *model.OutboxMessage) error {
	copyValue := *payment
	r.payments = append([]*model.Payment{&copyValue}, r.payments...)
	r.createdOutbox = outbox
	return nil
}

func (r *fakePaymentRepo) CreateWithIdempotency(_ context.Context, payment *model.Payment, outbox *model.OutboxMessage, record *model.PaymentIdempotencyRecord) error {
	if err := r.Create(context.Background(), payment, outbox); err != nil {
		return err
	}
	if r.idempotencyRecords == nil {
		r.idempotencyRecords = map[string]*model.PaymentIdempotencyRecord{}
	}
	copyRecord := *record
	r.idempotencyRecords[fakePaymentIdempotencyMapKey(record.UserID, record.IdempotencyKey)] = &copyRecord
	return nil
}

func (r *fakePaymentRepo) GetByID(_ context.Context, id string) (*model.Payment, error) {
	for _, payment := range r.payments {
		if payment.ID == id {
			copyValue := *payment
			return &copyValue, nil
		}
	}
	return nil, nil
}

func (r *fakePaymentRepo) GetByOrderID(_ context.Context, orderID string) (*model.Payment, error) {
	for _, payment := range r.payments {
		if payment.OrderID == orderID {
			copyValue := *payment
			return &copyValue, nil
		}
	}
	return nil, nil
}

func (r *fakePaymentRepo) GetByGatewayOrderID(_ context.Context, gatewayOrderID string) (*model.Payment, error) {
	for _, payment := range r.payments {
		if payment.GatewayOrderID == gatewayOrderID {
			copyValue := *payment
			return &copyValue, nil
		}
	}
	return nil, nil
}

func (r *fakePaymentRepo) GetIdempotencyKey(_ context.Context, userID, idempotencyKey string) (*model.PaymentIdempotencyRecord, error) {
	record, ok := r.idempotencyRecords[fakePaymentIdempotencyMapKey(userID, idempotencyKey)]
	if !ok {
		return nil, nil
	}
	copyValue := *record
	return &copyValue, nil
}

func (r *fakePaymentRepo) GetByIDForUser(ctx context.Context, id, userID string) (*model.Payment, error) {
	payment, err := r.GetByID(ctx, id)
	if err != nil || payment == nil || payment.UserID != userID {
		return nil, err
	}
	return payment, nil
}

func (r *fakePaymentRepo) GetByOrderIDForUser(ctx context.Context, orderID, userID string) (*model.Payment, error) {
	payment, err := r.GetByOrderID(ctx, orderID)
	if err != nil || payment == nil || payment.UserID != userID {
		return nil, err
	}
	return payment, nil
}

func (r *fakePaymentRepo) ListByOrderID(_ context.Context, orderID string) ([]*model.Payment, error) {
	var payments []*model.Payment
	for _, payment := range r.payments {
		if payment.OrderID == orderID {
			copyValue := *payment
			payments = append(payments, &copyValue)
		}
	}
	return payments, nil
}

func (r *fakePaymentRepo) ListByOrderIDForUser(_ context.Context, orderID, userID string) ([]*model.Payment, error) {
	var payments []*model.Payment
	for _, payment := range r.payments {
		if payment.OrderID == orderID && payment.UserID == userID {
			copyValue := *payment
			payments = append(payments, &copyValue)
		}
	}
	return payments, nil
}

func (r *fakePaymentRepo) ListByUserID(_ context.Context, userID string) ([]*model.Payment, error) {
	var payments []*model.Payment
	for _, payment := range r.payments {
		if payment.UserID == userID {
			copyValue := *payment
			payments = append(payments, &copyValue)
		}
	}
	return payments, nil
}

func (r *fakePaymentRepo) Update(_ context.Context, payment *model.Payment, _ *model.OutboxMessage) error {
	for index, existing := range r.payments {
		if existing.ID == payment.ID {
			copyValue := *payment
			r.payments[index] = &copyValue
			return nil
		}
	}
	return nil
}

func (r *fakePaymentRepo) CreateAuditEntry(_ context.Context, _ *model.AuditEntry) error {
	return nil
}

func (r *fakePaymentRepo) ApplyWebhookResult(_ context.Context, payment *model.Payment, _ *model.InboxMessage, outbox *model.OutboxMessage) (bool, error) {
	if err := r.Update(context.Background(), payment, outbox); err != nil {
		return false, err
	}
	r.createdOutbox = outbox
	return false, nil
}

func (r *fakePaymentRepo) ClaimPendingOutbox(_ context.Context, _ int, _ time.Duration) ([]*model.OutboxMessage, error) {
	return nil, nil
}

func (r *fakePaymentRepo) MarkOutboxPublished(_ context.Context, _ string, _ time.Time) error {
	return nil
}

func (r *fakePaymentRepo) MarkOutboxFailed(_ context.Context, _ string, _ string, _ time.Time) error {
	return nil
}

func fakePaymentIdempotencyMapKey(userID, idempotencyKey string) string {
	return userID + "|" + idempotencyKey
}

type fakeOrderLookup struct {
	order *client.Order
	err   error
}

func (f *fakeOrderLookup) GetOrder(_ context.Context, _, _ string) (*client.Order, error) {
	if f.err != nil {
		return nil, f.err
	}
	copyValue := *f.order
	return &copyValue, nil
}

func TestProcessPaymentDefaultsToOutstandingAmount(t *testing.T) {
	repo := &fakePaymentRepo{
		payments: []*model.Payment{
			{
				ID:              "payment-1",
				OrderID:         "order-1",
				UserID:          "user-1",
				OrderTotal:      120,
				Amount:          50,
				Status:          model.PaymentStatusCompleted,
				TransactionType: model.PaymentTransactionTypeCharge,
				PaymentMethod:   "manual",
				GatewayProvider: "manual",
				CreatedAt:       time.Now().Add(-2 * time.Hour),
				UpdatedAt:       time.Now().Add(-2 * time.Hour),
			},
			{
				ID:                 "payment-2",
				OrderID:            "order-1",
				UserID:             "user-1",
				OrderTotal:         120,
				Amount:             10,
				Status:             model.PaymentStatusRefunded,
				TransactionType:    model.PaymentTransactionTypeRefund,
				ReferencePaymentID: "payment-1",
				PaymentMethod:      "manual",
				GatewayProvider:    "manual",
				CreatedAt:          time.Now().Add(-time.Hour),
				UpdatedAt:          time.Now().Add(-time.Hour),
			},
		},
	}
	orderLookup := &fakeOrderLookup{
		order: &client.Order{
			ID:         "order-1",
			UserID:     "user-1",
			TotalPrice: 120,
			Status:     "pending",
		},
	}
	svc := NewPaymentService(repo, orderLookup, nil, zap.NewNop(), "secret", "https://example.com/return")

	payment, err := svc.ProcessPayment(context.Background(), "user-1", "user@example.com", "Bearer token", "", dto.ProcessPaymentRequest{
		OrderID:       "order-1",
		PaymentMethod: "manual",
	})
	if err != nil {
		t.Fatalf("ProcessPayment returned error: %v", err)
	}

	if payment.Amount != 80 {
		t.Fatalf("expected payment amount 80, got %.2f", payment.Amount)
	}
	if payment.NetPaidAmount != 120 {
		t.Fatalf("expected net paid amount 120, got %.2f", payment.NetPaidAmount)
	}
	if payment.OutstandingAmount != 0 {
		t.Fatalf("expected outstanding amount 0, got %.2f", payment.OutstandingAmount)
	}
	if repo.createdOutbox == nil {
		t.Fatal("expected completed payment to enqueue an outbox message")
	}
}

func TestProcessPaymentReplaysCompletedRequestByIdempotencyKey(t *testing.T) {
	repo := &fakePaymentRepo{}
	orderLookup := &fakeOrderLookup{
		order: &client.Order{
			ID:         "order-1",
			UserID:     "user-1",
			TotalPrice: 120,
			Status:     "pending",
		},
	}
	svc := NewPaymentService(repo, orderLookup, nil, zap.NewNop(), "secret", "https://example.com/return")

	firstPayment, err := svc.ProcessPayment(context.Background(), "user-1", "user@example.com", "Bearer token", "checkout-order-1", dto.ProcessPaymentRequest{
		OrderID:       "order-1",
		PaymentMethod: "manual",
		Amount:        120,
	})
	if err != nil {
		t.Fatalf("first ProcessPayment returned error: %v", err)
	}

	replayedPayment, err := svc.ProcessPayment(context.Background(), "user-1", "user@example.com", "Bearer token", "checkout-order-1", dto.ProcessPaymentRequest{
		OrderID:       "order-1",
		PaymentMethod: "manual",
		Amount:        120,
	})
	if err != nil {
		t.Fatalf("replayed ProcessPayment returned error: %v", err)
	}

	if len(repo.payments) != 1 {
		t.Fatalf("expected 1 persisted payment, got %d", len(repo.payments))
	}
	if replayedPayment.ID != firstPayment.ID {
		t.Fatalf("expected replayed payment id %q, got %q", firstPayment.ID, replayedPayment.ID)
	}
}

func TestProcessPaymentRejectsIdempotencyKeyReuseForDifferentPayload(t *testing.T) {
	repo := &fakePaymentRepo{}
	orderLookup := &fakeOrderLookup{
		order: &client.Order{
			ID:         "order-1",
			UserID:     "user-1",
			TotalPrice: 120,
			Status:     "pending",
		},
	}
	svc := NewPaymentService(repo, orderLookup, nil, zap.NewNop(), "secret", "https://example.com/return")

	if _, err := svc.ProcessPayment(context.Background(), "user-1", "user@example.com", "Bearer token", "checkout-order-1", dto.ProcessPaymentRequest{
		OrderID:       "order-1",
		PaymentMethod: "manual",
		Amount:        120,
	}); err != nil {
		t.Fatalf("initial ProcessPayment returned error: %v", err)
	}

	_, err := svc.ProcessPayment(context.Background(), "user-1", "user@example.com", "Bearer token", "checkout-order-1", dto.ProcessPaymentRequest{
		OrderID:       "order-1",
		PaymentMethod: "manual",
		Amount:        60,
	})
	if !errors.Is(err, ErrIdempotencyKeyConflict) {
		t.Fatalf("expected ErrIdempotencyKeyConflict, got %v", err)
	}
}

func TestRefundPaymentReplaysCompletedRequestByIdempotencyKey(t *testing.T) {
	repo := &fakePaymentRepo{
		payments: []*model.Payment{
			{
				ID:              "payment-1",
				OrderID:         "order-1",
				UserID:          "user-1",
				OrderTotal:      120,
				Amount:          120,
				Status:          model.PaymentStatusCompleted,
				TransactionType: model.PaymentTransactionTypeCharge,
				PaymentMethod:   "manual",
				GatewayProvider: "manual",
				CreatedAt:       time.Now().Add(-2 * time.Hour),
				UpdatedAt:       time.Now().Add(-2 * time.Hour),
			},
		},
	}
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), "secret", "https://example.com/return")

	firstRefund, err := svc.RefundPayment(context.Background(), "payment-1", "staff-1", "staff", "", "return-refund-1", dto.RefundPaymentRequest{
		Amount:  40,
		Message: "Damage refund",
	})
	if err != nil {
		t.Fatalf("first RefundPayment returned error: %v", err)
	}

	replayedRefund, err := svc.RefundPayment(context.Background(), "payment-1", "staff-1", "staff", "", "return-refund-1", dto.RefundPaymentRequest{
		Amount:  40,
		Message: "Damage refund",
	})
	if err != nil {
		t.Fatalf("replayed RefundPayment returned error: %v", err)
	}

	if len(repo.payments) != 2 {
		t.Fatalf("expected one persisted refund plus original charge, got %d payments", len(repo.payments))
	}
	if replayedRefund.ID != firstRefund.ID {
		t.Fatalf("expected replayed refund id %q, got %q", firstRefund.ID, replayedRefund.ID)
	}
}

func TestRefundPaymentRejectsIdempotencyKeyReuseForDifferentPayload(t *testing.T) {
	repo := &fakePaymentRepo{
		payments: []*model.Payment{
			{
				ID:              "payment-1",
				OrderID:         "order-1",
				UserID:          "user-1",
				OrderTotal:      120,
				Amount:          120,
				Status:          model.PaymentStatusCompleted,
				TransactionType: model.PaymentTransactionTypeCharge,
				PaymentMethod:   "manual",
				GatewayProvider: "manual",
				CreatedAt:       time.Now().Add(-2 * time.Hour),
				UpdatedAt:       time.Now().Add(-2 * time.Hour),
			},
		},
	}
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), "secret", "https://example.com/return")

	if _, err := svc.RefundPayment(context.Background(), "payment-1", "staff-1", "staff", "", "return-refund-1", dto.RefundPaymentRequest{
		Amount:  40,
		Message: "Damage refund",
	}); err != nil {
		t.Fatalf("initial RefundPayment returned error: %v", err)
	}

	_, err := svc.RefundPayment(context.Background(), "payment-1", "staff-1", "staff", "", "return-refund-1", dto.RefundPaymentRequest{
		Amount:  50,
		Message: "Different refund amount",
	})
	if !errors.Is(err, ErrIdempotencyKeyConflict) {
		t.Fatalf("expected ErrIdempotencyKeyConflict, got %v", err)
	}
}

func TestHandleMomoWebhookCompletesPendingPayment(t *testing.T) {
	repo := &fakePaymentRepo{
		payments: []*model.Payment{
			{
				ID:              "payment-1",
				OrderID:         "order-1",
				UserID:          "user-1",
				OrderTotal:      100,
				Amount:          25,
				Status:          model.PaymentStatusPending,
				TransactionType: model.PaymentTransactionTypeCharge,
				PaymentMethod:   "momo",
				GatewayProvider: "momo",
				GatewayOrderID:  "MOMO-payment-1",
				CreatedAt:       time.Now().Add(-time.Hour),
				UpdatedAt:       time.Now().Add(-time.Hour),
			},
		},
	}
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), "top-secret", "https://example.com/return")

	req := dto.MomoWebhookRequest{
		PaymentID:            "payment-1",
		GatewayOrderID:       "MOMO-payment-1",
		GatewayTransactionID: "txn-123",
		Amount:               25,
		ResultCode:           0,
	}
	req.Signature = signatureForTest("top-secret", req)

	payment, err := svc.HandleMomoWebhook(context.Background(), req)
	if err != nil {
		t.Fatalf("HandleMomoWebhook returned error: %v", err)
	}

	if payment.Status != model.PaymentStatusCompleted {
		t.Fatalf("expected completed payment, got %s", payment.Status)
	}
	if !payment.SignatureVerified {
		t.Fatal("expected signature to be marked verified")
	}
	if payment.GatewayTransactionID != "txn-123" {
		t.Fatalf("expected gateway transaction id txn-123, got %q", payment.GatewayTransactionID)
	}
	if payment.OutstandingAmount != 75 {
		t.Fatalf("expected outstanding amount 75, got %.2f", payment.OutstandingAmount)
	}
}

func TestEnrichPaymentsSeparatesSummariesPerOrder(t *testing.T) {
	payments := []*model.Payment{
		{
			ID:              "payment-1",
			OrderID:         "order-1",
			OrderTotal:      100,
			Amount:          60,
			Status:          model.PaymentStatusCompleted,
			TransactionType: model.PaymentTransactionTypeCharge,
		},
		{
			ID:              "payment-2",
			OrderID:         "order-2",
			OrderTotal:      200,
			Amount:          50,
			Status:          model.PaymentStatusCompleted,
			TransactionType: model.PaymentTransactionTypeCharge,
		},
		{
			ID:                 "payment-3",
			OrderID:            "order-1",
			OrderTotal:         100,
			Amount:             10,
			Status:             model.PaymentStatusRefunded,
			TransactionType:    model.PaymentTransactionTypeRefund,
			ReferencePaymentID: "payment-1",
		},
	}

	enriched := enrichPayments(payments)
	if len(enriched) != 3 {
		t.Fatalf("expected 3 enriched payments, got %d", len(enriched))
	}

	if enriched[0].NetPaidAmount != 50 || enriched[0].OutstandingAmount != 50 {
		t.Fatalf("expected order-1 summary 50/50, got %.2f/%.2f", enriched[0].NetPaidAmount, enriched[0].OutstandingAmount)
	}
	if enriched[1].NetPaidAmount != 50 || enriched[1].OutstandingAmount != 150 {
		t.Fatalf("expected order-2 summary 50/150, got %.2f/%.2f", enriched[1].NetPaidAmount, enriched[1].OutstandingAmount)
	}
}

func signatureForTest(secret string, req dto.MomoWebhookRequest) string {
	req.Signature = ""
	payload := stringsForSignature(req)
	return hmacHex(secret, payload)
}

func stringsForSignature(req dto.MomoWebhookRequest) string {
	return req.PaymentID + "|" + req.GatewayOrderID + "|" + req.GatewayTransactionID + "|" + formatMoney(req.Amount) + "|" + fmt.Sprintf("%d", req.ResultCode)
}

func hmacHex(secret, payload string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}
