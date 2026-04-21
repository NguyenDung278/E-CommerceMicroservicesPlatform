package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

const maxIdempotencyKeyLength = 128

func normalizeIdempotencyKey(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}
	if len(trimmed) > maxIdempotencyKeyLength {
		return "", ErrInvalidIdempotencyKey
	}

	return trimmed, nil
}

func hashProcessPaymentRequest(req dto.ProcessPaymentRequest) string {
	method := strings.TrimSpace(req.PaymentMethod)
	if normalizedMethod, err := normalizePaymentMethod(req.PaymentMethod); err == nil {
		method = normalizedMethod
	}

	sum := sha256.Sum256([]byte(strings.Join([]string{
		strings.TrimSpace(req.OrderID),
		method,
		formatMoney(req.Amount),
	}, "|")))

	return hex.EncodeToString(sum[:])
}

func hashRefundPaymentRequest(paymentID string, req dto.RefundPaymentRequest) string {
	sum := sha256.Sum256([]byte(strings.Join([]string{
		strings.TrimSpace(paymentID),
		formatMoney(req.Amount),
		strings.TrimSpace(req.Message),
	}, "|")))

	return hex.EncodeToString(sum[:])
}

func (s *PaymentService) findIdempotentPayment(
	ctx context.Context,
	userID string,
	idempotencyKey string,
	requestHash string,
) (*model.Payment, error) {
	if idempotencyKey == "" {
		return nil, nil
	}

	record, err := s.repo.GetIdempotencyKey(ctx, userID, idempotencyKey)
	if err != nil {
		return nil, err
	}
	if record == nil {
		return nil, nil
	}
	if record.RequestHash != requestHash {
		return nil, ErrIdempotencyKeyConflict
	}

	payment, err := s.repo.GetByID(ctx, record.PaymentID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, fmt.Errorf("payment idempotency record references missing payment %s", record.PaymentID)
	}

	return s.loadEnrichedPayment(ctx, payment)
}
