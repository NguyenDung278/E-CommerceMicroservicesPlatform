package service

import (
	"context"
	"errors"
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
	createdOrder        *model.Order
	createdOutbox       *model.OutboxMessage
	createdReturnOutbox *model.OutboxMessage
	updatedReturnOutbox *model.OutboxMessage
	coupons             map[string]*model.Coupon
	userOrders          []*model.Order
	createErr           error
	ordersByID          map[string]*model.Order
	returnsByID         map[string]*model.ReturnRequest
}

func (r *fakeOrderRepo) Create(_ context.Context, order *model.Order, outbox *model.OutboxMessage) error {
	if r.createErr != nil {
		return r.createErr
	}
	r.createdOrder = order
	r.createdOutbox = outbox
	return nil
}

func (r *fakeOrderRepo) GetByID(_ context.Context, id string) (*model.Order, error) {
	order, ok := r.ordersByID[id]
	if !ok {
		return nil, nil
	}

	copyValue := *order
	copyValue.Items = append([]model.OrderItem(nil), order.Items...)
	return &copyValue, nil
}

func (r *fakeOrderRepo) GetByUserID(_ context.Context, _ string) ([]*model.Order, error) {
	return r.userOrders, nil
}

func (r *fakeOrderRepo) CreateReturn(_ context.Context, returnRequest *model.ReturnRequest, outbox *model.OutboxMessage) error {
	if r.returnsByID == nil {
		r.returnsByID = map[string]*model.ReturnRequest{}
	}
	r.returnsByID[returnRequest.ID] = cloneReturnRequest(returnRequest)
	r.createdReturnOutbox = outbox
	return nil
}

func (r *fakeOrderRepo) GetReturnByID(_ context.Context, id string) (*model.ReturnRequest, error) {
	return cloneReturnRequest(r.returnsByID[id]), nil
}

func (r *fakeOrderRepo) ListReturnsByOrderID(_ context.Context, orderID string) ([]*model.ReturnRequest, error) {
	var returns []*model.ReturnRequest
	for _, returnRequest := range r.returnsByID {
		if returnRequest.OrderID == orderID {
			returns = append(returns, cloneReturnRequest(returnRequest))
		}
	}
	return returns, nil
}

func (r *fakeOrderRepo) UpdateReturnStatus(_ context.Context, id string, status model.ReturnStatus, actorID, actorRole, message string, outbox *model.OutboxMessage) error {
	returnRequest, ok := r.returnsByID[id]
	if !ok {
		return nil
	}
	returnRequest.Status = status
	returnRequest.UpdatedAt = time.Now()
	r.updatedReturnOutbox = outbox
	returnRequest.Events = append(returnRequest.Events, model.ReturnEvent{
		ID:        "event-" + id,
		ReturnID:  id,
		Status:    status,
		ActorID:   actorID,
		ActorRole: actorRole,
		Message:   message,
		CreatedAt: time.Now(),
	})
	return nil
}

func (r *fakeOrderRepo) ListAll(_ context.Context, _ model.OrderFilters) ([]*model.Order, int64, error) {
	return nil, 0, nil
}

func (r *fakeOrderRepo) GetEventsByOrderID(_ context.Context, _ string) ([]*model.OrderEvent, error) {
	return nil, nil
}

