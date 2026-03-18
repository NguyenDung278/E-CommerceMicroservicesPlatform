package model

import "time"

// PaymentStatus represents the payment lifecycle.
type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "pending"
	PaymentStatusCompleted PaymentStatus = "completed"
	PaymentStatusFailed    PaymentStatus = "failed"
	PaymentStatusRefunded  PaymentStatus = "refunded"
)

// Payment represents a payment record.
type Payment struct {
	ID            string        `json:"id"`
	OrderID       string        `json:"order_id"`
	UserID        string        `json:"user_id"`
	Amount        float64       `json:"amount"`
	Status        PaymentStatus `json:"status"`
	PaymentMethod string        `json:"payment_method"` // "credit_card", "paypal", etc.
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}
