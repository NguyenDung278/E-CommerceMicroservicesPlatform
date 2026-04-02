package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

// RefundPayment creates a refund record against a completed charge and publishes
// the resulting lifecycle event.
//
// Inputs:
//   - ctx carries cancellation to repository writes and event publication.
//   - paymentID identifies the original charge being refunded.
//   - actorID and actorRole describe the staff actor performing the refund.
//   - userEmail is forwarded to downstream consumers for notifications.
//   - req contains the optional refund amount and audit message.
//
// Returns:
//   - the enriched refund payment record.
//   - a business or system error describing why the refund could not be created.
//
// Edge cases:
//   - zero amounts default to the remaining refundable balance.
//   - only completed charge payments can be refunded.
//
// Side effects:
//   - writes a refund row to PostgreSQL.
//   - writes an audit entry best-effort.
//   - publishes a `payment.refunded` event.
//
// Performance:
//   - dominated by two repository reads, one insert, and O(n) sibling-payment scans.
func (s *PaymentService) RefundPayment(ctx context.Context, paymentID, actorID, actorRole, userEmail string, req dto.RefundPaymentRequest) (*model.Payment, error) {
	startedAt := time.Now()
	outcome := appobs.OutcomeSuccess
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("payment_id", paymentID),
		zap.String("actor_id", actorID),
		zap.String("actor_role", actorRole),
	)
	defer func() {
		appobs.ObserveOperation("payment-service", "refund_payment", outcome, time.Since(startedAt))
	}()

	target, err := s.repo.GetByID(ctx, paymentID)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("refund failed while loading target payment", zap.Error(err))
		return nil, err
	}
	if target == nil {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("refund rejected because payment was not found")
		return nil, ErrPaymentNotFound
	}
	if target.TransactionType != model.PaymentTransactionTypeCharge || target.Status != model.PaymentStatusCompleted {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("refund rejected because payment is not refundable",
			zap.String("transaction_type", string(target.TransactionType)),
			zap.String("payment_status", string(target.Status)),
		)
		return nil, ErrRefundNotAllowed
	}

	payments, err := s.repo.ListByOrderID(ctx, target.OrderID)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("refund failed while loading sibling payments", zap.Error(err))
		return nil, err
	}

	refundable := refundableAmountForCharge(target.ID, target.Amount, payments)
	if refundable <= 0 {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("refund rejected because refundable amount is zero")
		return nil, ErrRefundNotAllowed
	}

	amount := roundMoney(req.Amount)
	if amount <= 0 {
		amount = refundable
	}
	if amount <= 0 || amount > refundable {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("refund rejected because requested amount exceeds refundable balance",
			zap.Float64("requested_amount", req.Amount),
			zap.Float64("normalized_amount", amount),
			zap.Float64("refundable_amount", refundable),
		)
		return nil, ErrRefundAmountExceeded
	}

	now := time.Now()
	refund := &model.Payment{
		ID:                 uuid.New().String(),
		OrderID:            target.OrderID,
		UserID:             target.UserID,
		OrderTotal:         target.OrderTotal,
		Amount:             amount,
		Status:             model.PaymentStatusRefunded,
		TransactionType:    model.PaymentTransactionTypeRefund,
		ReferencePaymentID: target.ID,
		PaymentMethod:      target.PaymentMethod,
		GatewayProvider:    target.GatewayProvider,
		SignatureVerified:  true,
		FailureReason:      strings.TrimSpace(req.Message),
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	if err := s.repo.Create(ctx, refund); err != nil {
		if isUniqueViolation(err) {
			outcome = appobs.OutcomeBusinessError
			requestLog.Warn("refund rejected due to duplicate payment record", zap.Error(err))
			return nil, ErrDuplicatePayment
		}
		outcome = appobs.OutcomeSystemError
		requestLog.Error("refund failed while persisting refund record", zap.Error(err))
		return nil, err
	}

	enriched := enrichPayment(refund, append([]*model.Payment{refund}, payments...))
	s.recordAuditEntry(ctx, &model.AuditEntry{
		ID:         uuid.New().String(),
		EntityType: "payment",
		EntityID:   refund.ID,
		Action:     "payment.refunded",
		ActorID:    actorID,
		ActorRole:  actorRole,
		Metadata: map[string]any{
			"order_id":             refund.OrderID,
			"user_id":              refund.UserID,
			"amount":               refund.Amount,
			"reference_payment_id": refund.ReferencePaymentID,
			"gateway_provider":     refund.GatewayProvider,
			"failure_reason":       refund.FailureReason,
		},
		CreatedAt: time.Now(),
	})
	s.publishPaymentEvent(ctx, enriched, userEmail)
	requestLog.Info("refund processed",
		zap.String("refund_id", refund.ID),
		zap.String("order_id", refund.OrderID),
		zap.Float64("amount", refund.Amount),
	)

	return enriched, nil
}

