package service

import (
	"math"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

type orderPaymentSummary struct {
	netPaid float64
}

// enrichPayments clones and enriches a payment list with per-order derived
// fields such as net paid and outstanding amount.
//
// Inputs:
//   - payments is the repository-ordered payment list, potentially spanning
//     multiple orders.
//
// Returns:
//   - a new slice containing cloned payment values with derived totals.
//
// Edge cases:
//   - empty inputs return a non-nil empty slice to keep handler code simple.
//
// Side effects:
//   - allocates cloned payment structs so callers do not mutate repository
//     objects.
//
// Performance:
//   - O(n) overall by precomputing one summary per order instead of recalculating
//     totals for every row.
func enrichPayments(payments []*model.Payment) []*model.Payment {
	if len(payments) == 0 {
		return []*model.Payment{}
	}

	summaries := buildOrderPaymentSummaries(payments)
	enriched := make([]*model.Payment, 0, len(payments))
	for _, payment := range payments {
		enriched = append(enriched, clonePaymentWithSummary(payment, summaries[payment.OrderID]))
	}

	return enriched
}

// enrichPayment clones and enriches a single payment using its sibling payment
// history.
//
// Inputs:
//   - payment is the target payment row.
//   - payments is the full payment history for the same order.
//
// Returns:
//   - a cloned payment with derived fields populated.
//
// Edge cases:
//   - nil input payment returns nil so callers can propagate not-found semantics.
//
// Side effects:
//   - allocates one cloned payment struct.
//
// Performance:
//   - O(n) over sibling payments because a one-off summary is computed once.
func enrichPayment(payment *model.Payment, payments []*model.Payment) *model.Payment {
	if payment == nil {
		return nil
	}

	return clonePaymentWithSummary(payment, summarizeOrderPayments(payments))
}

// clonePaymentWithSummary copies a payment value and applies a precomputed order
// summary.
//
// Inputs:
//   - payment is the source payment row.
//   - summary contains already calculated derived totals for the payment's order.
//
// Returns:
//   - a cloned payment struct with NetPaidAmount and OutstandingAmount populated.
//
// Edge cases:
//   - callers must supply a summary for the payment's order.
//
// Side effects:
//   - allocates one payment copy.
//
// Performance:
//   - O(1).
func clonePaymentWithSummary(payment *model.Payment, summary orderPaymentSummary) *model.Payment {
	copyValue := *payment
	copyValue.NetPaidAmount = summary.netPaid
	copyValue.OutstandingAmount = roundMoney(math.Max(copyValue.OrderTotal-summary.netPaid, 0))
	return &copyValue
}

// buildOrderPaymentSummaries precomputes net-paid metrics for every order in a
// mixed payment list.
//
// Inputs:
//   - payments is the repository-ordered payment list.
//
// Returns:
//   - a map of order id to aggregated payment summary.
//
// Edge cases:
//   - multiple payments for the same order collapse into one summary entry.
//
// Side effects:
//   - allocates one map sized to the number of distinct orders encountered.
//
// Performance:
//   - O(n) over the payment slice.
func buildOrderPaymentSummaries(payments []*model.Payment) map[string]orderPaymentSummary {
	summaries := make(map[string]orderPaymentSummary, len(payments))
	for _, payment := range payments {
		summary := summaries[payment.OrderID]
		switch payment.TransactionType {
		case model.PaymentTransactionTypeCharge:
			if payment.Status == model.PaymentStatusCompleted {
				summary.netPaid += payment.Amount
			}
		case model.PaymentTransactionTypeRefund:
			if payment.Status == model.PaymentStatusRefunded {
				summary.netPaid -= payment.Amount
			}
		}
		summary.netPaid = roundMoney(summary.netPaid)
		summaries[payment.OrderID] = summary
	}

	return summaries
}

// summarizeOrderPayments computes the derived payment summary for a single
// order's payment history.
//
// Inputs:
//   - payments is the payment history for one order.
//
// Returns:
//   - the aggregated net-paid summary for that order.
//
// Edge cases:
//   - empty histories yield a zero-value summary.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the sibling payment list.
func summarizeOrderPayments(payments []*model.Payment) orderPaymentSummary {
	return orderPaymentSummary{netPaid: summarizeNetPaid(payments)}
}

// summarizeNetPaid calculates the net settled amount for one order history.
//
// Inputs:
//   - payments is the payment history for one order.
//
// Returns:
//   - completed charges minus refunded amounts.
//
// Edge cases:
//   - pending or failed payments do not contribute to the total.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the payment history.
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

// refundableAmountForCharge calculates how much of a completed charge remains
// refundable after considering prior refunds.
//
// Inputs:
//   - paymentID identifies the original charge payment.
//   - amount is the original charged amount.
//   - payments is the full payment history for the order.
//
// Returns:
//   - the remaining refundable amount, never below zero.
//
// Edge cases:
//   - only refunded refund rows linked to the charge are subtracted.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the order's payment history.
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
