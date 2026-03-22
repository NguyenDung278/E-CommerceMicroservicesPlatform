package service

import (
	"context"
	"testing"
	"time"

	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"

	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/repository"
)

type fakeOrderRepo struct {
	createdOrder *model.Order
	coupons      map[string]*model.Coupon
}

func (r *fakeOrderRepo) Create(_ context.Context, order *model.Order) error {
	r.createdOrder = order
	return nil
}

func (r *fakeOrderRepo) GetByID(_ context.Context, _ string) (*model.Order, error) {
	return nil, nil
}

func (r *fakeOrderRepo) GetByUserID(_ context.Context, _ string) ([]*model.Order, error) {
	return nil, nil
}

func (r *fakeOrderRepo) ListAll(_ context.Context, _ model.OrderFilters) ([]*model.Order, int64, error) {
	return nil, 0, nil
}

func (r *fakeOrderRepo) GetEventsByOrderID(_ context.Context, _ string) ([]*model.OrderEvent, error) {
	return nil, nil
}

func (r *fakeOrderRepo) UpdateStatus(_ context.Context, _ string, _ model.OrderStatus, _, _, _ string) error {
	return nil
}

func (r *fakeOrderRepo) CreateCoupon(_ context.Context, coupon *model.Coupon) error {
	if r.coupons == nil {
		r.coupons = map[string]*model.Coupon{}
	}
	r.coupons[coupon.Code] = coupon
	return nil
}

func (r *fakeOrderRepo) ListCoupons(_ context.Context) ([]*model.Coupon, error) {
	coupons := make([]*model.Coupon, 0, len(r.coupons))
	for _, coupon := range r.coupons {
		coupons = append(coupons, coupon)
	}
	return coupons, nil
}

func (r *fakeOrderRepo) GetCouponByCode(_ context.Context, code string) (*model.Coupon, error) {
	if coupon, ok := r.coupons[code]; ok {
		return coupon, nil
	}
	return nil, nil
}

func (r *fakeOrderRepo) GetAdminReport(_ context.Context, _ time.Time, _ time.Time, windowDays int) (*model.AdminReport, error) {
	return &model.AdminReport{WindowDays: windowDays}, nil
}

var _ repository.OrderRepository = (*fakeOrderRepo)(nil)

type fakeProductCatalog struct {
	products map[string]*pb.Product
}

func (c *fakeProductCatalog) GetProduct(_ context.Context, productID string) (*pb.Product, error) {
	if product, ok := c.products[productID]; ok {
		return product, nil
	}
	return nil, grpcstatus.Error(codes.NotFound, "product not found")
}

func (c *fakeProductCatalog) RestoreStock(_ context.Context, _ string, _ int) error {
	return nil
}

func TestPreviewOrderAppliesCouponPricing(t *testing.T) {
	repo := &fakeOrderRepo{
		coupons: map[string]*model.Coupon{
			"SAVE10": {
				Code:           "SAVE10",
				Description:    "Giảm 10% cho đơn đủ điều kiện",
				DiscountType:   model.CouponDiscountTypePercentage,
				DiscountValue:  10,
				MinOrderAmount: 50,
				Active:         true,
				ExpiresAt:      ptrTime(time.Now().Add(2 * time.Hour)),
			},
		},
	}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {
				Id:            "product-1",
				Name:          "Mechanical Keyboard",
				Price:         50,
				StockQuantity: 8,
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog)

	preview, err := svc.PreviewOrder(context.Background(), dto.CreateOrderRequest{
		Items: []dto.OrderItemRequest{
			{ProductID: "product-1", Quantity: 2},
		},
		CouponCode:     " save10 ",
		ShippingMethod: "pickup",
	})
	if err != nil {
		t.Fatalf("PreviewOrder returned error: %v", err)
	}

	if preview.SubtotalPrice != 100 {
		t.Fatalf("expected subtotal 100, got %.2f", preview.SubtotalPrice)
	}
	if preview.DiscountAmount != 10 {
		t.Fatalf("expected discount 10, got %.2f", preview.DiscountAmount)
	}
	if preview.TotalPrice != 90 {
		t.Fatalf("expected total 90, got %.2f", preview.TotalPrice)
	}
	if preview.CouponCode != "SAVE10" {
		t.Fatalf("expected normalized coupon code SAVE10, got %q", preview.CouponCode)
	}
}

