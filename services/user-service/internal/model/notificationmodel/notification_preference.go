package notificationmodel

import "time"

const (
	NotificationTopicOrderUpdates        = "order_updates"
	NotificationTopicPaymentUpdates      = "payment_updates"
	NotificationTopicReturnUpdates       = "return_updates"
	NotificationTopicWishlistBackInStock = "wishlist_back_in_stock"
	NotificationTopicWishlistPriceDrop   = "wishlist_price_drop"
)

type NotificationPreference struct {
	UserID    string    `json:"user_id"`
	Topic     string    `json:"topic"`
	Enabled   bool      `json:"enabled"`
	UpdatedAt time.Time `json:"updated_at"`
}
