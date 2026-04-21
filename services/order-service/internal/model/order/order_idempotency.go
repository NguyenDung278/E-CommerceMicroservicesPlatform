package model

import "time"

// OrderIdempotencyRecord stores the durable replay key for a successfully
// persisted create-order request.
type OrderIdempotencyRecord struct {
	UserID               string    `json:"user_id"`
	IdempotencyKey       string    `json:"idempotency_key"`
	RequestHash          string    `json:"request_hash"`
	OrderID              string    `json:"order_id"`
	ReservationExpiresAt time.Time `json:"reservation_expires_at"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}
