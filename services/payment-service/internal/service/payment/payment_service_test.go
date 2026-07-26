package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
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

	// inbox mô phỏng bảng `inbox_messages` với PRIMARY KEY (consumer, message_id).
	inbox map[string]struct{}
	// beforeApplyWebhook cho phép test chèn một delivery song song vào đúng khe
	// hở giữa lúc service đọc status và lúc compare-and-set chạy.
	beforeApplyWebhook func()
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

func (r *fakePaymentRepo) ListByOrderIDs(_ context.Context, orderIDs []string) ([]*model.Payment, error) {
	allowed := make(map[string]struct{}, len(orderIDs))
	for _, orderID := range orderIDs {
		allowed[orderID] = struct{}{}
	}

	var payments []*model.Payment
	for _, payment := range r.payments {
		if _, ok := allowed[payment.OrderID]; !ok {
			continue
		}
		copyValue := *payment
		payments = append(payments, &copyValue)
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

// ApplyWebhookResult mô phỏng đúng ba bước của repository thật:
// inbox dedupe → compare-and-set trên `status = 'pending'` → ghi outbox.
func (r *fakePaymentRepo) ApplyWebhookResult(
	_ context.Context,
	payment *model.Payment,
	inbox *model.InboxMessage,
	outbox *model.OutboxMessage,
) (bool, error) {
	if r.beforeApplyWebhook != nil {
		r.beforeApplyWebhook()
	}

	// Bước 1 — INSERT ... ON CONFLICT (consumer, message_id) DO NOTHING.
	if inbox != nil {
		key := fakeInboxKey(inbox.Consumer, inbox.MessageID)
		if _, exists := r.inbox[key]; exists {
			return true, nil
		}
		if r.inbox == nil {
			r.inbox = map[string]struct{}{}
		}
		r.inbox[key] = struct{}{}
	}

	// Bước 2 — UPDATE ... WHERE id = $1 AND status = 'pending'.
	stored, err := r.GetByID(context.Background(), payment.ID)
	if err != nil {
		return false, err
	}
	if stored == nil || stored.Status != model.PaymentStatusPending {
		return true, nil
	}

	// Bước 3 — chỉ ghi outbox khi payment thực sự đổi trạng thái.
	if err := r.Update(context.Background(), payment, outbox); err != nil {
		return false, err
	}
	r.createdOutbox = outbox
	return false, nil
}

func (r *fakePaymentRepo) seedInbox(consumer, messageID string) {
	if r.inbox == nil {
		r.inbox = map[string]struct{}{}
	}
	r.inbox[fakeInboxKey(consumer, messageID)] = struct{}{}
}

func fakeInboxKey(consumer, messageID string) string {
	return consumer + "|" + messageID
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
	svc := NewPaymentService(repo, orderLookup, nil, zap.NewNop(), GatewaySettings{MomoSecret: "secret", MomoReturnURL: "https://example.com/return"})

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
	svc := NewPaymentService(repo, orderLookup, nil, zap.NewNop(), GatewaySettings{MomoSecret: "secret", MomoReturnURL: "https://example.com/return"})

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
	svc := NewPaymentService(repo, orderLookup, nil, zap.NewNop(), GatewaySettings{MomoSecret: "secret", MomoReturnURL: "https://example.com/return"})

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
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), GatewaySettings{MomoSecret: "secret", MomoReturnURL: "https://example.com/return"})

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
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), GatewaySettings{MomoSecret: "secret", MomoReturnURL: "https://example.com/return"})

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
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), GatewaySettings{MomoSecret: "top-secret", MomoReturnURL: "https://example.com/return"})

	req := dto.MomoWebhookRequest{
		PaymentID:            "payment-1",
		GatewayOrderID:       "MOMO-payment-1",
		GatewayTransactionID: "txn-123",
		Amount:               25,
		ResultCode:           0,
	}
	req.Signature = signatureForTest("top-secret", req)

	payment, err := svc.HandleGatewayWebhook(context.Background(), "momo", MomoWebhookFromDTO(req))
	if err != nil {
		t.Fatalf("HandleGatewayWebhook returned error: %v", err)
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

// pendingMomoRepo dựng một repo chỉ có đúng một payment MoMo đang `pending`,
// dùng chung cho các test webhook bên dưới.
func pendingMomoRepo() *fakePaymentRepo {
	return &fakePaymentRepo{
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
}

func pendingMomoWebhookRequest() dto.MomoWebhookRequest {
	return dto.MomoWebhookRequest{
		PaymentID:            "payment-1",
		GatewayOrderID:       "MOMO-payment-1",
		GatewayTransactionID: "txn-123",
		Amount:               25,
		ResultCode:           0,
	}
}

// Webhook là endpoint công khai (không JWT), nên chữ ký HMAC là lớp phòng thủ duy
// nhất. Chữ ký sai phải bị từ chối TRƯỚC khi chạm vào state.
func TestHandleMomoWebhookRejectsInvalidSignature(t *testing.T) {
	repo := pendingMomoRepo()
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), GatewaySettings{MomoSecret: "top-secret", MomoReturnURL: "https://example.com/return"})

	req := pendingMomoWebhookRequest()
	req.Signature = "definitely-not-a-valid-signature"

	if _, err := svc.HandleGatewayWebhook(context.Background(), "momo", MomoWebhookFromDTO(req)); !errors.Is(err, ErrInvalidWebhookSignature) {
		t.Fatalf("expected ErrInvalidWebhookSignature, got %v", err)
	}

	stored, err := repo.GetByID(context.Background(), "payment-1")
	if err != nil {
		t.Fatalf("GetByID returned error: %v", err)
	}
	if stored.Status != model.PaymentStatusPending {
		t.Fatalf("expected payment to stay pending, got %s", stored.Status)
	}
	if repo.createdOutbox != nil {
		t.Fatal("expected no outbox message for a webhook with an invalid signature")
	}
}

