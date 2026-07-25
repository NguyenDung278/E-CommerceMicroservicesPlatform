package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.uber.org/zap"

	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

func expiredPendingOrderFixture(orderID string) *model.Order {
	expiredAt := time.Now().Add(-time.Minute)
	return &model.Order{
		ID:                   orderID,
		UserID:               "user-1",
		Status:               model.OrderStatusPending,
		ReservationExpiresAt: &expiredAt,
		Items: []model.OrderItem{
			{
				ID:        "item-1",
				OrderID:   orderID,
				ProductID: "product-1",
				Quantity:  2,
			},
		},
	}
}

func TestReservationExpiryWorkerCancelsExpiredOrderAndReleasesStock(t *testing.T) {
	repo := &fakeOrderRepo{
		ordersByID: map[string]*model.Order{
			"order-1": expiredPendingOrderFixture("order-1"),
		},
	}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {Id: "product-1", Name: "Archive Boot", Price: 80, StockQuantity: 1},
		},
		reservations: map[string][]model.OrderItem{
			"order-1": {{ProductID: "product-1", Quantity: 2}},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

	if err := svc.expireDueOrderReservations(context.Background()); err != nil {
		t.Fatalf("expireDueOrderReservations returned error: %v", err)
	}
	if err := svc.releasePendingCancelledOrderStock(context.Background()); err != nil {
		t.Fatalf("releasePendingCancelledOrderStock returned error: %v", err)
	}

	if repo.ordersByID["order-1"].Status != model.OrderStatusCancelled {
		t.Fatalf("expected worker to cancel expired order, got %s", repo.ordersByID["order-1"].Status)
	}
	if catalog.products["product-1"].StockQuantity != 3 {
		t.Fatalf("expected released stock to bring quantity to 3, got %d", catalog.products["product-1"].StockQuantity)
	}
	if !repo.stockReleased["order-1"] {
		t.Fatal("expected worker to mark order stock released")
	}
}

func TestReservationExpiryWorkerSkipsAllocatedAndUnexpiredOrders(t *testing.T) {
	allocatedAt := time.Now()
	futureExpiry := time.Now().Add(10 * time.Minute)
	allocatedOrder := expiredPendingOrderFixture("order-allocated")
	allocatedOrder.ReservationAllocatedAt = &allocatedAt
	unexpiredOrder := expiredPendingOrderFixture("order-unexpired")
	unexpiredOrder.ReservationExpiresAt = &futureExpiry

	repo := &fakeOrderRepo{
		ordersByID: map[string]*model.Order{
			"order-allocated": allocatedOrder,
			"order-unexpired": unexpiredOrder,
		},
	}
	catalog := &fakeProductCatalog{}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

	if err := svc.expireDueOrderReservations(context.Background()); err != nil {
		t.Fatalf("expireDueOrderReservations returned error: %v", err)
	}

	if repo.ordersByID["order-allocated"].Status != model.OrderStatusPending {
		t.Fatalf("expected allocated order to stay pending, got %s", repo.ordersByID["order-allocated"].Status)
	}
	if repo.ordersByID["order-unexpired"].Status != model.OrderStatusPending {
		t.Fatalf("expected unexpired order to stay pending, got %s", repo.ordersByID["order-unexpired"].Status)
	}
	if len(catalog.releaseCalls) != 0 {
		t.Fatalf("expected no release calls, got %#v", catalog.releaseCalls)
	}
}

func TestReservationExpiryWorkerRetriesReleaseAfterFailure(t *testing.T) {
	cancelledOrder := expiredPendingOrderFixture("order-1")
	cancelledOrder.Status = model.OrderStatusCancelled
	cancelledOrder.ReservationExpiresAt = nil

	repo := &fakeOrderRepo{
		ordersByID: map[string]*model.Order{
			"order-1": cancelledOrder,
		},
	}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {Id: "product-1", Name: "Archive Boot", Price: 80, StockQuantity: 1},
		},
		reservations: map[string][]model.OrderItem{
			"order-1": {{ProductID: "product-1", Quantity: 2}},
		},
		failReleaseWithErr: errors.New("product-service unavailable"),
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

	if err := svc.releasePendingCancelledOrderStock(context.Background()); err != nil {
		t.Fatalf("releasePendingCancelledOrderStock returned error: %v", err)
	}
	if repo.stockReleased["order-1"] {
		t.Fatal("expected failed release to keep the order in the retry scan")
	}
	if catalog.products["product-1"].StockQuantity != 1 {
		t.Fatalf("expected stock unchanged after failed release, got %d", catalog.products["product-1"].StockQuantity)
	}

	catalog.failReleaseWithErr = nil
	if err := svc.releasePendingCancelledOrderStock(context.Background()); err != nil {
		t.Fatalf("releasePendingCancelledOrderStock retry returned error: %v", err)
	}
	if !repo.stockReleased["order-1"] {
		t.Fatal("expected retry to mark order stock released")
	}
	if catalog.products["product-1"].StockQuantity != 3 {
		t.Fatalf("expected retry to release stock back to 3, got %d", catalog.products["product-1"].StockQuantity)
	}
	if catalog.releaseCalls["order-1"] != 2 {
		t.Fatalf("expected two release attempts, got %d", catalog.releaseCalls["order-1"])
	}
}

func TestCancelOrderReleasesReservationAndMarksReleased(t *testing.T) {
	pendingOrder := expiredPendingOrderFixture("order-1")
	futureExpiry := time.Now().Add(10 * time.Minute)
	pendingOrder.ReservationExpiresAt = &futureExpiry

	repo := &fakeOrderRepo{
		ordersByID: map[string]*model.Order{
			"order-1": pendingOrder,
		},
	}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {Id: "product-1", Name: "Archive Boot", Price: 80, StockQuantity: 1},
		},
		reservations: map[string][]model.OrderItem{
			"order-1": {{ProductID: "product-1", Quantity: 2}},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

	if err := svc.CancelOrder(context.Background(), "order-1", "user-1"); err != nil {
		t.Fatalf("CancelOrder returned error: %v", err)
	}

	if catalog.products["product-1"].StockQuantity != 3 {
		t.Fatalf("expected cancel to release stock back to 3, got %d", catalog.products["product-1"].StockQuantity)
	}
	if !repo.stockReleased["order-1"] {
		t.Fatal("expected cancel to mark order stock released")
	}
}