// HandleMomoWebhook verifies and applies a simulated MoMo webhook to a pending
// payment.
//
// Inputs:
//   - ctx carries cancellation to repository work and event publication.
//   - req contains the webhook payload from the payment gateway.
//
// Returns:
//   - the updated enriched payment record.
//   - a business or system error when the webhook cannot be applied.
//
// Edge cases:
//   - repeated callbacks for already-finalized payments are treated as idempotent
//     replays and simply return the current state.
//
// Side effects:
//   - updates the payment row when the pending payment transitions.
//   - publishes a payment lifecycle event for the resulting state.
//
// Performance:
//   - dominated by up to two repository reads, one update, and O(n) sibling-payment scans.
func (s *PaymentService) HandleMomoWebhook(ctx context.Context, req dto.MomoWebhookRequest) (*model.Payment, error) {
	startedAt := time.Now()
	outcome := appobs.OutcomeSuccess
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("payment_id", strings.TrimSpace(req.PaymentID)),
		zap.String("gateway_order_id", strings.TrimSpace(req.GatewayOrderID)),
		zap.Int("result_code", req.ResultCode),
	)
	defer func() {
		appobs.ObserveOperation("payment-service", "momo_webhook", outcome, time.Since(startedAt))
	}()

	payment, err := s.findWebhookPayment(ctx, req)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("payment webhook failed while resolving target payment", zap.Error(err))
		return nil, err
	}
	if payment == nil {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("payment webhook rejected because payment was not found")
		return nil, ErrPaymentNotFound
	}
	if payment.GatewayProvider != "momo" {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("payment webhook rejected because gateway provider does not match payment",
			zap.String("gateway_provider", payment.GatewayProvider),
		)
		return nil, ErrPaymentNotFound
	}
	if !verifyMomoWebhookSignature(s.webhookSecret, req) {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("payment webhook rejected due to invalid signature")
		return nil, ErrInvalidWebhookSignature
	}
	if payment.Status != model.PaymentStatusPending {
		payments, listErr := s.repo.ListByOrderID(ctx, payment.OrderID)
		if listErr != nil {
			outcome = appobs.OutcomeSystemError
			requestLog.Error("payment webhook failed while reloading payment history", zap.Error(listErr))
			return nil, listErr
		}
		requestLog.Info("payment webhook treated as idempotent replay",
			zap.String("current_status", string(payment.Status)),
		)
		return enrichPayment(payment, payments), nil
	}
	if roundMoney(req.Amount) != roundMoney(payment.Amount) {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("payment webhook rejected due to amount mismatch",
			zap.Float64("webhook_amount", req.Amount),
			zap.Float64("expected_amount", payment.Amount),
		)
		return nil, ErrPaymentAmountMismatch
	}

	payment.SignatureVerified = true
	payment.GatewayTransactionID = strings.TrimSpace(req.GatewayTransactionID)
	payment.UpdatedAt = time.Now()
	if req.ResultCode == 0 {
		payment.Status = model.PaymentStatusCompleted
		payment.FailureReason = ""
	} else {
		payment.Status = model.PaymentStatusFailed
		payment.FailureReason = strings.TrimSpace(req.Message)
	}

	if err := s.repo.Update(ctx, payment); err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("payment webhook failed while updating payment state",
			zap.String("next_status", string(payment.Status)),
			zap.Error(err),
		)
		return nil, err
	}

	payments, err := s.repo.ListByOrderID(ctx, payment.OrderID)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("payment webhook failed while loading enriched payments", zap.Error(err))
		return nil, err
	}

	enriched := enrichPayment(payment, payments)
	s.publishPaymentEvent(ctx, enriched, "")
	requestLog.Info("payment webhook processed",
		zap.String("payment_status", string(payment.Status)),
		zap.String("gateway_transaction_id", payment.GatewayTransactionID),
	)

	return enriched, nil
}

// findWebhookPayment resolves the target payment for a webhook using the most
// stable identifier available.
//
// Inputs:
//   - ctx carries cancellation to repository work.
//   - req contains the webhook payload.
//
// Returns:
//   - the matching payment when found.
//   - nil when neither identifier resolves to a payment.
//   - any repository error encountered during lookup.
//
// Edge cases:
//   - payment id takes precedence because it is the internal primary key.
//
// Side effects:
//   - none.
//
// Performance:
//   - at most one repository lookup because the second path is only used when
//     payment_id is absent.
func (s *PaymentService) findWebhookPayment(ctx context.Context, req dto.MomoWebhookRequest) (*model.Payment, error) {
	if strings.TrimSpace(req.PaymentID) != "" {
		return s.repo.GetByID(ctx, strings.TrimSpace(req.PaymentID))
	}
	if strings.TrimSpace(req.GatewayOrderID) != "" {
		return s.repo.GetByGatewayOrderID(ctx, strings.TrimSpace(req.GatewayOrderID))
	}
	return nil, nil
}

// recordAuditEntry persists optional payment audit metadata without failing the
// primary payment flow.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - entry is the audit entry to persist.
//
// Returns:
//   - none.
//
// Edge cases:
//   - nil entries are ignored.
//   - repository failures are logged as warnings because audit persistence is
//     best-effort here.
//
// Side effects:
//   - writes one audit row when possible.
//   - emits a warning log on failure.
//
// Performance:
//   - O(1) application work plus one repository insert.
func (s *PaymentService) recordAuditEntry(ctx context.Context, entry *model.AuditEntry) {
	if entry == nil {
		return
	}

	if err := s.repo.CreateAuditEntry(ctx, entry); err != nil {
		s.log.Warn("failed to persist audit entry",
			zap.String("entity_type", entry.EntityType),
			zap.String("entity_id", entry.EntityID),
			zap.String("action", entry.Action),
			zap.Error(err),
		)
	}
}
