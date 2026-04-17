package dto

// AddToCartRequest is the request body for adding an item to cart.
type AddToCartRequest struct {
	ProductID string `json:"product_id" validate:"required"`
	Quantity  int    `json:"quantity" validate:"gt=0"`
}

// MergeCartRequest carries guest cart items that should be merged into the
// authenticated shopper's server-side cart.
type MergeCartRequest struct {
	Items []AddToCartRequest `json:"items" validate:"required,min=1,dive"`
}

// UpdateCartItemRequest is the request body for updating item quantity.
type UpdateCartItemRequest struct {
	Quantity int `json:"quantity" validate:"gt=0"`
}
