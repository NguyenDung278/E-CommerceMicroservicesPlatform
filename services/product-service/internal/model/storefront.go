package model

import (
	"encoding/json"
	"time"
)

// StorefrontCategory represents the public category metadata used by
// editorial/category pages.
type StorefrontCategory struct {
	Slug         string          `json:"slug"`
	DisplayName  string          `json:"display_name"`
	NavLabel     string          `json:"nav_label"`
	Status       string          `json:"status"`
	Hero         json.RawMessage `json:"hero"`
	FilterConfig json.RawMessage `json:"filter_config"`
	SEO          json.RawMessage `json:"seo"`
	Aliases      []string        `json:"aliases"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// StorefrontEditorialSection stores one editorial/content block that belongs
// to a category page.
type StorefrontEditorialSection struct {
	ID           string          `json:"id"`
	CategorySlug string          `json:"category_slug"`
	SectionType  string          `json:"section_type"`
	Position     int             `json:"position"`
	Payload      json.RawMessage `json:"payload"`
	Published    bool            `json:"published"`
}

// StorefrontProduct is the public product card payload used by storefront
// category/editorial pages.
type StorefrontProduct struct {
	ID                string           `json:"id"`
	ExternalID        string           `json:"external_id"`
	Name              string           `json:"name"`
	Description       string           `json:"description"`
	Price             float64          `json:"price"`
	Stock             int              `json:"stock"`
	Category          string           `json:"category"`
	CategorySlug      string           `json:"category_slug,omitempty"`
	Brand             string           `json:"brand"`
	Material          string           `json:"material"`
	Tags              []string         `json:"tags"`
	Status            string           `json:"status"`
	SKU               string           `json:"sku"`
	Variants          []ProductVariant `json:"variants"`
	ImageURL          string           `json:"image_url"`
	ImageURLs         []string         `json:"image_urls"`
	MerchandisingRank int              `json:"merchandising_rank"`
	CreatedAt         time.Time        `json:"created_at"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

// StorefrontFeaturedProduct links a curated position to a concrete product.
type StorefrontFeaturedProduct struct {
	ID                string             `json:"id"`
	ProductExternalID string             `json:"product_external_id"`
	CategorySlug      string             `json:"category_slug"`
	Position          int                `json:"position"`
	Product           *StorefrontProduct `json:"product"`
}

// StorefrontCategoryPage aggregates the content needed to render one category
// editorial page.
type StorefrontCategoryPage struct {
	Category         *StorefrontCategory           `json:"category"`
	Sections         []*StorefrontEditorialSection `json:"sections"`
	FeaturedProducts []*StorefrontFeaturedProduct  `json:"featured_products"`
}

// StorefrontHome aggregates the category pages used by the storefront home.
type StorefrontHome struct {
	Categories    []*StorefrontCategory     `json:"categories"`
	CategoryPages []*StorefrontCategoryPage `json:"category_pages"`
}
