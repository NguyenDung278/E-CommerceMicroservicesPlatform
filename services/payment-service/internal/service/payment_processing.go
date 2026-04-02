package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

// ProcessPayment validates a new charge request, persists it, and publishes the
// resulting payment event when appropriate.
//
// Inputs:
//   - ctx carries cancellation to order lookup, repository calls, and event publication.
//   - userID and userEmail identify the payer and downstream notification target.
//   - authHeader is forwarded to order-service for ownership-safe order lookup.
//   - req contains the target order, payment method, and optional amount.
//
// Returns:
//   - the enriched payment record including outstanding-balance fields.
//   - a business or system error describing why the payment could not be created.
//
// Edge cases:
//   - zero or omitted amounts default to the remaining outstanding balance.
//   - MoMo payments remain pending until HandleMomoWebhook confirms them.
//
// Side effects:
//   - reads the authoritative order from order-service.
//   - writes a payment row to PostgreSQL.
//   - may publish a `payment.completed` event for immediately completed methods.
//
// Performance:
//   - dominated by one remote order lookup, one payment-history query, and one insert.
func (s *PaymentService) ProcessPayment(ctx context.Context, userID, userEmail, authHeader string, req dto.ProcessPaymentRequest) (*model.Payment, error) {
	startedAt := time.Now()
	outcome := appobs.OutcomeSuccess
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("user_id", userID),
		zap.String("order_id", req.OrderID),
	)
	defer func() {
		appobs.ObserveOperation("payment-service", "process_payment", outcome, time.Since(startedAt))
	}()

	if s.orderClient == nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("payment processing failed because order client is not configured")
		return nil, fmt.Errorf("order client is not configured")
	}

	order, err := s.orderClient.GetOrder(ctx, authHeader, req.OrderID)
	if err != nil {
		outcome = appobs.OutcomeFromError(err, client.ErrOrderNotFound)
		requestLog.Warn("payment processing failed during order lookup", zap.String("outcome", outcome), zap.Error(err))
		if errors.Is(err, client.ErrOrderNotFound) {
			return nil, ErrOrderNotFound
		}
		return nil, err
	}
	if order.UserID != userID {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("payment processing rejected because order does not belong to user")
		return nil, ErrOrderNotFound
	}
	if !isPayableOrderStatus(order.Status) {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("payment processing rejected because order is not payable", zap.String("order_status", order.Status))
		return nil, ErrOrderNotPayable
	}

	payments, err := s.repo.ListByOrderID(ctx, req.OrderID)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("payment processing failed while loading payment history", zap.Error(err))
		return nil, err
	}

	netPaid := summarizeNetPaid(payments)
	outstanding := roundMoney(order.TotalPrice - netPaid)
	if outstanding <= 0 {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("payment processing skipped because order is already settled", zap.Float64("net_paid", netPaid))
		return nil, ErrPaymentAlreadySettled
	}

	amount := roundMoney(req.Amount)
	if amount <= 0 {
		amount = outstanding
	}
	if amount <= 0 || amount > outstanding {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("payment processing rejected due to invalid amount",
			zap.Float64("requested_amount", req.Amount),
			zap.Float64("normalized_amount", amount),
			zap.Float64("outstanding_amount", outstanding),
		)
		return nil, ErrInvalidPaymentAmount
	}

	method, err := normalizePaymentMethod(req.PaymentMethod)
	if err != nil {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("payment processing rejected due to unsupported method", zap.Error(err))
		return nil, err
	}

	now := time.Now()
	payment := &model.Payment{
		ID:              uuid.New().String(),
		OrderID:         req.OrderID,
		UserID:          userID,
		OrderTotal:      roundMoney(order.TotalPrice),
		Amount:          amount,
		Status:          model.PaymentStatusCompleted,
		TransactionType: model.PaymentTransactionTypeCharge,
		PaymentMethod:   method,
		GatewayProvider: resolveGatewayProvider(method),
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if payment.GatewayProvider == "momo" {
		payment.Status = model.PaymentStatusPending
		payment.GatewayOrderID = buildMomoGatewayOrderID(payment.ID)
		payment.CheckoutURL = buildMomoCheckoutURL(s.momoReturnURL, payment.GatewayOrderID)
	}

	if err := s.repo.Create(ctx, payment); err != nil {
		outcome = appobs.OutcomeSystemError
		if isUniqueViolation(err) {
			outcome = appobs.OutcomeBusinessError
			requestLog.Warn("payment processing rejected due to duplicate payment record",
				zap.String("payment_id", payment.ID),
				zap.Error(err),
			)
			return nil, ErrDuplicatePayment
		}

		requestLog.Error("payment processing failed while persisting payment",
			zap.String("payment_id", payment.ID),
			zap.Error(err),
		)
		return nil, err
	}

	enriched := enrichPayment(payment, append([]*model.Payment{payment}, payments...))
	if payment.Status == model.PaymentStatusCompleted {
		s.publishPaymentEvent(ctx, enriched, userEmail)
	}

	requestLog.Info("payment processed",
		zap.String("payment_id", payment.ID),
		zap.String("payment_status", string(payment.Status)),
		zap.String("payment_method", payment.PaymentMethod),
		zap.String("gateway_provider", payment.GatewayProvider),
		zap.Float64("amount", payment.Amount),
		zap.Float64("outstanding_amount", enriched.OutstandingAmount),
	)

	return enriched, nil
}
