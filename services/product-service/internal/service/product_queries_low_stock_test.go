package service

import (
	"context"
	"testing"

	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

// Ca quan trọng nhất: tổng tồn kho còn dư nhưng một size sắp hết. Trước khi có
// variant-level check, sản phẩm này lọt lưới hoàn toàn.
func TestListLowStockEntriesFlagsVariantWhenTotalStockIsHealthy(t *testing.T) {
	repo := newFakeProductServiceRepo()
	repo.products["product-1"] = &model.Product{
		ID:    "product-1",
		Name:  "Archive Coat",
		Stock: 40,
		Variants: []model.ProductVariant{
			{SKU: "AC-S", Label: "S", Stock: 20},
			{SKU: "AC-M", Label: "M", Stock: 1},
		},
	}
	svc := NewProductService(repo, WithLogger(zap.NewNop()))

	entries, err := svc.ListLowStockEntries(context.Background(), 5, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(entries) != 1 {
		t.Fatalf("expected only the low variant to be reported, got %+v", entries)
	}
	if entries[0].SKU != "AC-M" {
		t.Fatalf("expected variant AC-M, got %+v", entries[0])
	}
	if !entries[0].IsVariant() {
		t.Fatal("expected entry to be flagged as a variant-level alert")
	}
	if entries[0].VariantLabel != "M" {
		t.Fatalf("expected label M, got %q", entries[0].VariantLabel)
	}
}

// Chiều ngược lại: sản phẩm lọt vào vì một variant thấp thì KHÔNG được đẻ thêm
// dòng cảnh báo mức sản phẩm khi tổng kho vẫn dư.
func TestListLowStockEntriesDoesNotEmitProductLevelWhenOnlyVariantIsLow(t *testing.T) {
	repo := newFakeProductServiceRepo()
	repo.products["product-1"] = &model.Product{
		ID:    "product-1",
		Name:  "Archive Coat",
		Stock: 100,
		Variants: []model.ProductVariant{
			{SKU: "AC-M", Label: "M", Stock: 2},
		},
	}
	svc := NewProductService(repo, WithLogger(zap.NewNop()))

	entries, err := svc.ListLowStockEntries(context.Background(), 5, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, entry := range entries {
		if !entry.IsVariant() {
			t.Fatalf("unexpected product-level entry while total stock is healthy: %+v", entry)
		}
	}
}

// Sản phẩm không khai báo variant vẫn phải được cảnh báo ở mức sản phẩm.
func TestListLowStockEntriesReportsProductWithoutVariants(t *testing.T) {
	repo := newFakeProductServiceRepo()
	repo.products["product-1"] = &model.Product{ID: "product-1", Name: "Field Cap", Stock: 2}
	svc := NewProductService(repo, WithLogger(zap.NewNop()))

	entries, err := svc.ListLowStockEntries(context.Background(), 5, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(entries) != 1 {
		t.Fatalf("expected one product-level entry, got %+v", entries)
	}
	if entries[0].IsVariant() {
		t.Fatalf("expected a product-level entry, got %+v", entries[0])
	}
	if entries[0].Threshold != 5 {
		t.Fatalf("expected threshold to be echoed back, got %d", entries[0].Threshold)
	}
}

// Limit phải giữ lại thứ khẩn cấp nhất, không phải thứ SQL trả về đầu tiên.
func TestListLowStockEntriesSortsMostUrgentFirstBeforeApplyingLimit(t *testing.T) {
	repo := newFakeProductServiceRepo()
	repo.products["product-1"] = &model.Product{
		ID:    "product-1",
		Name:  "Archive Coat",
		Stock: 4,
		Variants: []model.ProductVariant{
			{SKU: "AC-M", Label: "M", Stock: 0},
		},
	}
	svc := NewProductService(repo, WithLogger(zap.NewNop()))

	entries, err := svc.ListLowStockEntries(context.Background(), 5, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(entries) != 1 {
		t.Fatalf("expected limit to be applied, got %d entries", len(entries))
	}
	if !entries[0].IsOutOfStock() {
		t.Fatalf("expected the out-of-stock variant to survive the limit, got %+v", entries[0])
	}
}

// Không có variant nào chạm ngưỡng thì im lặng — worker dựa vào đây để không
// gửi digest rỗng.
func TestListLowStockEntriesReturnsEmptyWhenNothingIsLow(t *testing.T) {
	repo := newFakeProductServiceRepo()
	repo.products["product-1"] = &model.Product{
		ID:       "product-1",
		Name:     "Archive Coat",
		Stock:    50,
		Variants: []model.ProductVariant{{SKU: "AC-M", Label: "M", Stock: 30}},
	}
	svc := NewProductService(repo, WithLogger(zap.NewNop()))

	entries, err := svc.ListLowStockEntries(context.Background(), 5, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(entries) != 0 {
		t.Fatalf("expected no entries, got %+v", entries)
	}
}

// Variant thiếu Label thì phải suy ra nhãn từ size/màu, cùng lắm là SKU — email
// không được hiện chuỗi rỗng.
func TestListLowStockEntriesFallsBackToSizeColorLabel(t *testing.T) {
	repo := newFakeProductServiceRepo()
	repo.products["product-1"] = &model.Product{
		ID:    "product-1",
		Name:  "Archive Coat",
		Stock: 40,
		Variants: []model.ProductVariant{
			{SKU: "AC-M-BLK", Size: "M", Color: "Black", Stock: 1},
			{SKU: "AC-L-RAW", Stock: 0},
		},
	}
	svc := NewProductService(repo, WithLogger(zap.NewNop()))

	entries, err := svc.ListLowStockEntries(context.Background(), 5, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	labels := make(map[string]string, len(entries))
	for _, entry := range entries {
		labels[entry.SKU] = entry.VariantLabel
	}
	if labels["AC-M-BLK"] != "M / Black" {
		t.Fatalf("expected size/color fallback, got %q", labels["AC-M-BLK"])
	}
	if labels["AC-L-RAW"] != "AC-L-RAW" {
		t.Fatalf("expected SKU fallback, got %q", labels["AC-L-RAW"])
	}
}
