package service

import (
	"context"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

// GetPayment returns one payment for its owning user with derived balance
// fields populated.
//
// Inputs:
//   - ctx carries cancellation to repository calls.
//   - paymentID identifies the payment record.
//   - userID enforces ownership.
//
// Returns:
//   - the enriched payment record.
//   - ErrPaymentNotFound when the payment is missing or inaccessible.
//
// Edge cases:
//   - outstanding-balance fields are recalculated from all sibling payments on
//     the order, not just the target row.
//
// Side effects:
//   - none.
//
// Performance:
//   - one targeted lookup plus one list query for the order's payment history.
func (s *PaymentService) GetPayment(ctx context.Context, paymentID, userID string) (*model.Payment, error) {
	payment, err := s.repo.GetByIDForUser(ctx, paymentID, userID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, ErrPaymentNotFound
	}

	return s.loadEnrichedUserPayment(ctx, payment, userID)
}

// GetPaymentByOrder returns the latest payment for a user order together with
// derived balance fields.
//
// Inputs:
//   - ctx carries cancellation to repository calls.
//   - orderID identifies the order.
//   - userID enforces ownership.
//
// Returns:
//   - the enriched payment record.
//   - ErrPaymentNotFound when the order has no accessible payment.
//
// Edge cases:
//   - "latest" semantics come from the repository ordering.
//
// Side effects:
//   - none.
//
// Performance:
//   - one targeted lookup plus one list query for the order's payment history.
func (s *PaymentService) GetPaymentByOrder(ctx context.Context, orderID, userID string) (*model.Payment, error) {
	payment, err := s.repo.GetByOrderIDForUser(ctx, orderID, userID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, ErrPaymentNotFound
	}

	return s.loadEnrichedUserPayment(ctx, payment, userID)
}

// ListPaymentsByOrder returns all payments for a user order with derived balance
// fields populated.
//
// Inputs:
//   - ctx carries cancellation to repository calls.
//   - orderID identifies the order.
//   - userID enforces ownership.
//
// Returns:
//   - the enriched payment list.
//   - any repository error.
//
// Edge cases:
//   - empty orders return an empty slice.
//
// Side effects:
//   - none.
//
// Performance:
//   - dominated by one repository list query plus O(n) enrichment work.
func (s *PaymentService) ListPaymentsByOrder(ctx context.Context, orderID, userID string) ([]*model.Payment, error) {
	payments, err := s.repo.ListByOrderIDForUser(ctx, orderID, userID)
	if err != nil {
		return nil, err
	}

	return enrichPayments(payments), nil
}

// ListPaymentsByOrderAdmin returns all payments for an order without ownership
// filtering.
//
// Inputs:
//   - ctx carries cancellation to repository calls.
//   - orderID identifies the order.
//
// Returns:
//   - the enriched payment list.
//   - any repository error.
//
// Edge cases:
//   - authorization must be enforced by the caller.
//
// Side effects:
//   - none.
//
// Performance:
//   - dominated by one repository list query plus O(n) enrichment work.
func (s *PaymentService) ListPaymentsByOrderAdmin(ctx context.Context, orderID string) ([]*model.Payment, error) {
	payments, err := s.repo.ListByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	return enrichPayments(payments), nil
}

// ListPaymentHistory returns all payments owned by a user with derived balance
// fields populated per order.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - userID identifies the owner.
//
// Returns:
//   - the enriched payment history.
//   - any repository error.
//
// Edge cases:
//   - mixed-order histories preserve repository ordering while computing
//     balances per order.
//
// Side effects:
//   - none.
//
// Performance:
//   - one repository list query plus O(n) enrichment using precomputed per-order
//     summaries.
func (s *PaymentService) ListPaymentHistory(ctx context.Context, userID string) ([]*model.Payment, error) {
	payments, err := s.repo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return enrichPayments(payments), nil
}

// loadEnrichedUserPayment loads the sibling payment history needed to calculate
// derived balance fields for one user-visible payment.
//
// Inputs:
//   - ctx carries cancellation to repository calls.
//   - payment is the already loaded target payment.
//   - userID enforces ownership on the sibling lookup.
//
// Returns:
//   - the enriched payment record.
//   - any repository error when the sibling history cannot be loaded.
//
// Edge cases:
//   - callers must ensure payment is non-nil before invoking this helper.
//
// Side effects:
//   - none.
//
// Performance:
//   - dominated by one list query plus O(n) enrichment over sibling payments.
func (s *PaymentService) loadEnrichedUserPayment(ctx context.Context, payment *model.Payment, userID string) (*model.Payment, error) {
	payments, err := s.repo.ListByOrderIDForUser(ctx, payment.OrderID, userID)
	if err != nil {
		return nil, err
	}

	return enrichPayment(payment, payments), nil
}
