package dto

// CreateProductRequest is the request body for creating a product.
type CreateProductRequest struct {
	Name        string  `json:"name" validate:"required"`
	Description string  `json:"description"`
	Price       float64 `json:"price" validate:"required,gt=0"`
	Stock       int     `json:"stock" validate:"required,gte=0"`
	Category    string  `json:"category"`
	ImageURL    string  `json:"image_url"`
}

// UpdateProductRequest is the request body for updating a product.
type UpdateProductRequest struct {
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	Price       *float64 `json:"price"`
	Stock       *int     `json:"stock"`
	Category    *string  `json:"category"`
	ImageURL    *string  `json:"image_url"`
}

// ListProductsQuery holds query parameters for listing products.
type ListProductsQuery struct {
	Page     int    `query:"page"`
	Limit    int    `query:"limit"`
	Category string `query:"category"`
	Search   string `query:"search"`
}
