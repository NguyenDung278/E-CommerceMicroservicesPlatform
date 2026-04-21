package wishlistmodel

import "time"

type WishlistItem struct {
	UserID        string    `json:"user_id"`
	ProductID     string    `json:"product_id"`
	BaselinePrice float64   `json:"baseline_price,omitempty"`
	BaselineStock int       `json:"baseline_stock,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