// Secret rỗng phải fail closed: từ chối tất cả, không phải cho qua tất cả.
func TestHandleMomoWebhookFailsClosedWithoutSecret(t *testing.T) {
	repo := pendingMomoRepo()
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), GatewaySettings{MomoSecret: "", MomoReturnURL: "https://example.com/return"})

	req := pendingMomoWebhookRequest()
	req.Signature = signatureForTest("", req)

	if _, err := svc.HandleGatewayWebhook(context.Background(), "momo", MomoWebhookFromDTO(req)); !errors.Is(err, ErrInvalidWebhookSignature) {
		t.Fatalf("expected ErrInvalidWebhookSignature when the webhook secret is empty, got %v", err)
	}

	stored, err := repo.GetByID(context.Background(), "payment-1")
	if err != nil {
		t.Fatalf("GetByID returned error: %v", err)
	}
	if stored.Status != model.PaymentStatusPending {
		t.Fatalf("expected payment to stay pending, got %s", stored.Status)
	}
}

// Inbox pattern: một delivery song song đã ghi inbox row trong lúc delivery này
// còn đang đọc payment. Delivery thứ hai phải bị chặn ở inbox và KHÔNG được
// enqueue thêm một event `payment.completed` nữa.
func TestHandleMomoWebhookSkipsDuplicateInboxDelivery(t *testing.T) {
	repo := pendingMomoRepo()
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), GatewaySettings{MomoSecret: "top-secret", MomoReturnURL: "https://example.com/return"})

	req := pendingMomoWebhookRequest()
	req.Signature = signatureForTest("top-secret", req)

	repo.seedInbox(webhookConsumerName("momo"), newMomoGateway("top-secret", "").WebhookMessageID(MomoWebhookFromDTO(req)))

	payment, err := svc.HandleGatewayWebhook(context.Background(), "momo", MomoWebhookFromDTO(req))
	if err != nil {
		t.Fatalf("HandleGatewayWebhook returned error: %v", err)
	}

	if payment.Status != model.PaymentStatusPending {
		t.Fatalf("expected duplicate delivery to report the stored status pending, got %s", payment.Status)
	}
	if repo.createdOutbox != nil {
		t.Fatal("expected duplicate delivery not to enqueue a second outbox message")
	}

	stored, err := repo.GetByID(context.Background(), "payment-1")
	if err != nil {
		t.Fatalf("GetByID returned error: %v", err)
	}
	if stored.Status != model.PaymentStatusPending {
		t.Fatalf("expected stored payment to stay pending, got %s", stored.Status)
	}
}

