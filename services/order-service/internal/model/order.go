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
	ID             string      `json:"id"`
	UserID         string      `json:"user_id"`
	Status         OrderStatus `json:"status"`
	SubtotalPrice  float64     `json:"subtotal_price"`
	DiscountAmount float64     `json:"discount_amount"`
	CouponCode     string      `json:"coupon_code,omitempty"`
	TotalPrice     float64     `json:"total_price"`
	Items          []OrderItem `json:"items"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type OrderPreview struct {
	SubtotalPrice     float64 `json:"subtotal_price"`
	DiscountAmount    float64 `json:"discount_amount"`
	CouponCode        string  `json:"coupon_code,omitempty"`
	CouponDescription string  `json:"coupon_description,omitempty"`
	TotalPrice        float64 `json:"total_price"`
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
	Page   int
	Limit  int
}
