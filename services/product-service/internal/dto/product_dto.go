package dto

type ProductVariantRequest struct {
	SKU   string  `json:"sku" validate:"required,min=1"`
	Label string  `json:"label" validate:"required,min=1"`
	Price float64 `json:"price" validate:"gt=0"`
	Stock int     `json:"stock" validate:"gte=0"`
}

// CreateProductRequest is the request body for creating a product.
type CreateProductRequest struct {
	Name        string                  `json:"name" validate:"required,min=1"`
	Description string                  `json:"description"`
	Price       float64                 `json:"price" validate:"gt=0"`
	Stock       int                     `json:"stock" validate:"gte=0"`
	Category    string                  `json:"category"`
	Brand       string                  `json:"brand"`
	Tags        []string                `json:"tags"`
	Status      string                  `json:"status"`
	SKU         string                  `json:"sku"`
	Variants    []ProductVariantRequest `json:"variants"`
	ImageURL    string                  `json:"image_url" validate:"omitempty,url"`
}

// UpdateProductRequest is the request body for updating a product.
type UpdateProductRequest struct {
	Name        *string                  `json:"name" validate:"omitempty,min=1"`
	Description *string                  `json:"description"`
	Price       *float64                 `json:"price" validate:"omitempty,gt=0"`
	Stock       *int                     `json:"stock" validate:"omitempty,gte=0"`
	Category    *string                  `json:"category"`
	Brand       *string                  `json:"brand"`
	Tags        *[]string                `json:"tags"`
	Status      *string                  `json:"status"`
	SKU         *string                  `json:"sku"`
	Variants    *[]ProductVariantRequest `json:"variants"`
	ImageURL    *string                  `json:"image_url" validate:"omitempty,url"`
}

// ListProductsQuery holds query parameters for listing products.
type ListProductsQuery struct {
	Page     int    `query:"page"`
	Limit    int    `query:"limit"`
	Category string `query:"category"`
	Brand    string `query:"brand"`
	Tag      string `query:"tag"`
	Status   string `query:"status"`
	Search   string `query:"search"`
}
