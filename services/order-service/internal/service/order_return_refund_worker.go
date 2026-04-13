package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

const (
	returnRefundPollInterval    = 2 * time.Second
	returnRefundLease           = 30 * time.Second
	returnRefundClaimLimit      = 10
	returnRefundWorkerActorID   = "return-refund-worker"
	returnRefundWorkerActorRole = "system"
)

// StartReturnRefundWorker drains locally scheduled `refund_pending` returns and
// executes the downstream refund asynchronously with retry-safe semantics.
func (s *OrderService) StartReturnRefundWorker(ctx context.Context) {
	if s.paymentClient == nil {
		s.log.Warn("payment client is not available, return refund worker is disabled")
		return
	}

	ticker := time.NewTicker(returnRefundPollInterval)
	defer ticker.Stop()

	for {
		if err := s.flushPendingReturnRefunds(ctx); err != nil && ctx.Err() == nil {
			s.log.Warn("return refund worker batch failed", zap.Error(err))
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *OrderService) flushPendingReturnRefunds(ctx context.Context) error {
	for {
		returns, err := s.repo.ClaimPendingReturnRefunds(ctx, returnRefundClaimLimit, returnRefundLease)
		if err != nil {
			return err
		}
		if len(returns) == 0 {
			return nil
		}

		for _, returnRequest := range returns {
			attemptCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			err := s.processPendingReturnRefund(attemptCtx, returnRequest)
			cancel()
			if err == nil {
				continue
			}

			nextRetryAt := nextReturnRefundRetryAt(returnRequest.RefundAttemptCount)
			if markErr := s.repo.MarkReturnRefundAttemptFailed(
				ctx,
				returnRequest.ID,
				truncateReturnRefundError(err),
				nextRetryAt,
			); markErr != nil {
				s.log.Warn("failed to mark return refund attempt failed",
					zap.String("return_id", returnRequest.ID),
					zap.Error(markErr),
				)
			}

			s.log.Warn("return refund attempt failed",
				zap.String("return_id", returnRequest.ID),
				zap.String("order_id", returnRequest.OrderID),
				zap.Int("attempt_count", returnRequest.RefundAttemptCount),
				zap.Time("next_retry_at", nextRetryAt),
				zap.Error(err),
			)
		}
	}
}

func (s *OrderService) processPendingReturnRefund(ctx context.Context, returnRequest *model.ReturnRequest) error {
	if strings.TrimSpace(returnRequest.RefundChargePaymentID) == "" {
		return fmt.Errorf("return refund metadata is missing charge payment id")
	}
	if returnRequest.RefundAmount <= 0 {
		return fmt.Errorf("return refund metadata is missing refund amount")
	}
	if strings.TrimSpace(returnRequest.RefundIdempotencyKey) == "" {
		return fmt.Errorf("return refund metadata is missing idempotency key")
	}

	refund, err := s.paymentClient.RefundPayment(
		ctx,
		returnRequest.RefundChargePaymentID,
		returnRequest.RefundAmount,
		fmt.Sprintf("Return %s refunded", returnRequest.ID),
		returnRequest.RefundIdempotencyKey,
	)
	if err != nil {
		return err
	}

	completedAt := time.Now()
	updatedReturn := *returnRequest
	updatedReturn.Status = model.ReturnStatusRefunded
	updatedReturn.RefundPaymentID = refund.ID
	updatedReturn.RefundLastError = ""
	updatedReturn.RefundCompletedAt = &completedAt
	updatedReturn.RefundNextRetryAt = nil
	updatedReturn.RefundProcessingStarted = nil
	updatedReturn.UpdatedAt = completedAt

	outbox, err := buildReturnOutboxMessage(
		ctx,
		&updatedReturn,
		model.ReturnStatusRefunded,
		updatedReturn.RefundAmount,
	)
	if err != nil {
		return err
	}

	return s.repo.CompleteReturnRefund(
		ctx,
		&updatedReturn,
		returnRefundWorkerActorID,
		returnRefundWorkerActorRole,
		"refund processed asynchronously",
		outbox,
	)
}

func nextReturnRefundRetryAt(attemptCount int) time.Time {
	switch {
	case attemptCount <= 1:
		return time.Now().Add(30 * time.Second)
	case attemptCount == 2:
		return time.Now().Add(2 * time.Minute)
	case attemptCount == 3:
		return time.Now().Add(5 * time.Minute)
	default:
		return time.Now().Add(15 * time.Minute)
	}
}

func truncateReturnRefundError(err error) string {
	if err == nil {
		return ""
	}

	message := strings.TrimSpace(err.Error())
	if len(message) <= 500 {
		return message
	}

	return message[:500]
}
