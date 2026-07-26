package service

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

// normalizePaymentMethod maps API aliases into the canonical internal payment
// method names.
//
// Inputs:
//   - value is the raw method string from the API request.
//
// Returns:
//   - the canonical method string.
//   - ErrUnsupportedPaymentMethod for unsupported values.
//
// Edge cases:
//   - blank values default to manual to preserve current API behavior.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the input length due to trimming and lowercasing.
func normalizePaymentMethod(value string) (string, error) {
	method := strings.ToLower(strings.TrimSpace(value))
	switch method {
	case "", "manual", "demo", "credit_card":
		return "manual", nil
	case "momo", "digital_wallet":
		return "momo", nil
	case "vnpay":
		return "vnpay", nil
	default:
		return "", ErrUnsupportedPaymentMethod
	}
}

// formatMoney normalizes an amount into the fixed two-decimal representation
// used by webhook signatures.
//
// Inputs:
//   - value is the raw monetary amount.
//
// Returns:
//   - the rounded two-decimal string form.
//
// Edge cases:
//   - rounding follows roundMoney to keep signature generation and validation aligned.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func formatMoney(value float64) string {
	return fmt.Sprintf("%.2f", roundMoney(value))
}

// isPayableOrderStatus gates payment creation to order states that may still
// accept charges.
//
// Inputs:
//   - status is the raw order status returned by order-service.
//
// Returns:
//   - true when the order may accept a new payment attempt.
//
// Edge cases:
//   - comparison is case-insensitive and whitespace-tolerant.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the input length due to trimming and lowercasing.
func isPayableOrderStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "pending", "paid":
		return true
	default:
		return false
	}
}

// roundMoney normalizes floating-point currency values to two decimal places.
//
// Inputs:
//   - value is the raw monetary amount.
//
// Returns:
//   - the rounded amount with two-decimal precision.
//
// Edge cases:
//   - standard IEEE floating-point caveats still apply.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}

// isUniqueViolation detects PostgreSQL unique-constraint failures raised by the
// payment repository.
//
// Inputs:
//   - err is the raw repository error.
//
// Returns:
//   - true when PostgreSQL reported SQLSTATE 23505.
//
// Edge cases:
//   - wrapped pq errors are supported through errors.As.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}

func replacePayment(payments []*model.Payment, updated *model.Payment) []*model.Payment {
	replaced := make([]*model.Payment, 0, len(payments))
	found := false
	for _, payment := range payments {
		if payment.ID == updated.ID {
			copyValue := *updated
			replaced = append(replaced, &copyValue)
			found = true
			continue
		}
		copyValue := *payment
		replaced = append(replaced, &copyValue)
	}
	if !found {
		copyValue := *updated
		replaced = append([]*model.Payment{&copyValue}, replaced...)
	}

	return replaced
}
