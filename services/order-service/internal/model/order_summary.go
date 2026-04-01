package model

import "time"

// PaymentSummary is the payment read model exposed by order summary APIs.
// It mirrors the user-facing payment fields already consumed by the frontend.
type PaymentSummary struct {
	ID                   string    `json:"id"`
	OrderID              string    `json:"order_id"`
	UserID               string    `json:"user_id"`
	OrderTotal           float64   `json:"order_total"`
	Amount               float64   `json:"amount"`
	Status               string    `json:"status"`
	TransactionType      string    `json:"transaction_type"`
	ReferencePaymentID   string    `json:"reference_payment_id,omitempty"`
	PaymentMethod        string    `json:"payment_method"`
	GatewayProvider      string    `json:"gateway_provider"`
	GatewayTransactionID string    `json:"gateway_transaction_id,omitempty"`
	GatewayOrderID       string    `json:"gateway_order_id,omitempty"`
	CheckoutURL          string    `json:"checkout_url,omitempty"`
	SignatureVerified    bool      `json:"signature_verified"`
	FailureReason        string    `json:"failure_reason,omitempty"`
	NetPaidAmount        float64   `json:"net_paid_amount,omitempty"`
	OutstandingAmount    float64   `json:"outstanding_amount,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

type UserOrderSummary struct {
	Orders          []*Order                    `json:"orders"`
	PaymentsByOrder map[string][]PaymentSummary `json:"payments_by_order"`
}
