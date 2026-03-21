package dto

import "time"

// CreateOrderRequest represents a checkout request.
type CreateOrderRequest struct {
	Items      []OrderItemRequest `json:"items" validate:"required,min=1,dive"`
	CouponCode string             `json:"coupon_code" validate:"omitempty,min=3,max=64"`
}

// OrderItemRequest represents a single item in a checkout request.
type OrderItemRequest struct {
	ProductID string  `json:"product_id" validate:"required"`
	Name      string  `json:"name" validate:"omitempty,min=1"`
	Price     float64 `json:"price" validate:"omitempty,gt=0"`
	Quantity  int     `json:"quantity" validate:"gt=0"`
}

type UpdateOrderStatusRequest struct {
	Status  string `json:"status" validate:"required,oneof=pending paid shipped delivered cancelled refunded"`
	Message string `json:"message" validate:"omitempty,max=255"`
}

type CreateCouponRequest struct {
	Code           string     `json:"code" validate:"required,min=3,max=64"`
	Description    string     `json:"description" validate:"omitempty,max=255"`
	DiscountType   string     `json:"discount_type" validate:"required,oneof=fixed percentage"`
	DiscountValue  float64    `json:"discount_value" validate:"required,gt=0"`
	MinOrderAmount float64    `json:"min_order_amount" validate:"omitempty,gte=0"`
	UsageLimit     int        `json:"usage_limit" validate:"omitempty,gte=0"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
	Active         *bool      `json:"active,omitempty"`
}
