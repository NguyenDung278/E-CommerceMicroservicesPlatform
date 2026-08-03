package dto

type ProductVariantRequest struct {
	SKU         string   `json:"sku" validate:"required,min=1"`
	Label       string   `json:"label" validate:"required,min=1"`
	Size        string   `json:"size"`
	Color       string   `json:"color"`
	Price       float64  `json:"price" validate:"gt=0"`
	Stock       int      `json:"stock" validate:"gte=0"`
	ImageURLs   []string `json:"image_urls"`
	FitNote     string   `json:"fit_note"`
	SizeGuideID string   `json:"size_guide_id"`
	Restockable bool     `json:"restockable"`
	LeadTime    string   `json:"lead_time"`
	Badge       string   `json:"badge"`
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
	ImageURLs   []string                `json:"image_urls"`
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
	ImageURLs   *[]string                `json:"image_urls"`
}

type UploadProductImagesResponse struct {
	URLs []string `json:"urls"`
}

// ListProductsQuery holds query parameters for listing products.
type ListProductsQuery struct {
	Page     int     `query:"page"`
	Limit    int     `query:"limit"`
	Cursor   string  `query:"cursor"`
	Category string  `query:"category"`
	Brand    string  `query:"brand"`
	Tag      string  `query:"tag"`
	Status   string  `query:"status"`
	Search   string  `query:"search"`
	MinPrice float64 `query:"min_price"`
	MaxPrice float64 `query:"max_price"`
	Size     string  `query:"size"`
	Color    string  `query:"color"`
	Sort     string  `query:"sort"`
}

type SearchAssistQuery struct {
	Query    string `query:"q"`
	Category string `query:"category"`
	Status   string `query:"status"`
	Limit    int    `query:"limit"`
}

// AdjustStockRequest là body cho một lần nhập kho hoặc điều chỉnh tồn.
//
// Delta có dấu chứ không tách thành hai endpoint in/out: người vận hành nghĩ
// theo "cộng bao nhiêu, trừ bao nhiêu", và một trường có dấu giữ cho sổ cái chỉ
// có đúng một cách biểu diễn thay vì hai.
//
// SKU bắt buộc khi sản phẩm có khai báo variant — cùng quy ước với checkout,
// nếu không sẽ không biết đang nhập kho cho size nào.
type AdjustStockRequest struct {
	SKU    string `json:"sku" validate:"omitempty,max=120"`
	Delta  int    `json:"delta" validate:"required,ne=0"`
	Reason string `json:"reason" validate:"required,oneof=received recount damaged returned correction"`
	Note   string `json:"note" validate:"omitempty,max=255"`
}
