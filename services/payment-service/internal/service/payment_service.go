package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/repository"
)

// PaymentEvent is published to RabbitMQ after payment processing.
type PaymentEvent struct {
	PaymentID          string  `json:"payment_id"`
	OrderID            string  `json:"order_id"`
	UserID             string  `json:"user_id"`
	UserEmail          string  `json:"user_email"`
	Amount             float64 `json:"amount"`
	Status             string  `json:"status"`
	TransactionType    string  `json:"transaction_type"`
	NetPaidAmount      float64 `json:"net_paid_amount"`
	OutstandingAmount  float64 `json:"outstanding_amount"`
	FullyPaid          bool    `json:"fully_paid"`
	FullyRefunded      bool    `json:"fully_refunded"`
	GatewayProvider    string  `json:"gateway_provider"`
	GatewayTransaction string  `json:"gateway_transaction_id,omitempty"`
	RequestID          string  `json:"request_id,omitempty"`
}

type PaymentService struct {
	repo          repository.PaymentRepository
	orderClient   *client.OrderClient
	amqpCh        *amqp.Channel
	log           *zap.Logger
	webhookSecret string
	momoReturnURL string
}

func NewPaymentService(
	repo repository.PaymentRepository,
	orderClient *client.OrderClient,
	amqpCh *amqp.Channel,
	log *zap.Logger,
	webhookSecret string,
	momoReturnURL string,
) *PaymentService {
	return &PaymentService{
		repo:          repo,
		orderClient:   orderClient,
		amqpCh:        amqpCh,
		log:           log,
		webhookSecret: strings.TrimSpace(webhookSecret),
		momoReturnURL: strings.TrimSpace(momoReturnURL),
	}
}

// ProcessPayment handles both one-shot and split payments.
// Non-MoMo methods are completed immediately, while MoMo stays pending until
// the webhook confirms the outcome.
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

	updatedPayments := append([]*model.Payment{payment}, payments...)
	enriched := enrichPayment(payment, updatedPayments)

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

func (s *PaymentService) GetPayment(ctx context.Context, paymentID, userID string) (*model.Payment, error) {
	payment, err := s.repo.GetByIDForUser(ctx, paymentID, userID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, ErrPaymentNotFound
	}

	payments, err := s.repo.ListByOrderIDForUser(ctx, payment.OrderID, userID)
	if err != nil {
		return nil, err
	}

	return enrichPayment(payment, payments), nil
}

func (s *PaymentService) GetPaymentByOrder(ctx context.Context, orderID, userID string) (*model.Payment, error) {
	payment, err := s.repo.GetByOrderIDForUser(ctx, orderID, userID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, ErrPaymentNotFound
	}

	payments, err := s.repo.ListByOrderIDForUser(ctx, orderID, userID)
	if err != nil {
		return nil, err
	}

	return enrichPayment(payment, payments), nil
}

func (s *PaymentService) ListPaymentsByOrder(ctx context.Context, orderID, userID string) ([]*model.Payment, error) {
	payments, err := s.repo.ListByOrderIDForUser(ctx, orderID, userID)
	if err != nil {
		return nil, err
	}

	return enrichPayments(payments), nil
}

func (s *PaymentService) ListPaymentsByOrderAdmin(ctx context.Context, orderID string) ([]*model.Payment, error) {
	payments, err := s.repo.ListByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	return enrichPayments(payments), nil
}

func (s *PaymentService) ListPaymentHistory(ctx context.Context, userID string) ([]*model.Payment, error) {
	payments, err := s.repo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return enrichPayments(payments), nil
}

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

	updatedPayments := append([]*model.Payment{refund}, payments...)
	enriched := enrichPayment(refund, updatedPayments)
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