func TestPreviewOrderRejectsCouponWhenMinimumNotMet(t *testing.T) {
	repo := &fakeOrderRepo{
		coupons: map[string]*model.Coupon{
			"SAVE20": {
				Code:           "SAVE20",
				DiscountType:   model.CouponDiscountTypeFixed,
				DiscountValue:  20,
				MinOrderAmount: 200,
				Active:         true,
			},
		},
	}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {
				Id:            "product-1",
				Name:          "Wireless Mouse",
				Price:         45,
				StockQuantity: 4,
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog)

	_, err := svc.PreviewOrder(context.Background(), dto.CreateOrderRequest{
		Items: []dto.OrderItemRequest{
			{ProductID: "product-1", Quantity: 1},
		},
		CouponCode:     "SAVE20",
		ShippingMethod: "pickup",
	})
	if err == nil {
		t.Fatal("expected PreviewOrder to reject coupon below minimum order amount")
	}
	if err != ErrCouponMinimumNotMet {
		t.Fatalf("expected ErrCouponMinimumNotMet, got %v", err)
	}
}

func TestCreateOrderPersistsDiscountedTotals(t *testing.T) {
	repo := &fakeOrderRepo{
		coupons: map[string]*model.Coupon{
			"FLASH15": {
				Code:           "FLASH15",
				DiscountType:   model.CouponDiscountTypePercentage,
				DiscountValue:  15,
				MinOrderAmount: 100,
				Active:         true,
			},
		},
	}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {
				Id:            "product-1",
				Name:          "Gaming Headset",
				Price:         80,
				StockQuantity: 10,
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog)

	order, err := svc.CreateOrder(context.Background(), "user-1", "user@example.com", dto.CreateOrderRequest{
		Items: []dto.OrderItemRequest{
			{ProductID: "product-1", Quantity: 2},
		},
		CouponCode:     "flash15",
		ShippingMethod: "pickup",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	if repo.createdOrder == nil {
		t.Fatal("expected repository Create to receive an order")
	}
	if order.SubtotalPrice != 160 {
		t.Fatalf("expected subtotal 160, got %.2f", order.SubtotalPrice)
	}
	if order.DiscountAmount != 24 {
		t.Fatalf("expected discount 24, got %.2f", order.DiscountAmount)
	}
	if order.TotalPrice != 136 {
		t.Fatalf("expected total 136, got %.2f", order.TotalPrice)
	}
	if order.CouponCode != "FLASH15" {
		t.Fatalf("expected coupon code FLASH15, got %q", order.CouponCode)
	}
}

func TestPreviewOrderAddsShippingFeeForStandardDelivery(t *testing.T) {
	repo := &fakeOrderRepo{}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {
				Id:            "product-1",
				Name:          "Desk Lamp",
				Price:         30,
				StockQuantity: 10,
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog)

	preview, err := svc.PreviewOrder(context.Background(), dto.CreateOrderRequest{
		Items: []dto.OrderItemRequest{
			{ProductID: "product-1", Quantity: 2},
		},
		ShippingMethod: "standard",
		ShippingAddress: &dto.ShippingAddressRequest{
			RecipientName: "Nguyen Van A",
			Phone:         "0901234567",
			Street:        "123 Nguyen Trai",
			District:      "District 1",
			City:          "Ho Chi Minh",
		},
	})
	if err != nil {
		t.Fatalf("PreviewOrder returned error: %v", err)
	}

	if preview.ShippingFee != 5.99 {
		t.Fatalf("expected shipping fee 5.99, got %.2f", preview.ShippingFee)
	}
	if preview.TotalPrice != 65.99 {
		t.Fatalf("expected total 65.99, got %.2f", preview.TotalPrice)
	}
}

func TestCreateOrderRequiresShippingAddressForDelivery(t *testing.T) {
	repo := &fakeOrderRepo{}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {
				Id:            "product-1",
				Name:          "Desk Lamp",
				Price:         30,
				StockQuantity: 10,
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog)

	_, err := svc.CreateOrder(context.Background(), "user-1", "user@example.com", dto.CreateOrderRequest{
		Items: []dto.OrderItemRequest{
			{ProductID: "product-1", Quantity: 1},
		},
		ShippingMethod: "standard",
	})
	if err == nil {
		t.Fatal("expected CreateOrder to require a shipping address for standard delivery")
	}
	if err != ErrShippingAddressRequired {
		t.Fatalf("expected ErrShippingAddressRequired, got %v", err)
	}
}

func ptrTime(value time.Time) *time.Time {
	return &value
}
