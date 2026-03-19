package dto

// CreateOrderRequest represents a checkout request.
type CreateOrderRequest struct {
	Items []OrderItemRequest `json:"items" validate:"required,min=1,dive"`
}

// OrderItemRequest represents a single item in a checkout request.
type OrderItemRequest struct {
	ProductID string  `json:"product_id" validate:"required"`
	Name      string  `json:"name" validate:"omitempty,min=1"`
	Price     float64 `json:"price" validate:"omitempty,gt=0"`
	Quantity  int     `json:"quantity" validate:"gt=0"`
}