// publishPaymentEvent sends payment lifecycle updates so other services can keep
// order state and notifications in sync.
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
		err = s.amqpCh.PublishWithContext(publishCtx,
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

func paymentEventRoutingKey(payment *model.Payment) string {
	if payment.TransactionType == model.PaymentTransactionTypeRefund && payment.Status == model.PaymentStatusRefunded {
		return "payment.refunded"
	}
	if payment.Status == model.PaymentStatusFailed {
		return "payment.failed"
	}
	return "payment.completed"
}

func (s *PaymentService) findWebhookPayment(ctx context.Context, req dto.MomoWebhookRequest) (*model.Payment, error) {
	if strings.TrimSpace(req.PaymentID) != "" {
		return s.repo.GetByID(ctx, strings.TrimSpace(req.PaymentID))
	}
	if strings.TrimSpace(req.GatewayOrderID) != "" {
		return s.repo.GetByGatewayOrderID(ctx, strings.TrimSpace(req.GatewayOrderID))
	}
	return nil, nil
}

func enrichPayments(payments []*model.Payment) []*model.Payment {
	if len(payments) == 0 {
		return []*model.Payment{}
	}

	byOrder := map[string][]*model.Payment{}
	for _, payment := range payments {
		byOrder[payment.OrderID] = append(byOrder[payment.OrderID], payment)
	}

	enriched := make([]*model.Payment, 0, len(payments))
	for _, payment := range payments {
		enriched = append(enriched, enrichPayment(payment, byOrder[payment.OrderID]))
	}

	return enriched
}

func enrichPayment(payment *model.Payment, payments []*model.Payment) *model.Payment {
	if payment == nil {
		return nil
	}

	copyValue := *payment
	netPaid := summarizeNetPaid(payments)
	copyValue.NetPaidAmount = netPaid
	copyValue.OutstandingAmount = roundMoney(math.Max(copyValue.OrderTotal-netPaid, 0))
	return &copyValue
}

func summarizeNetPaid(payments []*model.Payment) float64 {
	total := 0.0
	for _, payment := range payments {
		switch payment.TransactionType {
		case model.PaymentTransactionTypeCharge:
			if payment.Status == model.PaymentStatusCompleted {
				total += payment.Amount
			}
		case model.PaymentTransactionTypeRefund:
			if payment.Status == model.PaymentStatusRefunded {
				total -= payment.Amount
			}
		}
	}

	return roundMoney(total)
}

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

func refundableAmountForCharge(paymentID string, amount float64, payments []*model.Payment) float64 {
	refunded := 0.0
	for _, payment := range payments {
		if payment.TransactionType == model.PaymentTransactionTypeRefund &&
			payment.Status == model.PaymentStatusRefunded &&
			payment.ReferencePaymentID == paymentID {
			refunded += payment.Amount
		}
	}

	return roundMoney(math.Max(amount-refunded, 0))
}

func normalizePaymentMethod(value string) (string, error) {
	method := strings.ToLower(strings.TrimSpace(value))
	switch method {
	case "", "manual", "demo", "credit_card":
		return "manual", nil
	case "momo", "digital_wallet":
		return "momo", nil
	default:
		return "", ErrUnsupportedPaymentMethod
	}
}

func resolveGatewayProvider(method string) string {
	if method == "momo" {
		return "momo"
	}
	return "manual"
}

func buildMomoGatewayOrderID(paymentID string) string {
	return "MOMO-" + paymentID
}

func buildMomoCheckoutURL(returnURL, gatewayOrderID string) string {
	trimmed := strings.TrimSpace(returnURL)
	if trimmed == "" || gatewayOrderID == "" {
		return ""
	}
	separator := "?"
	if strings.Contains(trimmed, "?") {
		separator = "&"
	}
	return fmt.Sprintf("%s%sgateway_order_id=%s", trimmed, separator, gatewayOrderID)
}

func verifyMomoWebhookSignature(secret string, req dto.MomoWebhookRequest) bool {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return false
	}

	payload := strings.Join([]string{
		strings.TrimSpace(req.PaymentID),
		strings.TrimSpace(req.GatewayOrderID),
		strings.TrimSpace(req.GatewayTransactionID),
		formatMoney(req.Amount),
		fmt.Sprintf("%d", req.ResultCode),
	}, "|")

	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(payload))
	expected := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(strings.TrimSpace(req.Signature)))
}

func formatMoney(value float64) string {
	return fmt.Sprintf("%.2f", roundMoney(value))
}

func isPayableOrderStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "pending", "paid":
		return true
	default:
		return false
	}
}

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
