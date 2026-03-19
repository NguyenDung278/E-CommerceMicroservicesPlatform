package dto

// AddToCartRequest is the request body for adding an item to cart.
type AddToCartRequest struct {
	ProductID string  `json:"product_id" validate:"required"`
	Name      string  `json:"name" validate:"required,min=1"`
	Price     float64 `json:"price" validate:"gt=0"`
	Quantity  int     `json:"quantity" validate:"gt=0"`
}

// UpdateCartItemRequest is the request body for updating item quantity.
type UpdateCartItemRequest struct {
	Quantity int `json:"quantity" validate:"gt=0"`
}
