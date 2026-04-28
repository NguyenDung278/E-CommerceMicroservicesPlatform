package model

import "time"

// OrderStatus represents the lifecycle of an order.
//
// STATE MACHINE:
//
//	pending → paid → shipped → delivered
//	pending → cancelled
//	pending → paid → refunded
type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "pending"
	OrderStatusPaid      OrderStatus = "paid"
	OrderStatusShipped   OrderStatus = "shipped"
	OrderStatusDelivered OrderStatus = "delivered"
	OrderStatusCancelled OrderStatus = "cancelled"
	OrderStatusRefunded  OrderStatus = "refunded"
)

// Order represents a customer order.
type Order struct {
	ID                     string           `json:"id"`
	UserID                 string           `json:"user_id"`
	Status                 OrderStatus      `json:"status"`
	SubtotalPrice          float64          `json:"subtotal_price"`
	DiscountAmount         float64          `json:"discount_amount"`
	CouponCode             string           `json:"coupon_code,omitempty"`
	ShippingMethod         string           `json:"shipping_method"`
	ShippingFee            float64          `json:"shipping_fee"`
	ShippingAddress        *ShippingAddress `json:"shipping_address,omitempty"`
	ReservationExpiresAt   *time.Time       `json:"reservation_expires_at,omitempty"`
	ReservationAllocatedAt *time.Time       `json:"reservation_allocated_at,omitempty"`
	TotalPrice             float64          `json:"total_price"`
	Items                  []OrderItem      `json:"items"`
	CreatedAt              time.Time        `json:"created_at"`
	UpdatedAt              time.Time        `json:"updated_at"`
}

type OrderPreview struct {
	SubtotalPrice            float64          `json:"subtotal_price"`
	DiscountAmount           float64          `json:"discount_amount"`
	CouponCode               string           `json:"coupon_code,omitempty"`
	CouponDescription        string           `json:"coupon_description,omitempty"`
	ShippingMethod           string           `json:"shipping_method"`
	ShippingFee              float64          `json:"shipping_fee"`
	ETALabel                 string           `json:"eta_label,omitempty"`
	DeliveryPromise          string           `json:"delivery_promise,omitempty"`
	SupportedShippingMethods []ShippingOption `json:"supported_shipping_methods,omitempty"`
	TotalPrice               float64          `json:"total_price"`
}

type ShippingAddress struct {
	RecipientName string `json:"recipient_name"`
	Phone         string `json:"phone"`
	Location      string `json:"location"`
}

type ShippingMethod string

const (
	ShippingMethodStandard ShippingMethod = "standard"
	ShippingMethodExpress  ShippingMethod = "express"
	ShippingMethodPickup   ShippingMethod = "pickup"
)

type ShippingOption struct {
	Method          string  `json:"method"`
	Label           string  `json:"label"`
	Description     string  `json:"description,omitempty"`
	Fee             float64 `json:"fee"`
	ETAMinDays      int     `json:"eta_min_days"`
	ETAMaxDays      int     `json:"eta_max_days"`
	ETALabel        string  `json:"eta_label"`
	DeliveryPromise string  `json:"delivery_promise"`
}

// OrderItem represents a single item within an order.
type OrderItem struct {
	ID        string  `json:"id"`
	OrderID   string  `json:"order_id"`
	ProductID string  `json:"product_id"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
}

type SalesTopProduct struct {
	ProductID string  `json:"product_id"`
	Name      string  `json:"name"`
	Quantity  int     `json:"quantity"`
	Revenue   float64 `json:"revenue"`
}

type ProductPopularity struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

type SalesStatusBreakdown struct {
	Status  string  `json:"status"`
	Orders  int     `json:"orders"`
	Revenue float64 `json:"revenue"`
}

type AdminReport struct {
	WindowDays        int                    `json:"window_days"`
	TotalRevenue      float64                `json:"total_revenue"`
	OrderCount        int                    `json:"order_count"`
	CancelledCount    int                    `json:"cancelled_count"`
	AverageOrderValue float64                `json:"average_order_value"`
	TopProducts       []SalesTopProduct      `json:"top_products"`
	StatusBreakdown   []SalesStatusBreakdown `json:"status_breakdown"`
}

type CouponDiscountType string

const (
	CouponDiscountTypeFixed      CouponDiscountType = "fixed"
	CouponDiscountTypePercentage CouponDiscountType = "percentage"
)

type Coupon struct {
	ID             string             `json:"id"`
	Code           string             `json:"code"`
	Description    string             `json:"description"`
	DiscountType   CouponDiscountType `json:"discount_type"`
	DiscountValue  float64            `json:"discount_value"`
	MinOrderAmount float64            `json:"min_order_amount"`
	UsageLimit     int                `json:"usage_limit"`
	UsedCount      int                `json:"used_count"`
	Active         bool               `json:"active"`
	ExpiresAt      *time.Time         `json:"expires_at,omitempty"`
	CreatedAt      time.Time          `json:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at"`
}

type CouponWalletItem struct {
	Code               string             `json:"code"`
	Description        string             `json:"description"`
	DiscountType       CouponDiscountType `json:"discount_type"`
	DiscountValue      float64            `json:"discount_value"`
	MinOrderAmount     float64            `json:"min_order_amount"`
	ExpiresAt          *time.Time         `json:"expires_at,omitempty"`
	Eligible           bool               `json:"eligible"`
	IneligibleReason   string             `json:"ineligible_reason,omitempty"`
	EstimatedDiscount  float64            `json:"estimated_discount"`
	RemainingUsageHint int                `json:"remaining_usage_hint,omitempty"`
}

type ShipmentTracking struct {
	ID                  string     `json:"id"`
	OrderID             string     `json:"order_id"`
	Carrier             string     `json:"carrier"`
	TrackingNumber      string     `json:"tracking_number"`
	TrackingURL         string     `json:"tracking_url,omitempty"`
	Status              string     `json:"status"`
	EstimatedDeliveryAt *time.Time `json:"estimated_delivery_at,omitempty"`
	LastCheckedAt       *time.Time `json:"last_checked_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type OrderEvent struct {
	ID        string      `json:"id"`
	OrderID   string      `json:"order_id"`
	Type      string      `json:"type"`
	Status    OrderStatus `json:"status"`
	ActorID   string      `json:"actor_id,omitempty"`
	ActorRole string      `json:"actor_role,omitempty"`
	Message   string      `json:"message"`
	CreatedAt time.Time   `json:"created_at"`
}

type OrderFilters struct {
	UserID string
	Status OrderStatus
	From   *time.Time
	To     *time.Time
	Cursor string
	Page   int
	Limit  int
}
