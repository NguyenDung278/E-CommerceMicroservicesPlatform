package model

import "time"

// PaymentStatus represents the payment lifecycle.
type PaymentStatus string
type PaymentTransactionType string

const (
	PaymentStatusPending   PaymentStatus = "pending"
	PaymentStatusCompleted PaymentStatus = "completed"
	PaymentStatusFailed    PaymentStatus = "failed"
	PaymentStatusRefunded  PaymentStatus = "refunded"
)

const (
	PaymentTransactionTypeCharge PaymentTransactionType = "charge"
	PaymentTransactionTypeRefund PaymentTransactionType = "refund"
)

// Payment represents a payment record.
type Payment struct {
	ID                   string                 `json:"id"`
	OrderID              string                 `json:"order_id"`
	UserID               string                 `json:"user_id"`
	OrderTotal           float64                `json:"order_total"`
	Amount               float64                `json:"amount"`
	Status               PaymentStatus          `json:"status"`
	TransactionType      PaymentTransactionType `json:"transaction_type"`
	ReferencePaymentID   string                 `json:"reference_payment_id,omitempty"`
	PaymentMethod        string                 `json:"payment_method"` // "credit_card", "paypal", "momo", etc.
	GatewayProvider      string                 `json:"gateway_provider"`
	GatewayTransactionID string                 `json:"gateway_transaction_id,omitempty"`
	GatewayOrderID       string                 `json:"gateway_order_id,omitempty"`
	CheckoutURL          string                 `json:"checkout_url,omitempty"`
	SignatureVerified    bool                   `json:"signature_verified"`
	FailureReason        string                 `json:"failure_reason,omitempty"`
	NetPaidAmount        float64                `json:"net_paid_amount,omitempty"`
	OutstandingAmount    float64                `json:"outstanding_amount,omitempty"`
	CreatedAt            time.Time              `json:"created_at"`
	UpdatedAt            time.Time              `json:"updated_at"`
}