// Compare-and-set là lớp phòng thủ thứ hai: inbox không chặn được (message_id
// khác), nhưng payment đã rời `pending` nên UPDATE không khớp dòng nào. Caller
// phải trả về state THẬT trong DB, không phải bản in-memory đã gán completed.
func TestHandleMomoWebhookReportsStoredStateWhenCompareAndSetMisses(t *testing.T) {
	repo := pendingMomoRepo()
	repo.beforeApplyWebhook = func() {
		// Một delivery song song đã finalize payment thành `failed` ngay sau khi
		// delivery hiện tại đọc thấy `pending`.
		repo.payments[0].Status = model.PaymentStatusFailed
		repo.payments[0].FailureReason = "finalized by a concurrent delivery"
	}
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), GatewaySettings{MomoSecret: "top-secret", MomoReturnURL: "https://example.com/return"})

	req := pendingMomoWebhookRequest()
	req.Signature = signatureForTest("top-secret", req)

	payment, err := svc.HandleGatewayWebhook(context.Background(), "momo", MomoWebhookFromDTO(req))
	if err != nil {
		t.Fatalf("HandleGatewayWebhook returned error: %v", err)
	}

	if payment.Status != model.PaymentStatusFailed {
		t.Fatalf("expected the stored status failed to win, got %s", payment.Status)
	}
	if repo.createdOutbox != nil {
		t.Fatal("expected no outbox message when the compare-and-set matched no row")
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

func TestListPaymentsByOrderIDsAdminGroupsEnrichedPayments(t *testing.T) {
	repo := &fakePaymentRepo{
		payments: []*model.Payment{
			{
				ID:              "payment-1",
				OrderID:         "order-1",
				UserID:          "user-1",
				OrderTotal:      100,
				Amount:          100,
				Status:          model.PaymentStatusCompleted,
				TransactionType: model.PaymentTransactionTypeCharge,
			},
			{
				ID:                 "payment-2",
				OrderID:            "order-1",
				UserID:             "user-1",
				OrderTotal:         100,
				Amount:             25,
				Status:             model.PaymentStatusRefunded,
				TransactionType:    model.PaymentTransactionTypeRefund,
				ReferencePaymentID: "payment-1",
			},
			{
				ID:              "payment-3",
				OrderID:         "order-2",
				UserID:          "user-2",
				OrderTotal:      80,
				Amount:          40,
				Status:          model.PaymentStatusCompleted,
				TransactionType: model.PaymentTransactionTypeCharge,
			},
		},
	}
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), GatewaySettings{MomoSecret: "secret", MomoReturnURL: "https://example.com/return"})

	paymentsByOrder, err := svc.ListPaymentsByOrderIDsAdmin(
		context.Background(),
		[]string{"order-1", "order-2", "order-3", "order-1", "   "},
	)
	if err != nil {
		t.Fatalf("ListPaymentsByOrderIDsAdmin returned error: %v", err)
	}

	if len(paymentsByOrder["order-1"]) != 2 {
		t.Fatalf("expected 2 payments for order-1, got %d", len(paymentsByOrder["order-1"]))
	}
	if len(paymentsByOrder["order-2"]) != 1 {
		t.Fatalf("expected 1 payment for order-2, got %d", len(paymentsByOrder["order-2"]))
	}
	if len(paymentsByOrder["order-3"]) != 0 {
		t.Fatalf("expected empty payment history for order-3, got %d", len(paymentsByOrder["order-3"]))
	}
	if paymentsByOrder["order-1"][0].NetPaidAmount != 75 || paymentsByOrder["order-1"][0].OutstandingAmount != 25 {
		t.Fatalf(
			"expected order-1 summary 75/25, got %.2f/%.2f",
			paymentsByOrder["order-1"][0].NetPaidAmount,
			paymentsByOrder["order-1"][0].OutstandingAmount,
		)
	}
	if paymentsByOrder["order-2"][0].NetPaidAmount != 40 || paymentsByOrder["order-2"][0].OutstandingAmount != 40 {
		t.Fatalf(
			"expected order-2 summary 40/40, got %.2f/%.2f",
			paymentsByOrder["order-2"][0].NetPaidAmount,
			paymentsByOrder["order-2"][0].OutstandingAmount,
		)
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

// ---------------------------------------------------------------------------
// VNPay — cổng thứ hai.
//
// Các test dưới đây là bằng chứng abstraction đứng vững: VNPay khác MoMo ở
// thuật toán ký (SHA512), khuôn dạng payload (query string đã sắp xếp), đơn vị
// số tiền (nhân 100) và mã thành công ("00" thay vì 0) — nhưng ProcessPayment
// và HandleGatewayWebhook không đổi một dòng nào.
// ---------------------------------------------------------------------------

const vnpayTestSecret = "vnpay-sandbox-secret"

func vnpaySettings() GatewaySettings {
	return GatewaySettings{
		MomoSecret:     "top-secret",
		MomoReturnURL:  "https://example.com/return",
		VNPaySecret:    vnpayTestSecret,
		VNPayReturnURL: "https://example.com/return",
	}
}

func payableOrderLookup() *fakeOrderLookup {
	return &fakeOrderLookup{
		order: &client.Order{ID: "order-1", UserID: "user-1", TotalPrice: 120, Status: "pending"},
	}
}

// signVNPayParams ký tham số theo đúng quy ước VNPay để test dựng được callback
// hợp lệ mà không cần gọi sandbox thật.
func signVNPayParams(secret string, params map[string]string) string {
	payload := (&vnpayGateway{}).signaturePayload(GatewayWebhook{Params: params})
	mac := hmac.New(sha512.New, []byte(secret))
	_, _ = mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestProcessPaymentWithVNPayStaysPendingUntilWebhook(t *testing.T) {
	repo := &fakePaymentRepo{}
	svc := NewPaymentService(repo, payableOrderLookup(), nil, zap.NewNop(), vnpaySettings())

	payment, err := svc.ProcessPayment(context.Background(), "user-1", "user@example.com", "Bearer token", "",
		dto.ProcessPaymentRequest{OrderID: "order-1", PaymentMethod: "vnpay", Amount: 120})
	if err != nil {
		t.Fatalf("ProcessPayment returned error: %v", err)
	}

	if payment.Status != model.PaymentStatusPending {
		t.Fatalf("expected vnpay payment to stay pending, got %s", payment.Status)
	}
	if payment.GatewayProvider != "vnpay" {
		t.Fatalf("expected gateway provider vnpay, got %q", payment.GatewayProvider)
	}
	if payment.GatewayOrderID != "VNP-"+payment.ID {
		t.Fatalf("expected gateway order id VNP-%s, got %q", payment.ID, payment.GatewayOrderID)
	}
	// Chốt quan trọng nhất: chưa có tiền thì tuyệt đối chưa được bắn event.
	if repo.createdOutbox != nil {
		t.Fatal("expected no outbox message before the vnpay webhook confirms the payment")
	}
}

// Cổng chưa cấu hình secret thì không được đăng ký, và request phải bị từ chối
// ở biên thay vì đi vào một luồng hỏng ngầm.
func TestProcessPaymentRejectsVNPayWhenGatewayNotConfigured(t *testing.T) {
	repo := &fakePaymentRepo{}
	svc := NewPaymentService(repo, payableOrderLookup(), nil, zap.NewNop(),
		GatewaySettings{MomoSecret: "top-secret", MomoReturnURL: "https://example.com/return"})

	_, err := svc.ProcessPayment(context.Background(), "user-1", "user@example.com", "Bearer token", "",
		dto.ProcessPaymentRequest{OrderID: "order-1", PaymentMethod: "vnpay", Amount: 120})
	if !errors.Is(err, ErrUnsupportedPaymentMethod) {
		t.Fatalf("expected ErrUnsupportedPaymentMethod when vnpay is not configured, got %v", err)
	}
	if len(repo.payments) != 0 {
		t.Fatalf("expected no payment to be persisted, got %d", len(repo.payments))
	}
}

func pendingVNPayRepo() *fakePaymentRepo {
	return &fakePaymentRepo{
		payments: []*model.Payment{
			{
				ID:              "payment-9",
				OrderID:         "order-1",
				UserID:          "user-1",
				OrderTotal:      100,
				Amount:          25,
				Status:          model.PaymentStatusPending,
				TransactionType: model.PaymentTransactionTypeCharge,
				PaymentMethod:   "vnpay",
				GatewayProvider: "vnpay",
				GatewayOrderID:  "VNP-payment-9",
				CreatedAt:       time.Now().Add(-time.Hour),
				UpdatedAt:       time.Now().Add(-time.Hour),
			},
		},
	}
}

// VNPay không gửi payment id nội bộ — payment phải được tra qua gateway order id.
func vnpayWebhookParams() map[string]string {
	return map[string]string{
		"vnp_TmnCode":       "TESTMERCHANT",
		"vnp_Amount":        "2500", // 25.00 × 100
		"vnp_TxnRef":        "VNP-payment-9",
		"vnp_TransactionNo": "14202468",
		"vnp_ResponseCode":  "00",
		"vnp_OrderInfo":     "Thanh toan don hang",
	}
}

func TestHandleVNPayWebhookCompletesPendingPayment(t *testing.T) {
	repo := pendingVNPayRepo()
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), vnpaySettings())

	params := vnpayWebhookParams()
	params["vnp_SecureHash"] = signVNPayParams(vnpayTestSecret, params)

	payment, err := svc.HandleGatewayWebhook(context.Background(), "vnpay", VNPayWebhookFromParams(params))
	if err != nil {
		t.Fatalf("HandleGatewayWebhook returned error: %v", err)
	}

	if payment.Status != model.PaymentStatusCompleted {
		t.Fatalf("expected completed payment, got %s", payment.Status)
	}
	if !payment.SignatureVerified {
		t.Fatal("expected signature to be marked verified")
	}
	if payment.GatewayTransactionID != "14202468" {
		t.Fatalf("expected gateway transaction id 14202468, got %q", payment.GatewayTransactionID)
	}
	if payment.OutstandingAmount != 75 {
		t.Fatalf("expected outstanding amount 75, got %.2f", payment.OutstandingAmount)
	}
	if repo.createdOutbox == nil {
		t.Fatal("expected a confirmed vnpay payment to enqueue an outbox message")
	}
}