func (r *fakeOrderRepo) UpdateStatus(_ context.Context, _ string, _ model.OrderStatus, _, _, _ string, _ *model.OutboxMessage) error {
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

func (r *fakeOrderRepo) ListPopularProducts(_ context.Context, _ int) ([]model.ProductPopularity, error) {
	return []model.ProductPopularity{}, nil
}

func (r *fakeOrderRepo) CreateAuditEntry(_ context.Context, _ *model.AuditEntry) error {
	return nil
}

func (r *fakeOrderRepo) ClaimPendingOutbox(_ context.Context, _ int, _ time.Duration) ([]*model.OutboxMessage, error) {
	return nil, nil
}

func (r *fakeOrderRepo) MarkOutboxPublished(_ context.Context, _ string, _ time.Time) error {
	return nil
}

func (r *fakeOrderRepo) MarkOutboxFailed(_ context.Context, _ string, _ string, _ time.Time) error {
	return nil
}

func (r *fakeOrderRepo) ApplyInboxStatusTransition(
	_ context.Context,
	_ *model.InboxMessage,
	_ string,
	_ model.OrderStatus,
	_ model.OrderStatus,
	_, _, _ string,
) (*model.InboxTransitionResult, error) {
	return &model.InboxTransitionResult{}, nil
}

func cloneReturnRequest(returnRequest *model.ReturnRequest) *model.ReturnRequest {
	if returnRequest == nil {
		return nil
	}

	copyValue := *returnRequest
	copyValue.Items = append([]model.ReturnItem(nil), returnRequest.Items...)
	copyValue.Events = append([]model.ReturnEvent(nil), returnRequest.Events...)
	return &copyValue
}

var _ repository.OrderRepository = (*fakeOrderRepo)(nil)

type fakeProductCatalog struct {
	products            map[string]*pb.Product
	calls               map[string]int
	decreaseCalls       map[string]int
	restoreCalls        map[string]int
	failDecreaseForID   string
	failDecreaseWithErr error
}

func (c *fakeProductCatalog) GetProduct(_ context.Context, productID string) (*pb.Product, error) {
	if c.calls == nil {
		c.calls = map[string]int{}
	}
	c.calls[productID]++
	if product, ok := c.products[productID]; ok {
		return product, nil
	}
	return nil, grpcstatus.Error(codes.NotFound, "product not found")
}

func (c *fakeProductCatalog) DecreaseStock(_ context.Context, productID string, quantity int) error {
	if c.decreaseCalls == nil {
		c.decreaseCalls = map[string]int{}
	}
	c.decreaseCalls[productID]++

	if c.failDecreaseForID == productID && c.failDecreaseWithErr != nil {
		return c.failDecreaseWithErr
	}

	product, ok := c.products[productID]
	if !ok {
		return grpcstatus.Error(codes.NotFound, "product not found")
	}
	if int(product.StockQuantity) < quantity {
		return grpcstatus.Error(codes.FailedPrecondition, "insufficient stock")
	}

	product.StockQuantity -= int32(quantity)
	return nil
}

func (c *fakeProductCatalog) RestoreStock(_ context.Context, productID string, quantity int) error {
	if c.restoreCalls == nil {
		c.restoreCalls = map[string]int{}
	}
	c.restoreCalls[productID]++

	product, ok := c.products[productID]
	if !ok {
		return grpcstatus.Error(codes.NotFound, "product not found")
	}

	product.StockQuantity += int32(quantity)
	return nil
}

type fakePaymentHistoryClient struct {
	payments        []model.PaymentSummary
	paymentsByOrder map[string][]model.PaymentSummary
	refunded        []struct {
		paymentID string
		amount    float64
		message   string
	}
	err error
}

func (c *fakePaymentHistoryClient) ListPaymentHistory(_ context.Context, _ string) ([]model.PaymentSummary, error) {
	if c.err != nil {
		return nil, c.err
	}
	return c.payments, nil
}

func (c *fakePaymentHistoryClient) ListPaymentsByOrder(_ context.Context, orderID string) ([]model.PaymentSummary, error) {
	if c.err != nil {
		return nil, c.err
	}
	return c.paymentsByOrder[orderID], nil
}

func (c *fakePaymentHistoryClient) RefundPayment(_ context.Context, paymentID string, amount float64, message string) (*model.PaymentSummary, error) {
	if c.err != nil {
		return nil, c.err
	}
	c.refunded = append(c.refunded, struct {
		paymentID string
		amount    float64
		message   string
	}{paymentID: paymentID, amount: amount, message: message})
	return &model.PaymentSummary{
		ID:                 "refund-" + paymentID,
		OrderID:            "order-1",
		Amount:             amount,
		Status:             "refunded",
		TransactionType:    "refund",
		ReferencePaymentID: paymentID,
	}, nil
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
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

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
	if preview.ShippingMethod != string(model.ShippingMethodPickup) {
		t.Fatalf("expected shipping method pickup, got %q", preview.ShippingMethod)
	}
	if preview.ETALabel != "Ready for pickup within 2 hours" {
		t.Fatalf("expected pickup ETA, got %q", preview.ETALabel)
	}
	if preview.DeliveryPromise != "We will hold the order and confirm pickup readiness by message." {
		t.Fatalf("expected pickup delivery promise, got %q", preview.DeliveryPromise)
	}
	if len(preview.SupportedShippingMethods) != 3 {
		t.Fatalf("expected 3 supported shipping methods, got %d", len(preview.SupportedShippingMethods))
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
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

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

func TestCreateReturnCreatesRequestedReturnForDeliveredOrder(t *testing.T) {
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
						Name:      "Desk Lamp",
						Price:     49.99,
						Quantity:  2,
					},
				},
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), nil, nil)

	returnRequest, err := svc.CreateReturn(context.Background(), "order-1", "user-1", "user@example.com", dto.CreateReturnRequest{
		Reason: "Product arrived damaged on delivery",
		Items: []dto.ReturnItemRequest{
			{
				OrderItemID: "item-1",
				Quantity:    1,
				Reason:      "Shade was cracked",
			},
		},
	})
	if err != nil {
		t.Fatalf("CreateReturn returned error: %v", err)
	}

	if returnRequest.Status != model.ReturnStatusRequested {
		t.Fatalf("expected requested return status, got %s", returnRequest.Status)
	}
	if len(returnRequest.Items) != 1 {
		t.Fatalf("expected 1 return item, got %d", len(returnRequest.Items))
	}
	if repo.returnsByID[returnRequest.ID] == nil {
		t.Fatal("expected return to be persisted in repository")
	}
	if repo.createdReturnOutbox == nil || repo.createdReturnOutbox.RoutingKey != "return.requested" {
		t.Fatalf("expected requested return outbox message, got %#v", repo.createdReturnOutbox)
	}
}

