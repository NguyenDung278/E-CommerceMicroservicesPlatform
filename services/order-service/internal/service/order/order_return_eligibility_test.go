package service

import (
	"context"
	"testing"
	"time"

	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

func TestGetReturnEligibilityTracksRemainingQuantityPerOrderItem(t *testing.T) {
	deliveredAt := time.Now().AddDate(0, 0, -5).UTC()
	repo := &fakeOrderRepo{
		ordersByID: map[string]*model.Order{
			"order-1": {
				ID:     "order-1",
				UserID: "user-1",
				Status: model.OrderStatusDelivered,
				Items: []model.OrderItem{
					{
						ID:        "item-1",
						OrderID:   "order-1",
						ProductID: "product-1",
						Name:      "Archive Coat",
						Quantity:  2,
					},
					{
						ID:        "item-2",
						OrderID:   "order-1",
						ProductID: "product-2",
						Name:      "Studio Tee",
						Quantity:  1,
					},
				},
			},
		},
		orderEventsByOrderID: map[string][]*model.OrderEvent{
			"order-1": {
				{
					ID:        "event-delivered",
					OrderID:   "order-1",
					Status:    model.OrderStatusDelivered,
					CreatedAt: deliveredAt,
				},
			},
		},
		returnsByID: map[string]*model.ReturnRequest{
			"return-1": {
				ID:      "return-1",
				OrderID: "order-1",
				UserID:  "user-1",
				Status:  model.ReturnStatusRequested,
				Items: []model.ReturnItem{
					{
						ID:          "return-item-1",
						ReturnID:    "return-1",
						OrderItemID: "item-1",
						ProductID:   "product-1",
						Quantity:    1,
					},
				},
			},
		},
	}
	service := NewOrderService(repo, nil, zap.NewNop(), nil, nil)

	snapshot, err := service.GetReturnEligibility(context.Background(), "order-1", "user-1", "user")
	if err != nil {
		t.Fatalf("GetReturnEligibility returned error: %v", err)
	}
	if snapshot == nil {
		t.Fatal("expected non-nil snapshot")
	}
	if !snapshot.Eligible {
		t.Fatalf("expected order to remain eligible, got %#v", snapshot)
	}
	if snapshot.ReturnWindowStartedAt == nil || !snapshot.ReturnWindowStartedAt.Equal(deliveredAt) {
		t.Fatalf("expected delivered event to anchor return window, got %#v", snapshot.ReturnWindowStartedAt)
	}
	if len(snapshot.Items) != 2 {
		t.Fatalf("expected 2 eligibility items, got %d", len(snapshot.Items))
	}
	if snapshot.Items[0].OrderItemID != "item-1" ||
		snapshot.Items[0].AlreadyRequestedQuantity != 1 ||
		snapshot.Items[0].RemainingQuantity != 1 ||
		!snapshot.Items[0].Eligible {
		t.Fatalf("unexpected item-1 eligibility snapshot: %#v", snapshot.Items[0])
	}
	if snapshot.Items[1].OrderItemID != "item-2" ||
		snapshot.Items[1].RemainingQuantity != 1 ||
		!snapshot.Items[1].Eligible {
		t.Fatalf("unexpected item-2 eligibility snapshot: %#v", snapshot.Items[1])
	}
}

func TestGetReturnEligibilityMarksExpiredReturnWindow(t *testing.T) {
	deliveredAt := time.Now().AddDate(0, 0, -40).UTC()
	repo := &fakeOrderRepo{
		ordersByID: map[string]*model.Order{
			"order-1": {
				ID:     "order-1",
				UserID: "user-1",
				Status: model.OrderStatusDelivered,
				Items: []model.OrderItem{
					{
						ID:        "item-1",
						OrderID:   "order-1",
						ProductID: "product-1",
						Name:      "Archive Coat",
						Quantity:  1,
					},
				},
			},
		},
		orderEventsByOrderID: map[string][]*model.OrderEvent{
			"order-1": {
				{
					ID:        "event-delivered",
					OrderID:   "order-1",
					Status:    model.OrderStatusDelivered,
					CreatedAt: deliveredAt,
				},
			},
		},
	}
	service := NewOrderService(repo, nil, zap.NewNop(), nil, nil)

	snapshot, err := service.GetReturnEligibility(context.Background(), "order-1", "user-1", "user")
	if err != nil {
		t.Fatalf("GetReturnEligibility returned error: %v", err)
	}
	if snapshot == nil {
		t.Fatal("expected non-nil snapshot")
	}
	if snapshot.Eligible {
		t.Fatalf("expected expired window to disable returns, got %#v", snapshot)
	}
	if snapshot.Reason != "return_window_expired" {
		t.Fatalf("expected return_window_expired reason, got %#v", snapshot)
	}
	if len(snapshot.Items) != 1 || snapshot.Items[0].Reason != "return_window_expired" || snapshot.Items[0].Eligible {
		t.Fatalf("expected ineligible item snapshot, got %#v", snapshot.Items)
	}
}
