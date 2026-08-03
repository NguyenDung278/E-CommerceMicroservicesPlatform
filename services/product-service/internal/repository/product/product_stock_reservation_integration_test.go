package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

// Các test dưới đây chạy trên PostgreSQL thật (testcontainers) vì thứ cần
// chứng minh là hành vi transaction + compare-and-set dưới concurrency thật,
// điều mock không thể hiện được.

func newReservationTestProduct(id string, stock int) *model.Product {
	now := time.Now()
	return &model.Product{
		ID:          id,
		Name:        "Reservation Product " + id,
		Description: "Product used by stock reservation integration tests",
		Price:       99,
		Stock:       stock,
		Category:    "Accessories",
		Brand:       "ND Atelier",
		Tags:        []string{"reservation"},
		Status:      "active",
		SKU:         "SKU-" + id,
		Variants:    []model.ProductVariant{},
		ImageURL:    "",
		ImageURLs:   []string{},
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// newVariantReservationTestProduct builds a product whose stock lives in two
// variants. products.stock stays the aggregate so catalog listings keep working,
// but buying must draw from the per-variant pools.
func newVariantReservationTestProduct(id string, stockBySKU map[string]int) *model.Product {
	product := newReservationTestProduct(id, 0)
	total := 0
	for _, sku := range []string{"size-m", "size-l"} {
		stock := stockBySKU[sku]
		total += stock
		product.Variants = append(product.Variants, model.ProductVariant{
			SKU:   sku,
			Label: "Đen / " + sku,
			Size:  sku,
			Color: "đen",
			Price: 99,
			Stock: stock,
		})
	}
	product.Stock = total
	return product
}

func currentVariantStock(t *testing.T, repo ProductRepository, productID, sku string) int {
	t.Helper()
	product, err := repo.GetByID(context.Background(), productID)
	if err != nil {
		t.Fatalf("GetByID returned error: %v", err)
	}
	if product == nil {
		t.Fatalf("product %s disappeared", productID)
	}
	index := model.FindVariantIndex(product.Variants, sku)
	if index < 0 {
		t.Fatalf("product %s has no variant %s", productID, sku)
	}
	return product.Variants[index].Stock
}

func countActiveReservations(t *testing.T, db *sql.DB, productID string) int {
	t.Helper()
	var count int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM stock_reservations WHERE product_id = $1 AND status = 'active'`,
		productID,
	).Scan(&count); err != nil {
		t.Fatalf("failed to count active reservations: %v", err)
	}
	return count
}

func currentStock(t *testing.T, db *sql.DB, repo ProductRepository, productID string) int {
	t.Helper()
	product, err := repo.GetByID(context.Background(), productID)
	if err != nil {
		t.Fatalf("GetByID returned error: %v", err)
	}
	if product == nil {
		t.Fatalf("product %s disappeared", productID)
	}
	return product.Stock
}

func TestReserveStockForOrderConcurrentReservationsNeverOversell(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	const initialStock = 10
	const attempts = 40
	product := newReservationTestProduct("resv-concurrent", initialStock)
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	var wg sync.WaitGroup
	results := make(chan error, attempts)
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(orderIndex int) {
			defer wg.Done()
			_, err := repo.ReserveStockForOrder(ctx, fmt.Sprintf("order-concurrent-%d", orderIndex), []model.StockReservationItem{
				{ProductID: product.ID, Quantity: 1},
			})
			results <- err
		}(i)
	}
	wg.Wait()
	close(results)

	succeeded, insufficient := 0, 0
	for err := range results {
		switch {
		case err == nil:
			succeeded++
		case errors.Is(err, ErrInsufficientStock):
			insufficient++
		default:
			t.Fatalf("unexpected reservation error: %v", err)
		}
	}

	if succeeded != initialStock {
		t.Fatalf("expected exactly %d successful reservations, got %d", initialStock, succeeded)
	}
	if insufficient != attempts-initialStock {
		t.Fatalf("expected %d insufficient-stock rejections, got %d", attempts-initialStock, insufficient)
	}
	if stock := currentStock(t, db, repo, product.ID); stock != 0 {
		t.Fatalf("expected stock drained to 0, got %d", stock)
	}
	if active := countActiveReservations(t, db, product.ID); active != initialStock {
		t.Fatalf("expected %d active ledger rows, got %d", initialStock, active)
	}
}

// Đây là test chứng minh lỗ hổng cũ đã bịt: trước khi ledger mang sku, mọi
// variant của một sản phẩm cùng rút `products.stock`, nên 40 đơn mua size M có
// thể tiêu luôn cả tồn kho của size L. Giờ mỗi variant có bể tồn kho riêng.
func TestReserveStockForOrderConcurrentVariantReservationsNeverOversell(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	const stockPerVariant = 5
	const attempts = 40
	product := newVariantReservationTestProduct("resv-variant-concurrent", map[string]int{
		"size-m": stockPerVariant,
		"size-l": stockPerVariant,
	})
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	var wg sync.WaitGroup
	results := make(chan error, attempts)
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(orderIndex int) {
			defer wg.Done()
			_, err := repo.ReserveStockForOrder(ctx, fmt.Sprintf("order-variant-%d", orderIndex), []model.StockReservationItem{
				{ProductID: product.ID, SKU: "size-m", Quantity: 1},
			})
			results <- err
		}(i)
	}
	wg.Wait()
	close(results)

	succeeded, insufficient := 0, 0
	for err := range results {
		switch {
		case err == nil:
			succeeded++
		case errors.Is(err, ErrInsufficientStock):
			insufficient++
		default:
			t.Fatalf("unexpected reservation error: %v", err)
		}
	}

	if succeeded != stockPerVariant {
		t.Fatalf("expected exactly %d successful reservations of size-m, got %d", stockPerVariant, succeeded)
	}
	if insufficient != attempts-stockPerVariant {
		t.Fatalf("expected %d insufficient-stock rejections, got %d", attempts-stockPerVariant, insufficient)
	}
	if stock := currentVariantStock(t, repo, product.ID, "size-m"); stock != 0 {
		t.Fatalf("expected size-m drained to 0, got %d", stock)
	}
	if stock := currentVariantStock(t, repo, product.ID, "size-l"); stock != stockPerVariant {
		t.Fatalf("size-l must be untouched at %d, got %d — one size drained another's stock", stockPerVariant, stock)
	}
	if stock := currentStock(t, db, repo, product.ID); stock != stockPerVariant {
		t.Fatalf("expected aggregate stock to follow the variants down to %d, got %d", stockPerVariant, stock)
	}
}

func TestReserveStockForOrderRejectsBlankSkuOnVariantProduct(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	product := newVariantReservationTestProduct("resv-variant-blank", map[string]int{
		"size-m": 3,
		"size-l": 3,
	})
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	_, err := repo.ReserveStockForOrder(ctx, "order-variant-blank", []model.StockReservationItem{
		{ProductID: product.ID, Quantity: 1},
	})
	if !errors.Is(err, ErrProductVariantRequired) {
		t.Fatalf("expected ErrProductVariantRequired, got %v", err)
	}
	if stock := currentStock(t, db, repo, product.ID); stock != 6 {
		t.Fatalf("expected aggregate stock untouched at 6, got %d", stock)
	}
	if active := countActiveReservations(t, db, product.ID); active != 0 {
		t.Fatalf("expected no ledger rows after rejection, got %d", active)
	}
}

func TestReserveStockForOrderRejectsUnknownSku(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	product := newVariantReservationTestProduct("resv-variant-unknown", map[string]int{
		"size-m": 2,
		"size-l": 2,
	})
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	_, err := repo.ReserveStockForOrder(ctx, "order-variant-unknown", []model.StockReservationItem{
		{ProductID: product.ID, SKU: "size-xxl", Quantity: 1},
	})
	if !errors.Is(err, ErrProductVariantNotFound) {
		t.Fatalf("expected ErrProductVariantNotFound, got %v", err)
	}
}

// Một order mua nhiều variant của cùng một sản phẩm là hợp lệ và phải giữ chỗ
// riêng từng variant — khoá chính cũ (order_id, product_id) không cho phép điều
// này.
func TestReserveAndReleaseStockPerVariantWithinOneOrder(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	product := newVariantReservationTestProduct("resv-variant-multi", map[string]int{
		"size-m": 4,
		"size-l": 4,
	})
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	items := []model.StockReservationItem{
		{ProductID: product.ID, SKU: "size-m", Quantity: 1},
		{ProductID: product.ID, SKU: "size-l", Quantity: 3},
	}
	if _, err := repo.ReserveStockForOrder(ctx, "order-variant-multi", items); err != nil {
		t.Fatalf("ReserveStockForOrder returned error: %v", err)
	}

	if stock := currentVariantStock(t, repo, product.ID, "size-m"); stock != 3 {
		t.Fatalf("expected size-m at 3, got %d", stock)
	}
	if stock := currentVariantStock(t, repo, product.ID, "size-l"); stock != 1 {
		t.Fatalf("expected size-l at 1, got %d", stock)
	}
	if active := countActiveReservations(t, db, product.ID); active != 2 {
		t.Fatalf("expected 2 ledger rows, one per variant, got %d", active)
	}

	released, err := repo.ReleaseStockForOrder(ctx, "order-variant-multi")
	if err != nil {
		t.Fatalf("ReleaseStockForOrder returned error: %v", err)
	}
	if len(released) != 2 {
		t.Fatalf("expected 2 released items, got %d", len(released))
	}
	if stock := currentVariantStock(t, repo, product.ID, "size-m"); stock != 4 {
		t.Fatalf("expected size-m restored to 4, got %d", stock)
	}
	if stock := currentVariantStock(t, repo, product.ID, "size-l"); stock != 4 {
		t.Fatalf("expected size-l restored to 4, got %d", stock)
	}
	if stock := currentStock(t, db, repo, product.ID); stock != 8 {
		t.Fatalf("expected aggregate restored to 8, got %d", stock)
	}
}

func TestReserveStockForOrderReplayDoesNotDoubleDecrement(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	product := newReservationTestProduct("resv-replay", 5)
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	items := []model.StockReservationItem{{ProductID: product.ID, Quantity: 3}}
	replayed, err := repo.ReserveStockForOrder(ctx, "order-replay", items)
	if err != nil {
		t.Fatalf("first ReserveStockForOrder returned error: %v", err)
	}
	if replayed {
		t.Fatal("first reservation must not report replay")
	}

	replayed, err = repo.ReserveStockForOrder(ctx, "order-replay", items)
	if err != nil {
		t.Fatalf("replayed ReserveStockForOrder returned error: %v", err)
	}
	if !replayed {
		t.Fatal("second reservation with the same order id must report replay")
	}
	if stock := currentStock(t, db, repo, product.ID); stock != 2 {
		t.Fatalf("expected stock decremented once to 2, got %d", stock)
	}
}

func TestReserveStockForOrderIsAllOrNothingAcrossItems(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	plentiful := newReservationTestProduct("resv-plentiful", 5)
	scarce := newReservationTestProduct("resv-scarce", 1)
	for _, product := range []*model.Product{plentiful, scarce} {
		if err := repo.Create(ctx, product); err != nil {
			t.Fatalf("Create product returned error: %v", err)
		}
	}

	_, err := repo.ReserveStockForOrder(ctx, "order-partial", []model.StockReservationItem{
		{ProductID: plentiful.ID, Quantity: 2},
		{ProductID: scarce.ID, Quantity: 2},
	})
	if !errors.Is(err, ErrInsufficientStock) {
		t.Fatalf("expected ErrInsufficientStock, got %v", err)
	}

	if stock := currentStock(t, db, repo, plentiful.ID); stock != 5 {
		t.Fatalf("expected plentiful stock untouched at 5, got %d", stock)
	}
	if stock := currentStock(t, db, repo, scarce.ID); stock != 1 {
		t.Fatalf("expected scarce stock untouched at 1, got %d", stock)
	}
	if active := countActiveReservations(t, db, plentiful.ID); active != 0 {
		t.Fatalf("expected no ledger rows after rollback, got %d", active)
	}
}

func TestReleaseStockForOrderIsIdempotent(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	product := newReservationTestProduct("resv-release", 5)
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	if _, err := repo.ReserveStockForOrder(ctx, "order-release", []model.StockReservationItem{
		{ProductID: product.ID, Quantity: 2},
	}); err != nil {
		t.Fatalf("ReserveStockForOrder returned error: %v", err)
	}
	if stock := currentStock(t, db, repo, product.ID); stock != 3 {
		t.Fatalf("expected stock 3 after reservation, got %d", stock)
	}

	released, err := repo.ReleaseStockForOrder(ctx, "order-release")
	if err != nil {
		t.Fatalf("first ReleaseStockForOrder returned error: %v", err)
	}
	if len(released) != 1 {
		t.Fatalf("expected one released item, got %d", len(released))
	}
	if stock := currentStock(t, db, repo, product.ID); stock != 5 {
		t.Fatalf("expected stock restored to 5, got %d", stock)
	}

	released, err = repo.ReleaseStockForOrder(ctx, "order-release")
	if err != nil {
		t.Fatalf("replayed ReleaseStockForOrder returned error: %v", err)
	}
	if len(released) != 0 {
		t.Fatalf("expected replayed release to be a no-op, got %d items", len(released))
	}
	if stock := currentStock(t, db, repo, product.ID); stock != 5 {
		t.Fatalf("expected stock still 5 after replayed release, got %d", stock)
	}

	released, err = repo.ReleaseStockForOrder(ctx, "order-unknown")
	if err != nil {
		t.Fatalf("unknown-order ReleaseStockForOrder returned error: %v", err)
	}
	if len(released) != 0 {
		t.Fatalf("expected unknown order release to be a no-op, got %d items", len(released))
	}
}
