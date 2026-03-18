package model

import "time"

// OrderStatus represents the lifecycle of an order.
//
// STATE MACHINE:
//   pending → paid → shipped → delivered
//   pending → cancelled
//   pending → paid → refunded
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
	ID         string      `json:"id"`
	UserID     string      `json:"user_id"`
	Status     OrderStatus `json:"status"`
	TotalPrice float64     `json:"total_price"`
	Items      []OrderItem `json:"items"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
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
