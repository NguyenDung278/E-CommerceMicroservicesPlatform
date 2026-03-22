package dto

import "time"

// CreateOrderRequest represents a checkout request.
type CreateOrderRequest struct {
	Items           []OrderItemRequest      `json:"items" validate:"required,min=1,dive"`
	CouponCode      string                  `json:"coupon_code" validate:"omitempty,min=3,max=64"`
	ShippingMethod  string                  `json:"shipping_method" validate:"omitempty,oneof=standard express pickup"`
	ShippingAddress *ShippingAddressRequest `json:"shipping_address,omitempty"`
}

// OrderItemRequest represents a single item in a checkout request.
type OrderItemRequest struct {
	ProductID string  `json:"product_id" validate:"required"`
	Name      string  `json:"name" validate:"omitempty,min=1"`
	Price     float64 `json:"price" validate:"omitempty,gt=0"`
	Quantity  int     `json:"quantity" validate:"gt=0"`
}

type ShippingAddressRequest struct {
	RecipientName string `json:"recipient_name" validate:"omitempty,min=2,max=100"`
	Phone         string `json:"phone" validate:"omitempty,min=10,max=20"`
	Street        string `json:"street" validate:"omitempty,min=5,max=255"`
	Ward          string `json:"ward" validate:"omitempty,max=100"`
	District      string `json:"district" validate:"omitempty,min=2,max=100"`
	City          string `json:"city" validate:"omitempty,min=2,max=100"`
}

type UpdateOrderStatusRequest struct {
	Status  string `json:"status" validate:"required,oneof=pending paid shipped delivered cancelled refunded"`
	Message string `json:"message" validate:"omitempty,max=255"`
}

type AdminCancelOrderRequest struct {
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
