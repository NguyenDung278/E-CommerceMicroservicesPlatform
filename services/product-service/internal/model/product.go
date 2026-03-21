package model

import "time"

type ProductStatus string

const (
	ProductStatusDraft    ProductStatus = "draft"
	ProductStatusActive   ProductStatus = "active"
	ProductStatusInactive ProductStatus = "inactive"
)

type ProductVariant struct {
	SKU   string  `json:"sku"`
	Label string  `json:"label"`
	Price float64 `json:"price"`
	Stock int     `json:"stock"`
}

// Product represents a product in the catalog.
type Product struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Price       float64          `json:"price"`
	Stock       int              `json:"stock"`
	Category    string           `json:"category"`
	Brand       string           `json:"brand"`
	Tags        []string         `json:"tags"`
	Status      string           `json:"status"`
	SKU         string           `json:"sku"`
	Variants    []ProductVariant `json:"variants"`
	ImageURL    string           `json:"image_url"`
	ImageURLs   []string         `json:"image_urls"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}