// Chữ ký phải khoá cả số tiền: đổi vnp_Amount là chữ ký hỏng ngay.
func TestHandleVNPayWebhookRejectsTamperedAmount(t *testing.T) {
	repo := pendingVNPayRepo()
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), vnpaySettings())

	params := vnpayWebhookParams()
	params["vnp_SecureHash"] = signVNPayParams(vnpayTestSecret, params)
	params["vnp_Amount"] = "1" // kẻ tấn công hạ số tiền sau khi VNPay đã ký

	if _, err := svc.HandleGatewayWebhook(context.Background(), "vnpay", VNPayWebhookFromParams(params)); !errors.Is(err, ErrInvalidWebhookSignature) {
		t.Fatalf("expected ErrInvalidWebhookSignature for a tampered amount, got %v", err)
	}

	stored, err := repo.GetByID(context.Background(), "payment-9")
	if err != nil {
		t.Fatalf("GetByID returned error: %v", err)
	}
	if stored.Status != model.PaymentStatusPending {
		t.Fatalf("expected payment to stay pending, got %s", stored.Status)
	}
}

// Chữ ký MoMo hợp lệ không được dùng để xác thực callback VNPay và ngược lại:
// mỗi cổng có secret và thuật toán riêng.
func TestHandleGatewayWebhookRejectsProviderMismatch(t *testing.T) {
	repo := pendingVNPayRepo()
	svc := NewPaymentService(repo, &fakeOrderLookup{}, nil, zap.NewNop(), vnpaySettings())

	params := vnpayWebhookParams()
	params["vnp_SecureHash"] = signVNPayParams(vnpayTestSecret, params)

	// Callback VNPay hợp lệ nhưng bị gửi vào endpoint của MoMo.
	if _, err := svc.HandleGatewayWebhook(context.Background(), "momo", VNPayWebhookFromParams(params)); !errors.Is(err, ErrPaymentNotFound) {
		t.Fatalf("expected ErrPaymentNotFound for a provider mismatch, got %v", err)
	}
}
