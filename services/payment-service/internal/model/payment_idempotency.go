package model

import "time"

// PaymentIdempotencyRecord stores the durable replay key for a successfully
// persisted payment request.
type PaymentIdempotencyRecord struct {
	UserID         string    `json:"user_id"`
	IdempotencyKey string    `json:"idempotency_key"`
	RequestHash    string    `json:"request_hash"`
	PaymentID      string    `json:"payment_id"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
