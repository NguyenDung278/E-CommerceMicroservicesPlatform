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
