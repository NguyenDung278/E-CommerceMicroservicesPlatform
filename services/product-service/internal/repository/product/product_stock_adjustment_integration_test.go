package repository

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

// Nhập kho và giữ chỗ checkout cùng chạm một bộ đếm, nên các test dưới đây chạy
// trên PostgreSQL thật: thứ cần chứng minh là hành vi khoá hàng dưới concurrency
// thật, điều mock không thể hiện được.

func newAdjustment(productID, sku string, delta int, reason model.StockAdjustmentReason) *model.StockAdjustment {
	return &model.StockAdjustment{
		ID:        uuid.NewString(),
		ProductID: productID,
		SKU:       sku,
		Delta:     delta,
		Reason:    reason,
		CreatedAt: time.Now(),
	}
}

func TestAdjustStockReceivesIntoTheRightVariantPool(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	product := newVariantReservationTestProduct("adj-variant", map[string]int{
		"size-m": 2,
		"size-l": 4,
	})
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	saved, err := repo.AdjustStock(ctx, newAdjustment(product.ID, "size-m", 10, model.StockAdjustmentReasonReceived))
	if err != nil {
		t.Fatalf("AdjustStock returned error: %v", err)
	}
	if saved.ResultingStock != 12 {
		t.Fatalf("expected size-m to end at 12, got %d", saved.ResultingStock)
	}

	if stock := currentVariantStock(t, repo, product.ID, "size-m"); stock != 12 {
		t.Fatalf("expected size-m stock 12, got %d", stock)
	}
	if stock := currentVariantStock(t, repo, product.ID, "size-l"); stock != 4 {
		t.Fatalf("size-l must be untouched at 4, got %d", stock)
	}
	// Tổng hợp phải đi theo cùng delta, nếu không listing và badge "sắp hết hàng"
	// sẽ nói khác với thứ thực sự bán được.
	if stock := currentStock(t, db, repo, product.ID); stock != 16 {
		t.Fatalf("expected aggregate 16, got %d", stock)
	}
}

func TestAdjustStockRefusesToDriveStockNegative(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	product := newVariantReservationTestProduct("adj-negative", map[string]int{
		"size-m": 3,
		"size-l": 1,
	})
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	_, err := repo.AdjustStock(ctx, newAdjustment(product.ID, "size-m", -5, model.StockAdjustmentReasonDamaged))
	if !errors.Is(err, ErrStockAdjustmentWouldGoNegative) {
		t.Fatalf("expected ErrStockAdjustmentWouldGoNegative, got %v", err)
	}
	if stock := currentVariantStock(t, repo, product.ID, "size-m"); stock != 3 {
		t.Fatalf("expected size-m untouched at 3, got %d", stock)
	}

	var ledgerRows int
	if err := db.QueryRow(`SELECT COUNT(*) FROM stock_adjustments WHERE product_id = $1`, product.ID).Scan(&ledgerRows); err != nil {
		t.Fatalf("failed to count ledger rows: %v", err)
	}
	if ledgerRows != 0 {
		t.Fatalf("a rejected adjustment must not leave a ledger row, got %d", ledgerRows)
	}
}

func TestAdjustStockRejectsBlankSkuOnVariantProduct(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	product := newVariantReservationTestProduct("adj-blank-sku", map[string]int{"size-m": 2, "size-l": 2})
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	_, err := repo.AdjustStock(ctx, newAdjustment(product.ID, "", 5, model.StockAdjustmentReasonReceived))
	if !errors.Is(err, ErrProductVariantRequired) {
		t.Fatalf("expected ErrProductVariantRequired, got %v", err)
	}
}

// Bấm nút nhập kho hai lần là kịch bản thật, và nếu nó cộng kho hai lần thì sai
// lệch chỉ lộ ra lúc kiểm kê. Idempotency key phải biến lần gửi lại thành no-op.
func TestAdjustStockIsIdempotentPerKey(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	product := newReservationTestProduct("adj-idempotent", 5)
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	first := newAdjustment(product.ID, "", 20, model.StockAdjustmentReasonReceived)
	first.IdempotencyKey = "receive-po-42"
	saved, err := repo.AdjustStock(ctx, first)
	if err != nil {
		t.Fatalf("first AdjustStock returned error: %v", err)
	}
	if saved.ResultingStock != 25 {
		t.Fatalf("expected stock 25 after receiving, got %d", saved.ResultingStock)
	}

	replay := newAdjustment(product.ID, "", 20, model.StockAdjustmentReasonReceived)
	replay.IdempotencyKey = "receive-po-42"
	replayed, err := repo.AdjustStock(ctx, replay)
	if err != nil {
		t.Fatalf("replayed AdjustStock returned error: %v", err)
	}
	if replayed.ID != saved.ID {
		t.Fatalf("replay must return the original ledger row, got %s want %s", replayed.ID, saved.ID)
	}
	if stock := currentStock(t, db, repo, product.ID); stock != 25 {
		t.Fatalf("replay must not receive stock twice, got %d", stock)
	}
}

// Nhập kho và giữ chỗ checkout chạy song song phải cộng dồn đúng: đây là lý do
// AdjustStock lấy cùng row lock với ReserveStockForOrder thay vì cộng mù.
func TestAdjustStockSerializesWithConcurrentReservations(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	repo := NewProductRepository(db)

	const startingStock = 20
	const receipts = 10
	const reservations = 10
	product := newReservationTestProduct("adj-concurrent", startingStock)
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	var wg sync.WaitGroup
	errs := make(chan error, receipts+reservations)

	for i := 0; i < receipts; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := repo.AdjustStock(ctx, newAdjustment(product.ID, "", 3, model.StockAdjustmentReasonReceived))
			errs <- err
		}()
	}
	for i := 0; i < reservations; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			_, err := repo.ReserveStockForOrder(ctx, fmt.Sprintf("adj-order-%d", index), []model.StockReservationItem{
				{ProductID: product.ID, Quantity: 1},
			})
			errs <- err
		}(i)
	}
	wg.Wait()
	close(errs)

	for err := range errs {
		if err != nil {
			t.Fatalf("unexpected error under concurrency: %v", err)
		}
	}

	// 20 ban đầu + 10 lần nhập 3 cái - 10 lần giữ chỗ 1 cái = 40.
	want := startingStock + receipts*3 - reservations
	if stock := currentStock(t, db, repo, product.ID); stock != want {
		t.Fatalf("expected stock %d after interleaved receipts and reservations, got %d", want, stock)
	}
}
