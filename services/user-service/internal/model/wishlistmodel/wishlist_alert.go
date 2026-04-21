package wishlistmodel

import "time"

const (
	WishlistAlertKindBackInStock = "back_in_stock"
	WishlistAlertKindPriceDrop   = "price_drop"
)

type WishlistAlert struct {
	ProductID     string    `json:"product_id"`
	ProductName   string    `json:"product_name,omitempty"`
	Kind          string    `json:"kind"`
	BaselinePrice float64   `json:"baseline_price,omitempty"`
	CurrentPrice  float64   `json:"current_price,omitempty"`
	BaselineStock int       `json:"baseline_stock,omitempty"`
	CurrentStock  int       `json:"current_stock,omitempty"`
	DetectedAt    time.Time `json:"detected_at"`
}

type WishlistAlertDelivery struct {
	UserID    string        `json:"user_id"`
	UserEmail string        `json:"user_email,omitempty"`
	Topic     string        `json:"topic"`
	Alert     WishlistAlert `json:"alert"`
}