func TestCreateReturnRejectsQuantityAbovePurchasedAmount(t *testing.T) {
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
						Name:      "Desk Lamp",
						Price:     49.99,
						Quantity:  1,
					},
				},
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), nil, nil)

	_, err := svc.CreateReturn(context.Background(), "order-1", "user-1", "user@example.com", dto.CreateReturnRequest{
		Reason: "Need to return both units",
		Items: []dto.ReturnItemRequest{
			{
				OrderItemID: "item-1",
				Quantity:    2,
			},
		},
	})
	if !errors.Is(err, ErrReturnQuantityExceeded) {
		t.Fatalf("expected ErrReturnQuantityExceeded, got %v", err)
	}
}

func TestCreateReturnRejectsAlreadyReturnedQuantity(t *testing.T) {
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
						Name:      "Desk Lamp",
						Price:     49.99,
						Quantity:  2,
					},
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
						Quantity:    2,
					},
				},
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), nil, nil)

	_, err := svc.CreateReturn(context.Background(), "order-1", "user-1", "user@example.com", dto.CreateReturnRequest{
		Reason: "Trying to return beyond available quantity",
		Items: []dto.ReturnItemRequest{
			{
				OrderItemID: "item-1",
				Quantity:    1,
			},
		},
	})
	if !errors.Is(err, ErrReturnQuantityExceeded) {
		t.Fatalf("expected ErrReturnQuantityExceeded for already returned items, got %v", err)
	}
}

