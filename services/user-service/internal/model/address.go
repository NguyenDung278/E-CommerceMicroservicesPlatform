package model

import "time"

// Address represents a shipping address belonging to a user.
type Address struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	RecipientName string    `json:"recipient_name"`
	Phone         string    `json:"phone"`
	Street        string    `json:"street"`
	Ward          string    `json:"ward,omitempty"`
	District      string    `json:"district"`
	City          string    `json:"city"`
	IsDefault     bool      `json:"is_default"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
