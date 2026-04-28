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
	Location      string `json:"location" validate:"omitempty,min=5,max=255"`
}

type UpdateOrderStatusRequest struct {
	Status  string `json:"status" validate:"required,oneof=pending paid shipped delivered cancelled refunded"`
	Message string `json:"message" validate:"omitempty,max=255"`
}

type CreateReturnRequest struct {
	Reason string              `json:"reason" validate:"required,min=5,max=255"`
	Items  []ReturnItemRequest `json:"items" validate:"required,min=1,dive"`
}

type ReturnItemRequest struct {
	OrderItemID string `json:"order_item_id" validate:"required"`
	Quantity    int    `json:"quantity" validate:"required,gt=0"`
	Reason      string `json:"reason" validate:"omitempty,max=255"`
}

type UpdateReturnStatusRequest struct {
	Status  string `json:"status" validate:"required,oneof=approved rejected received cancelled"`
	Message string `json:"message" validate:"omitempty,max=255"`
}

type RequestReturnRefundRequest struct {
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

type UpdateShipmentTrackingRequest struct {
	Carrier             string     `json:"carrier" validate:"required,min=2,max=80"`
	TrackingNumber      string     `json:"tracking_number" validate:"required,min=3,max=120"`
	TrackingURL         string     `json:"tracking_url" validate:"omitempty,url,max=512"`
	Status              string     `json:"status" validate:"required,oneof=pending in_transit out_for_delivery delivered exception"`
	EstimatedDeliveryAt *time.Time `json:"estimated_delivery_at,omitempty"`
	LastCheckedAt       *time.Time `json:"last_checked_at,omitempty"`
}