func TestUpdateReturnStatusRefundedTriggersPaymentRefundAndOutbox(t *testing.T) {
	repo := &fakeOrderRepo{
		ordersByID: map[string]*model.Order{
			"order-1": {
				ID:             "order-1",
				UserID:         "user-1",
				Status:         model.OrderStatusDelivered,
				SubtotalPrice:  100,
				DiscountAmount: 10,
				Items: []model.OrderItem{
					{
						ID:        "item-1",
						OrderID:   "order-1",
						ProductID: "product-1",
						Name:      "Desk Lamp",
						Price:     100,
						Quantity:  1,
					},
				},
			},
		},
		returnsByID: map[string]*model.ReturnRequest{
			"return-1": {
				ID:        "return-1",
				OrderID:   "order-1",
				UserID:    "user-1",
				UserEmail: "user@example.com",
				Status:    model.ReturnStatusApproved,
				Reason:    "Damaged item",
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
	paymentClient := &fakePaymentHistoryClient{
		paymentsByOrder: map[string][]model.PaymentSummary{
			"order-1": {
				{
					ID:              "payment-1",
					OrderID:         "order-1",
					Amount:          90,
					Status:          "completed",
					TransactionType: "charge",
				},
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), nil, paymentClient)

	if err := svc.UpdateReturnStatus(context.Background(), "return-1", model.ReturnStatusRefunded, "admin-1", "admin", "Refund approved"); err != nil {
		t.Fatalf("UpdateReturnStatus returned error: %v", err)
	}

	if len(paymentClient.refunded) != 1 {
		t.Fatalf("expected 1 refund call, got %d", len(paymentClient.refunded))
	}
	if paymentClient.refunded[0].paymentID != "payment-1" {
		t.Fatalf("expected refund against payment-1, got %q", paymentClient.refunded[0].paymentID)
	}
	if paymentClient.refunded[0].amount != 90 {
		t.Fatalf("expected refund amount 90, got %.2f", paymentClient.refunded[0].amount)
	}
	if repo.returnsByID["return-1"].Status != model.ReturnStatusRefunded {
		t.Fatalf("expected return status refunded, got %s", repo.returnsByID["return-1"].Status)
	}
	if repo.updatedReturnOutbox == nil || repo.updatedReturnOutbox.RoutingKey != "return.refunded" {
		t.Fatalf("expected refunded return outbox message, got %#v", repo.updatedReturnOutbox)
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
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

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
	if repo.createdOutbox == nil {
		t.Fatal("expected repository Create to receive an outbox message")
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
	if catalog.products["product-1"].StockQuantity != 8 {
		t.Fatalf("expected stock to decrease to 8, got %d", catalog.products["product-1"].StockQuantity)
	}
}

func TestPreviewOrderAppliesND2026ToSubtotalAndShipping(t *testing.T) {
	repo := &fakeOrderRepo{
		coupons: map[string]*model.Coupon{
			"ND2026": {
				Code:          "ND2026",
				Description:   "25% off entire order total",
				DiscountType:  model.CouponDiscountTypePercentage,
				DiscountValue: 25,
				Active:        true,
			},
		},
	}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {
				Id:            "product-1",
				Name:          "Archive Tote",
				Price:         80,
				StockQuantity: 12,
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

	preview, err := svc.PreviewOrder(context.Background(), dto.CreateOrderRequest{
		Items: []dto.OrderItemRequest{
			{ProductID: "product-1", Quantity: 1},
		},
		CouponCode:     "nd2026",
		ShippingMethod: "standard",
		ShippingAddress: &dto.ShippingAddressRequest{
			RecipientName: "Nguyen Van B",
			Phone:         "0901234567",
		},
	})
	if err != nil {
		t.Fatalf("PreviewOrder returned error: %v", err)
	}

	if preview.SubtotalPrice != 80 {
		t.Fatalf("expected subtotal 80, got %.2f", preview.SubtotalPrice)
	}
	if preview.ShippingFee != 5.99 {
		t.Fatalf("expected shipping fee 5.99, got %.2f", preview.ShippingFee)
	}
	if preview.DiscountAmount != 21.5 {
		t.Fatalf("expected discount 21.50, got %.2f", preview.DiscountAmount)
	}
	if preview.TotalPrice != 64.49 {
		t.Fatalf("expected total 64.49, got %.2f", preview.TotalPrice)
	}
	if preview.CouponCode != "ND2026" {
		t.Fatalf("expected coupon code ND2026, got %q", preview.CouponCode)
	}
}

func TestCreateOrderRestoresReservedStockWhenPersistenceFails(t *testing.T) {
	repo := &fakeOrderRepo{
		createErr: errors.New("insert failed"),
	}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {
				Id:            "product-1",
				Name:          "Archive Boot",
				Price:         80,
				StockQuantity: 5,
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

	_, err := svc.CreateOrder(context.Background(), "user-1", "user@example.com", dto.CreateOrderRequest{
		Items: []dto.OrderItemRequest{
			{ProductID: "product-1", Quantity: 2},
		},
		ShippingMethod: "pickup",
	})
	if err == nil {
		t.Fatal("expected CreateOrder to return a persistence error")
	}
	if catalog.products["product-1"].StockQuantity != 5 {
		t.Fatalf("expected stock rollback to restore quantity 5, got %d", catalog.products["product-1"].StockQuantity)
	}
	if catalog.restoreCalls["product-1"] != 1 {
		t.Fatalf("expected one stock restore call, got %d", catalog.restoreCalls["product-1"])
	}
}

func TestCreateOrderReturnsInsufficientStockWhenReservationFails(t *testing.T) {
	repo := &fakeOrderRepo{}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {
				Id:            "product-1",
				Name:          "Archive Boot",
				Price:         80,
				StockQuantity: 1,
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

	_, err := svc.CreateOrder(context.Background(), "user-1", "user@example.com", dto.CreateOrderRequest{
		Items: []dto.OrderItemRequest{
			{ProductID: "product-1", Quantity: 2},
		},
		ShippingMethod: "pickup",
	})
	if !errors.Is(err, ErrInsufficientStock) {
		t.Fatalf("expected ErrInsufficientStock, got %v", err)
	}
	if repo.createdOrder != nil {
		t.Fatal("expected no order to be persisted when stock reservation fails")
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
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

	preview, err := svc.PreviewOrder(context.Background(), dto.CreateOrderRequest{
		Items: []dto.OrderItemRequest{
			{ProductID: "product-1", Quantity: 2},
		},
		ShippingMethod: "standard",
		ShippingAddress: &dto.ShippingAddressRequest{
			RecipientName: "Nguyen Van A",
			Phone:         "0901234567",
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
	if preview.ShippingMethod != string(model.ShippingMethodStandard) {
		t.Fatalf("expected standard shipping method, got %q", preview.ShippingMethod)
	}
	if preview.ETALabel != "3-5 business days" {
		t.Fatalf("expected standard ETA, got %q", preview.ETALabel)
	}
	if preview.DeliveryPromise != "Tracked delivery with complimentary shipping from $100." {
		t.Fatalf("expected standard delivery promise, got %q", preview.DeliveryPromise)
	}

	standardOption, ok := findShippingOption(preview.SupportedShippingMethods, string(model.ShippingMethodStandard))
	if !ok {
		t.Fatal("expected supported shipping methods to include standard delivery")
	}
	if standardOption.Fee != 5.99 {
		t.Fatalf("expected standard option fee 5.99, got %.2f", standardOption.Fee)
	}

	expressOption, ok := findShippingOption(preview.SupportedShippingMethods, string(model.ShippingMethodExpress))
	if !ok {
		t.Fatal("expected supported shipping methods to include express delivery")
	}
	if expressOption.Fee != 14.99 {
		t.Fatalf("expected express option fee 14.99, got %.2f", expressOption.Fee)
	}

	pickupOption, ok := findShippingOption(preview.SupportedShippingMethods, string(model.ShippingMethodPickup))
	if !ok {
		t.Fatal("expected supported shipping methods to include pickup")
	}
	if pickupOption.Fee != 0 {
		t.Fatalf("expected pickup option fee 0, got %.2f", pickupOption.Fee)
	}
}

func TestPreviewOrderSupportsExpressDeliveryFromBackendContract(t *testing.T) {
	repo := &fakeOrderRepo{}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {
				Id:            "product-1",
				Name:          "Travel Case",
				Price:         60,
				StockQuantity: 10,
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

	preview, err := svc.PreviewOrder(context.Background(), dto.CreateOrderRequest{
		Items: []dto.OrderItemRequest{
			{ProductID: "product-1", Quantity: 1},
		},
		ShippingMethod: "express",
		ShippingAddress: &dto.ShippingAddressRequest{
			RecipientName: "Nguyen Van C",
			Phone:         "0901234567",
		},
	})
	if err != nil {
		t.Fatalf("PreviewOrder returned error: %v", err)
	}

	if preview.ShippingMethod != string(model.ShippingMethodExpress) {
		t.Fatalf("expected express shipping method, got %q", preview.ShippingMethod)
	}
	if preview.ShippingFee != 14.99 {
		t.Fatalf("expected express fee 14.99, got %.2f", preview.ShippingFee)
	}
	if preview.TotalPrice != 74.99 {
		t.Fatalf("expected total 74.99, got %.2f", preview.TotalPrice)
	}
	if preview.ETALabel != "1-2 business days" {
		t.Fatalf("expected express ETA, got %q", preview.ETALabel)
	}
	if preview.DeliveryPromise != "Priority pick, pack, and dispatch on the next fulfillment window." {
		t.Fatalf("expected express delivery promise, got %q", preview.DeliveryPromise)
	}

	expressOption, ok := findShippingOption(preview.SupportedShippingMethods, string(model.ShippingMethodExpress))
	if !ok {
		t.Fatal("expected express option in supported shipping methods")
	}
	if expressOption.ETALabel != preview.ETALabel {
		t.Fatalf("expected express option ETA to match preview ETA, got %q", expressOption.ETALabel)
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
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

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

func TestGetUserOrderSummaryGroupsPaymentsByOrder(t *testing.T) {
	repo := &fakeOrderRepo{
		userOrders: []*model.Order{
			{ID: "order-2", UserID: "user-1"},
			{ID: "order-1", UserID: "user-1"},
		},
	}
	paymentClient := &fakePaymentHistoryClient{
		payments: []model.PaymentSummary{
			{ID: "payment-1", OrderID: "order-1", Amount: 40},
			{ID: "payment-2", OrderID: "order-1", Amount: 10, TransactionType: "refund"},
			{ID: "payment-3", OrderID: "order-2", Amount: 90},
			{ID: "payment-4", OrderID: "other-order", Amount: 999},
		},
	}

	svc := NewOrderService(repo, nil, zap.NewNop(), &fakeProductCatalog{}, paymentClient)

	summary, err := svc.GetUserOrderSummary(context.Background(), "user-1", "Bearer token")
	if err != nil {
		t.Fatalf("GetUserOrderSummary returned error: %v", err)
	}

	if len(summary.Orders) != 2 {
		t.Fatalf("expected 2 orders, got %d", len(summary.Orders))
	}
	if len(summary.PaymentsByOrder["order-1"]) != 2 {
		t.Fatalf("expected 2 payments for order-1, got %d", len(summary.PaymentsByOrder["order-1"]))
	}
	if len(summary.PaymentsByOrder["order-2"]) != 1 {
		t.Fatalf("expected 1 payment for order-2, got %d", len(summary.PaymentsByOrder["order-2"]))
	}
	if _, exists := summary.PaymentsByOrder["other-order"]; exists {
		t.Fatalf("expected unrelated payments to be filtered out")
	}
}

func TestGetUserOrderSummaryReturnsEmptyPaymentsWhenNoOrders(t *testing.T) {
	svc := NewOrderService(&fakeOrderRepo{}, nil, zap.NewNop(), &fakeProductCatalog{}, nil)

	summary, err := svc.GetUserOrderSummary(context.Background(), "user-1", "Bearer token")
	if err != nil {
		t.Fatalf("GetUserOrderSummary returned error: %v", err)
	}

	if len(summary.Orders) != 0 {
		t.Fatalf("expected no orders, got %d", len(summary.Orders))
	}
	if len(summary.PaymentsByOrder) != 0 {
		t.Fatalf("expected no grouped payments, got %d", len(summary.PaymentsByOrder))
	}
}

func TestPreviewOrderReusesProductLookupWithinSingleQuote(t *testing.T) {
	repo := &fakeOrderRepo{}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {
				Id:            "product-1",
				Name:          "Portable SSD",
				Price:         75,
				StockQuantity: 10,
			},
		},
	}
	svc := NewOrderService(repo, nil, zap.NewNop(), catalog, nil)

	preview, err := svc.PreviewOrder(context.Background(), dto.CreateOrderRequest{
		Items: []dto.OrderItemRequest{
			{ProductID: "product-1", Quantity: 1},
			{ProductID: "product-1", Quantity: 2},
		},
		ShippingMethod: "pickup",
	})
	if err != nil {
		t.Fatalf("PreviewOrder returned error: %v", err)
	}

	if preview.TotalPrice != 225 {
		t.Fatalf("expected total 225, got %.2f", preview.TotalPrice)
	}
	if catalog.calls["product-1"] != 1 {
		t.Fatalf("expected one product lookup for cached quote, got %d", catalog.calls["product-1"])
	}
}

func ptrTime(value time.Time) *time.Time {
	return &value
}

func findShippingOption(options []model.ShippingOption, method string) (model.ShippingOption, bool) {
	for _, option := range options {
		if option.Method == method {
			return option, true
		}
	}

	return model.ShippingOption{}, false
}
