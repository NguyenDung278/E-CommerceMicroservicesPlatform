package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/dto"
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
	default:
		return "", ErrUnsupportedPaymentMethod
	}
}

// resolveGatewayProvider maps the canonical method name to the provider that
// downstream systems expect.
//
// Inputs:
//   - method is the canonical payment method.
//
// Returns:
//   - the gateway provider identifier.
//
// Edge cases:
//   - unknown methods default to manual because normalizePaymentMethod already
//     guards the public boundary.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func resolveGatewayProvider(method string) string {
	if method == "momo" {
		return "momo"
	}
	return "manual"
}

// buildMomoGatewayOrderID constructs the external order id used in the simulated
// MoMo checkout flow.
//
// Inputs:
//   - paymentID is the internal payment primary key.
//
// Returns:
//   - the prefixed gateway order id.
//
// Edge cases:
//   - blank payment ids still produce a predictable prefix-only value.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the payment id length.
func buildMomoGatewayOrderID(paymentID string) string {
	return "MOMO-" + paymentID
}

// buildMomoCheckoutURL appends the gateway order id to the configured return
// URL used by the simulated wallet flow.
//
// Inputs:
//   - returnURL is the configured frontend return destination.
//   - gatewayOrderID is the simulated gateway order id.
//
// Returns:
//   - the completed checkout URL or an empty string when configuration is missing.
//
// Edge cases:
//   - existing query strings are preserved by switching from `?` to `&`.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the URL lengths.
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

// verifyMomoWebhookSignature authenticates the simulated MoMo webhook payload.
//
// Inputs:
//   - secret is the configured shared secret.
//   - req is the raw webhook payload.
//
// Returns:
//   - true when the provided signature matches the payload HMAC.
//
// Edge cases:
//   - blank secrets always fail closed.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the payload length due to HMAC computation.
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
