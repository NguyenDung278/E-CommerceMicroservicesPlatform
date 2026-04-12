package model

import "time"

type WishlistItem struct {
	UserID    string    `json:"user_id"`
	ProductID string    `json:"product_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
