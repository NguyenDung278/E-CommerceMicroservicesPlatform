package dto

// CreateOrderRequest represents a checkout request.
type CreateOrderRequest struct {
	Items []OrderItemRequest `json:"items" validate:"required,min=1"`
}

// OrderItemRequest represents a single item in a checkout request.
type OrderItemRequest struct {
	ProductID string  `json:"product_id" validate:"required"`
	Name      string  `json:"name" validate:"required"`
	Price     float64 `json:"price" validate:"required,gt=0"`
	Quantity  int     `json:"quantity" validate:"required,gt=0"`
}
