package repository

import (
	"context"
	"testing"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

// ListLowStock lọc bằng jsonb_array_elements trên cột `variants`. Đây là phần
// duy nhất của tính năng cảnh báo tồn kho mà unit test không chạm tới được:
// fake repository chỉ mô phỏng ngữ nghĩa, còn cú pháp JSONB thì chỉ PostgreSQL
// thật mới nói được là đúng hay sai.

func newLowStockTestProduct(id string, stock int, variants []model.ProductVariant) *model.Product {
	now := time.Now()
	return &model.Product{
		ID:          id,
		Name:        "Low Stock Product " + id,
		Description: "Product used by low stock integration tests",
		Price:       99,
		Stock:       stock,
		Category:    "Accessories",
		Brand:       "ND Atelier",
		Tags:        []string{"low-stock"},
		Status:      "active",
		SKU:         "SKU-" + id,
		Variants:    variants,
		ImageURL:    "",
		ImageURLs:   []string{},
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

func containsProduct(products []*model.Product, id string) bool {
	for _, product := range products {
		if product != nil && product.ID == id {
			return true
		}
	}
	return false
}

func TestListLowStockMatchesVariantStockBelowThreshold(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	// Tổng kho dư dả nhưng một size sắp hết — ca mà điều kiện cũ bỏ lọt.
	variantLow := newLowStockTestProduct("lowstock-variant", 40, []model.ProductVariant{
		{SKU: "size-s", Label: "S", Price: 99, Stock: 39},
		{SKU: "size-m", Label: "M", Price: 99, Stock: 1},
	})
	if err := repo.Create(ctx, variantLow); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	// Không có gì chạm ngưỡng, kể cả variant.
	healthy := newLowStockTestProduct("lowstock-healthy", 80, []model.ProductVariant{
		{SKU: "size-s", Label: "S", Price: 99, Stock: 40},
		{SKU: "size-m", Label: "M", Price: 99, Stock: 40},
	})
	if err := repo.Create(ctx, healthy); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	// Không khai báo variant, thấp ở mức sản phẩm.
	plain := newLowStockTestProduct("lowstock-plain", 2, []model.ProductVariant{})
	if err := repo.Create(ctx, plain); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	products, err := repo.ListLowStock(ctx, 5)
	if err != nil {
		t.Fatalf("ListLowStock returned error: %v", err)
	}

	if !containsProduct(products, "lowstock-variant") {
		t.Error("expected product with a low variant to be returned")
	}
	if !containsProduct(products, "lowstock-plain") {
		t.Error("expected product-level low stock to be returned")
	}
	if containsProduct(products, "lowstock-healthy") {
		t.Error("expected healthy product to be excluded")
	}
}

// Sản phẩm không active không được lọt vào cảnh báo dù tồn kho bằng 0 — nhập
// hàng cho thứ đã gỡ khỏi catalog là việc vô nghĩa.
func TestListLowStockIgnoresNonActiveProducts(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	draft := newLowStockTestProduct("lowstock-draft", 0, []model.ProductVariant{
		{SKU: "size-m", Label: "M", Price: 99, Stock: 0},
	})
	draft.Status = string(model.ProductStatusDraft)
	if err := repo.Create(ctx, draft); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	products, err := repo.ListLowStock(ctx, 5)
	if err != nil {
		t.Fatalf("ListLowStock returned error: %v", err)
	}

	if containsProduct(products, "lowstock-draft") {
		t.Error("expected non-active product to be excluded from low stock alerts")
	}
}
