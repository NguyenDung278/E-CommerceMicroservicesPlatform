package model

// LowStockEntry là một dòng cảnh báo tồn kho thấp đã được làm phẳng.
//
// Vì sao không trả thẳng []*Product: một sản phẩm có thể chạm ngưỡng ở nhiều
// mức khác nhau — tổng kho còn nhiều nhưng size M sắp hết, hoặc ngược lại. Bên
// nhận cảnh báo cần biết CHÍNH XÁC cái gì sắp hết để đi nhập hàng, nên mỗi
// variant chạm ngưỡng là một dòng riêng thay vì bắt phía notification tự bới
// lại mảng variants.
type LowStockEntry struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`

	// SKU và VariantLabel rỗng nghĩa là dòng này cảnh báo ở mức sản phẩm
	// (tổng tồn kho), không phải một variant cụ thể.
	SKU          string `json:"sku,omitempty"`
	VariantLabel string `json:"variant_label,omitempty"`

	Stock     int `json:"stock"`
	Threshold int `json:"threshold"`
}

// IsVariant cho biết dòng cảnh báo thuộc về một variant cụ thể.
func (e LowStockEntry) IsVariant() bool {
	return e.SKU != ""
}

// IsOutOfStock phân biệt "sắp hết" với "đã hết" — hai mức độ khẩn cấp khác nhau
// khi gom cảnh báo và khi khử trùng lặp.
func (e LowStockEntry) IsOutOfStock() bool {
	return e.Stock <= 0
}
