package dto

// CreateProductRequest is the request body for creating a product.
type CreateProductRequest struct {
	Name        string  `json:"name" validate:"required,min=1"`
	Description string  `json:"description"`
	Price       float64 `json:"price" validate:"gt=0"`
	Stock       int     `json:"stock" validate:"gte=0"`
	Category    string  `json:"category"`
	ImageURL    string  `json:"image_url" validate:"omitempty,url"`
}

// UpdateProductRequest is the request body for updating a product.
type UpdateProductRequest struct {
	Name        *string  `json:"name" validate:"omitempty,min=1"`
	Description *string  `json:"description"`
	Price       *float64 `json:"price" validate:"omitempty,gt=0"`
	Stock       *int     `json:"stock" validate:"omitempty,gte=0"`
	Category    *string  `json:"category"`
	ImageURL    *string  `json:"image_url" validate:"omitempty,url"`
}

// ListProductsQuery holds query parameters for listing products.
type ListProductsQuery struct {
	Page     int    `query:"page"`
	Limit    int    `query:"limit"`
	Category string `query:"category"`
	Search   string `query:"search"`
}
