package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"

	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/repository"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/service"
)

type fakeOrderHandlerRepo struct {
	coupons              map[string]*model.Coupon
	ordersByID           map[string]*model.Order
	orderEventsByOrderID map[string][]*model.OrderEvent
	returnsByID          map[string]*model.ReturnRequest
	queueHealth          *model.ReturnQueueHealth
	forceNilQueueHealth  bool
}

func (r *fakeOrderHandlerRepo) Create(_ context.Context, _ *model.Order, _ *model.OutboxMessage) error {
	return nil
}

func (r *fakeOrderHandlerRepo) CreateWithIdempotency(_ context.Context, _ *model.Order, _ *model.OutboxMessage, _ *model.OrderIdempotencyRecord) error {
	return nil
}

func (r *fakeOrderHandlerRepo) GetByID(_ context.Context, id string) (*model.Order, error) {
	order, ok := r.ordersByID[id]
	if !ok {
		return nil, nil
	}

	copyValue := *order
	copyValue.Items = append([]model.OrderItem(nil), order.Items...)
	return &copyValue, nil
}

func (r *fakeOrderHandlerRepo) GetByUserID(_ context.Context, _ string) ([]*model.Order, error) {
	return nil, nil
}

func (r *fakeOrderHandlerRepo) GetIdempotencyKey(_ context.Context, _, _ string) (*model.OrderIdempotencyRecord, error) {
	return nil, nil
}

func (r *fakeOrderHandlerRepo) CreateReturn(_ context.Context, returnRequest *model.ReturnRequest, _ *model.OutboxMessage) error {
	if r.returnsByID == nil {
		r.returnsByID = map[string]*model.ReturnRequest{}
	}
	r.returnsByID[returnRequest.ID] = cloneHandlerReturnRequest(returnRequest)
	return nil
}

func (r *fakeOrderHandlerRepo) GetReturnByID(_ context.Context, id string) (*model.ReturnRequest, error) {
	return cloneHandlerReturnRequest(r.returnsByID[id]), nil
}

func (r *fakeOrderHandlerRepo) ListReturnsByOrderID(_ context.Context, orderID string) ([]*model.ReturnRequest, error) {
	var returns []*model.ReturnRequest
	for _, returnRequest := range r.returnsByID {
		if returnRequest.OrderID == orderID {
			returns = append(returns, cloneHandlerReturnRequest(returnRequest))
		}
	}
	return returns, nil
}

func (r *fakeOrderHandlerRepo) ListReturns(_ context.Context, filters model.ReturnFilters) ([]*model.ReturnRequest, int64, error) {
	var returns []*model.ReturnRequest
	for _, returnRequest := range r.returnsByID {
		if filters.UserID != "" && returnRequest.UserID != filters.UserID {
			continue
		}
		if filters.Status != "" && returnRequest.Status != filters.Status {
			continue
		}
		if filters.Query != "" &&
			!strings.Contains(returnRequest.ID, filters.Query) &&
			!strings.Contains(returnRequest.OrderID, filters.Query) &&
			!strings.Contains(returnRequest.UserID, filters.Query) &&
			!strings.Contains(returnRequest.UserEmail, filters.Query) &&
			!strings.Contains(returnRequest.Reason, filters.Query) {
			continue
		}
		returns = append(returns, cloneHandlerReturnRequest(returnRequest))
	}
	return returns, int64(len(returns)), nil
}

func (r *fakeOrderHandlerRepo) ListAll(_ context.Context, _ model.OrderFilters) ([]*model.Order, int64, error) {
	orders := make([]*model.Order, 0, len(r.ordersByID))
	for _, order := range r.ordersByID {
		copyValue := *order
		copyValue.Items = append([]model.OrderItem(nil), order.Items...)
		orders = append(orders, &copyValue)
	}
	return orders, int64(len(orders)), nil
}

func (r *fakeOrderHandlerRepo) ListAllByCursor(_ context.Context, filters model.OrderFilters) ([]*model.Order, string, bool, error) {
	orders, _, err := r.ListAll(context.Background(), filters)
	return orders, "", false, err
}

func (r *fakeOrderHandlerRepo) AddReturnEvidence(
	_ context.Context,
	returnID string,
	status model.ReturnStatus,
	evidence []model.ReturnEvidence,
	actorID, actorRole, message string,
) error {
	current, ok := r.returnsByID[returnID]
	if !ok {
		return nil
	}
	current.Evidence = append(current.Evidence, evidence...)
	current.UpdatedAt = time.Now()
	current.Events = append(current.Events, model.ReturnEvent{
		ID:        "event-evidence-" + returnID,
		ReturnID:  returnID,
		Status:    status,
		ActorID:   actorID,
		ActorRole: actorRole,
		Message:   message,
		CreatedAt: time.Now(),
	})
	return nil
}

func (r *fakeOrderHandlerRepo) GetReturnQueueHealth(_ context.Context) (*model.ReturnQueueHealth, error) {
	if r.forceNilQueueHealth {
		return nil, nil
	}
	if r.queueHealth == nil {
		return &model.ReturnQueueHealth{RecentFailures: []model.ReturnQueueFailure{}}, nil
	}

	healthCopy := *r.queueHealth
	healthCopy.RecentFailures = append([]model.ReturnQueueFailure(nil), r.queueHealth.RecentFailures...)
	return &healthCopy, nil
}

func (r *fakeOrderHandlerRepo) UpdateReturnStatus(_ context.Context, id string, status model.ReturnStatus, actorID, actorRole, message string, _ *model.OutboxMessage) error {
	returnRequest, ok := r.returnsByID[id]
	if !ok {
		return nil
	}
	returnRequest.Status = status
	returnRequest.UpdatedAt = time.Now()
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

func (r *fakeOrderHandlerRepo) ScheduleReturnRefund(_ context.Context, returnRequest *model.ReturnRequest, actorID, actorRole, message string, _ *model.OutboxMessage) error {
	current, ok := r.returnsByID[returnRequest.ID]
	if !ok {
		return nil
	}
	current.Status = model.ReturnStatusRefundPending
	current.RefundAmount = returnRequest.RefundAmount
	current.RefundChargePaymentID = returnRequest.RefundChargePaymentID
	current.RefundRequestedAt = returnRequest.RefundRequestedAt
	current.RefundNextRetryAt = returnRequest.RefundNextRetryAt
	current.Events = append(current.Events, model.ReturnEvent{
		ID:        "event-schedule-" + returnRequest.ID,
		ReturnID:  returnRequest.ID,
		Status:    model.ReturnStatusRefundPending,
		ActorID:   actorID,
		ActorRole: actorRole,
		Message:   message,
		CreatedAt: time.Now(),
	})
	return nil
}

func (r *fakeOrderHandlerRepo) ClaimPendingReturnRefunds(_ context.Context, _ int, _ time.Duration) ([]*model.ReturnRequest, error) {
	return nil, nil
}

func (r *fakeOrderHandlerRepo) CompleteReturnRefund(_ context.Context, returnRequest *model.ReturnRequest, actorID, actorRole, message string, _ *model.OutboxMessage) error {
	current, ok := r.returnsByID[returnRequest.ID]
	if !ok {
		return nil
	}
	current.Status = model.ReturnStatusRefunded
	current.RefundPaymentID = returnRequest.RefundPaymentID
	current.RefundCompletedAt = returnRequest.RefundCompletedAt
	current.Events = append(current.Events, model.ReturnEvent{
		ID:        "event-complete-" + returnRequest.ID,
		ReturnID:  returnRequest.ID,
		Status:    model.ReturnStatusRefunded,
		ActorID:   actorID,
		ActorRole: actorRole,
		Message:   message,
		CreatedAt: time.Now(),
	})
	return nil
}

func (r *fakeOrderHandlerRepo) MarkReturnRefundAttemptFailed(_ context.Context, _ string, _ string, _ time.Time) error {
	return nil
}

func (r *fakeOrderHandlerRepo) GetEventsByOrderID(_ context.Context, orderID string) ([]*model.OrderEvent, error) {
	source := r.orderEventsByOrderID[orderID]
	events := make([]*model.OrderEvent, 0, len(source))
	for _, event := range source {
		if event == nil {
			continue
		}
		copyValue := *event
		events = append(events, &copyValue)
	}
	return events, nil
}

func (r *fakeOrderHandlerRepo) UpdateStatus(_ context.Context, _ string, _ model.OrderStatus, _, _, _ string, _ *model.OutboxMessage) error {
	return nil
}

func (r *fakeOrderHandlerRepo) CreateCoupon(_ context.Context, coupon *model.Coupon) error {
	if r.coupons == nil {
		r.coupons = map[string]*model.Coupon{}
	}
	r.coupons[coupon.Code] = coupon
	return nil
}

func (r *fakeOrderHandlerRepo) ListCoupons(_ context.Context) ([]*model.Coupon, error) {
	return nil, nil
}

func (r *fakeOrderHandlerRepo) GetCouponByCode(_ context.Context, code string) (*model.Coupon, error) {
	if coupon, ok := r.coupons[code]; ok {
		return coupon, nil
	}
	return nil, nil
}

func (r *fakeOrderHandlerRepo) GetAdminReport(_ context.Context, _, _ time.Time, windowDays int) (*model.AdminReport, error) {
	return &model.AdminReport{WindowDays: windowDays}, nil
}

func (r *fakeOrderHandlerRepo) ListPopularProducts(_ context.Context, _ int) ([]model.ProductPopularity, error) {
	return []model.ProductPopularity{}, nil
}

func (r *fakeOrderHandlerRepo) CreateAuditEntry(_ context.Context, _ *model.AuditEntry) error {
	return nil
}

func (r *fakeOrderHandlerRepo) ClaimPendingOutbox(_ context.Context, _ int, _ time.Duration) ([]*model.OutboxMessage, error) {
	return nil, nil
}

func (r *fakeOrderHandlerRepo) MarkOutboxPublished(_ context.Context, _ string, _ time.Time) error {
	return nil
}

func (r *fakeOrderHandlerRepo) MarkOutboxFailed(_ context.Context, _, _ string, _ time.Time) error {
	return nil
}

func (r *fakeOrderHandlerRepo) ExpirePendingReservation(
	_ context.Context,
	orderID string,
	_, _, _ string,
	_ *model.OutboxMessage,
) (bool, error) {
	order, ok := r.ordersByID[orderID]
	if !ok || order.Status != model.OrderStatusPending {
		return false, nil
	}
	order.Status = model.OrderStatusCancelled
	order.ReservationExpiresAt = nil
	order.ReservationAllocatedAt = nil
	return true, nil
}

func (r *fakeOrderHandlerRepo) ApplyInboxStatusTransition(
	_ context.Context,
	_ *model.InboxMessage,
	_ string,
	_ model.OrderStatus,
	_ model.OrderStatus,
	_, _, _ string,
) (*model.InboxTransitionResult, error) {
	return &model.InboxTransitionResult{}, nil
}

func cloneHandlerReturnRequest(returnRequest *model.ReturnRequest) *model.ReturnRequest {
	if returnRequest == nil {
		return nil
	}

	copyValue := *returnRequest
	copyValue.Items = append([]model.ReturnItem(nil), returnRequest.Items...)
	copyValue.Events = append([]model.ReturnEvent(nil), returnRequest.Events...)
	copyValue.Evidence = append([]model.ReturnEvidence(nil), returnRequest.Evidence...)
	return &copyValue
}

var _ repository.OrderRepository = (*fakeOrderHandlerRepo)(nil)

type fakeOrderHandlerCatalog struct {
	products map[string]*pb.Product
}

func (c *fakeOrderHandlerCatalog) GetProduct(_ context.Context, productID string) (*pb.Product, error) {
	if product, ok := c.products[productID]; ok {
		return product, nil
	}

	return nil, grpcstatus.Error(codes.NotFound, "product not found")
}

func (c *fakeOrderHandlerCatalog) DecreaseStock(_ context.Context, _ string, _ int) error {
	return nil
}

func (c *fakeOrderHandlerCatalog) RestoreStock(_ context.Context, _ string, _ int) error {
	return nil
}

type fakeOrderHandlerPaymentClient struct {
	paymentsByOrder map[string][]model.PaymentSummary
}

func (c *fakeOrderHandlerPaymentClient) ListPaymentHistory(_ context.Context, _ string) ([]model.PaymentSummary, error) {
	return nil, nil
}

func (c *fakeOrderHandlerPaymentClient) ListPaymentsByOrder(_ context.Context, orderID string) ([]model.PaymentSummary, error) {
	return c.paymentsByOrder[orderID], nil
}

func (c *fakeOrderHandlerPaymentClient) RefundPayment(_ context.Context, paymentID string, amount float64, message, _ string) (*model.PaymentSummary, error) {
	return &model.PaymentSummary{
		ID:                 "refund-" + paymentID,
		OrderID:            "order-1",
		Amount:             amount,
		Status:             "refunded",
		TransactionType:    "refund",
		ReferencePaymentID: paymentID,
		FailureReason:      message,
	}, nil
}

type fakeOrderHandlerMediaStore struct{}

func (s *fakeOrderHandlerMediaStore) EnsureBucket(_ context.Context) error {
	return nil
}

func (s *fakeOrderHandlerMediaStore) Upload(_ context.Context, objectKey string, _ io.Reader, _ int64, _ string) (string, error) {
	return "https://cdn.example.com/" + objectKey, nil
}

func TestPreviewOrderReturnsShippingMethodsContract(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	repo := &fakeOrderHandlerRepo{}
	catalog := &fakeOrderHandlerCatalog{
		products: map[string]*pb.Product{
			"product-1": {
				Id:            "product-1",
				Name:          "Archive Coat",
				Price:         60,
				StockQuantity: 5,
			},
		},
	}

	handler := NewOrderHandler(service.NewOrderService(repo, nil, zap.NewNop(), catalog, nil))
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	body, _ := json.Marshal(map[string]any{
		"items": []map[string]any{
			{
				"product_id": "product-1",
				"quantity":   1,
			},
		},
		"shipping_method": "express",
		"shipping_address": map[string]any{
			"recipient_name": "Nguyen Van D",
			"phone":          "0901234567",
			"location":       "123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City",
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/preview", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			ShippingMethod           string  `json:"shipping_method"`
			ShippingFee              float64 `json:"shipping_fee"`
			ETALabel                 string  `json:"eta_label"`
			DeliveryPromise          string  `json:"delivery_promise"`
			SupportedShippingMethods []struct {
				Method          string  `json:"method"`
				Label           string  `json:"label"`
				Fee             float64 `json:"fee"`
				ETALabel        string  `json:"eta_label"`
				DeliveryPromise string  `json:"delivery_promise"`
			} `json:"supported_shipping_methods"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode preview response: %v", err)
	}

	if !payload.Success {
		t.Fatal("expected success response")
	}
	if payload.Data.ShippingMethod != "express" {
		t.Fatalf("expected express shipping method, got %q", payload.Data.ShippingMethod)
	}
	if payload.Data.ShippingFee != 14.99 {
		t.Fatalf("expected express shipping fee 14.99, got %.2f", payload.Data.ShippingFee)
	}
	if payload.Data.ETALabel != "1-2 business days" {
		t.Fatalf("expected express ETA label, got %q", payload.Data.ETALabel)
	}
	if payload.Data.DeliveryPromise != "Priority pick, pack, and dispatch on the next fulfillment window." {
		t.Fatalf("unexpected delivery promise: %q", payload.Data.DeliveryPromise)
	}
	if len(payload.Data.SupportedShippingMethods) != 3 {
		t.Fatalf("expected 3 supported shipping methods, got %d", len(payload.Data.SupportedShippingMethods))
	}
	if payload.Data.SupportedShippingMethods[0].Method != "standard" ||
		payload.Data.SupportedShippingMethods[1].Method != "express" ||
		payload.Data.SupportedShippingMethods[2].Method != "pickup" {
		t.Fatalf("unexpected shipping method order: %+v", payload.Data.SupportedShippingMethods)
	}
}

func TestPreviewOrderRequiresAddressForDelivery(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	repo := &fakeOrderHandlerRepo{}
	catalog := &fakeOrderHandlerCatalog{
		products: map[string]*pb.Product{
			"product-1": {
				Id:            "product-1",
				Name:          "Archive Coat",
				Price:         60,
				StockQuantity: 5,
			},
		},
	}

	handler := NewOrderHandler(service.NewOrderService(repo, nil, zap.NewNop(), catalog, nil))
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	body, _ := json.Marshal(map[string]any{
		"items": []map[string]any{
			{
				"product_id": "product-1",
				"quantity":   1,
			},
		},
		"shipping_method": "standard",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/preview", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte("shipping address is required")) {
		t.Fatalf("expected missing shipping address message, got %s", rec.Body.String())
	}
}

func TestCreateReturnRouteCreatesRequestedReturn(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	repo := &fakeOrderHandlerRepo{
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
						Price:     60,
						Quantity:  1,
					},
				},
			},
		},
	}

	handler := NewOrderHandler(service.NewOrderService(repo, nil, zap.NewNop(), nil, nil))
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	body, _ := json.Marshal(map[string]any{
		"reason": "Received the wrong size item",
		"items": []map[string]any{
			{
				"order_item_id": "item-1",
				"quantity":      1,
				"reason":        "Need the correct size",
			},
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/order-1/returns", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"status":"requested"`)) {
		t.Fatalf("expected requested return status, got %s", rec.Body.String())
	}
}

func TestGetReturnEligibilityRouteReturnsPerItemSnapshot(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	deliveredAt := time.Now().AddDate(0, 0, -3).UTC()
	repo := &fakeOrderHandlerRepo{
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

	handler := NewOrderHandler(service.NewOrderService(repo, nil, zap.NewNop(), nil, nil))
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/orders/order-1/return-eligibility", http.NoBody)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"remaining_quantity":1`)) {
		t.Fatalf("expected remaining quantity payload, got %s", rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"eligible":true`)) {
		t.Fatalf("expected eligibility flag in response, got %s", rec.Body.String())
	}
}

func TestUploadReturnEvidenceRouteReturnsUpdatedReturn(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	repo := &fakeOrderHandlerRepo{
		returnsByID: map[string]*model.ReturnRequest{
			"return-1": {
				ID:      "return-1",
				OrderID: "order-1",
				UserID:  "user-1",
				Status:  model.ReturnStatusRequested,
				Reason:  "Package arrived damaged",
				Events: []model.ReturnEvent{
					{
						ID:        "event-1",
						ReturnID:  "return-1",
						Status:    model.ReturnStatusRequested,
						ActorID:   "user-1",
						ActorRole: "user",
						Message:   "return requested",
						CreatedAt: time.Now(),
					},
				},
			},
		},
	}

	svc := service.NewOrderService(repo, nil, zap.NewNop(), nil, nil)
	svc.SetReturnMediaStore(&fakeOrderHandlerMediaStore{})
	handler := NewOrderHandler(svc)
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	partHeader := textproto.MIMEHeader{}
	partHeader.Set("Content-Disposition", `form-data; name="evidence"; filename="damage-front.png"`)
	partHeader.Set("Content-Type", "image/png")
	part, err := writer.CreatePart(partHeader)
	if err != nil {
		t.Fatalf("failed to create multipart file: %v", err)
	}
	if _, err := part.Write([]byte("fake-image-bytes")); err != nil {
		t.Fatalf("failed to write multipart file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/returns/return-1/evidence", body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"file_name":"damage-front.png"`)) {
		t.Fatalf("expected uploaded evidence in payload, got %s", rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"url":"https://cdn.example.com/`)) {
		t.Fatalf("expected uploaded evidence URL, got %s", rec.Body.String())
	}
}

func TestAdminUpdateReturnStatusRouteUpdatesReturn(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	repo := &fakeOrderHandlerRepo{
		returnsByID: map[string]*model.ReturnRequest{
			"return-1": {
				ID:      "return-1",
				OrderID: "order-1",
				UserID:  "user-1",
				Status:  model.ReturnStatusRequested,
				Reason:  "Package arrived damaged",
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

	handler := NewOrderHandler(service.NewOrderService(repo, nil, zap.NewNop(), nil, nil))
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	body, _ := json.Marshal(map[string]any{
		"status":  "approved",
		"message": "Approved after QA review",
	})

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/returns/return-1/status", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleAdmin))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"status":"approved"`)) {
		t.Fatalf("expected approved return status, got %s", rec.Body.String())
	}
}

func TestAdminRequestReturnRefundRouteQueuesRefundPending(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	repo := &fakeOrderHandlerRepo{
		ordersByID: map[string]*model.Order{
			"order-1": {
				ID:             "order-1",
				UserID:         "user-1",
				Status:         model.OrderStatusDelivered,
				SubtotalPrice:  120,
				DiscountAmount: 20,
				Items: []model.OrderItem{
					{
						ID:        "item-1",
						OrderID:   "order-1",
						ProductID: "product-1",
						Name:      "Archive Coat",
						Price:     120,
						Quantity:  1,
					},
				},
			},
		},
		returnsByID: map[string]*model.ReturnRequest{
			"return-1": {
				ID:      "return-1",
				OrderID: "order-1",
				UserID:  "user-1",
				Status:  model.ReturnStatusApproved,
				Reason:  "Package arrived damaged",
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
	paymentClient := &fakeOrderHandlerPaymentClient{
		paymentsByOrder: map[string][]model.PaymentSummary{
			"order-1": {
				{
					ID:              "payment-1",
					OrderID:         "order-1",
					Amount:          100,
					Status:          "completed",
					TransactionType: "charge",
				},
			},
		},
	}

	handler := NewOrderHandler(service.NewOrderService(repo, nil, zap.NewNop(), nil, paymentClient))
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	body, _ := json.Marshal(map[string]any{
		"message": "Queue refund in background",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/returns/return-1/refund", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleAdmin))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"status":"refund_pending"`)) {
		t.Fatalf("expected refund_pending return status, got %s", rec.Body.String())
	}
}

func TestAdminRequestReturnRefundRouteReturnsConflictWhenRefundIsInFlight(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	startedAt := time.Now()
	repo := &fakeOrderHandlerRepo{
		returnsByID: map[string]*model.ReturnRequest{
			"return-1": {
				ID:                      "return-1",
				OrderID:                 "order-1",
				UserID:                  "user-1",
				Status:                  model.ReturnStatusRefundPending,
				Reason:                  "Package arrived damaged",
				RefundAmount:            100,
				RefundChargePaymentID:   "payment-1",
				RefundProcessingStarted: &startedAt,
			},
		},
	}

	handler := NewOrderHandler(service.NewOrderService(repo, nil, zap.NewNop(), nil, nil))
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/returns/return-1/refund", http.NoBody)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleAdmin))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte("already queued")) {
		t.Fatalf("expected refund pending message, got %s", rec.Body.String())
	}
}

func TestListAdminReturnsRouteReturnsMeta(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	repo := &fakeOrderHandlerRepo{
		returnsByID: map[string]*model.ReturnRequest{
			"return-1": {
				ID:      "return-1",
				OrderID: "order-1",
				UserID:  "user-1",
				Status:  model.ReturnStatusRequested,
				Reason:  "Package arrived damaged",
			},
		},
	}

	handler := NewOrderHandler(service.NewOrderService(repo, nil, zap.NewNop(), nil, nil))
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/returns?page=1&limit=6&status=requested", http.NoBody)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleAdmin))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"total":1`)) {
		t.Fatalf("expected response meta with total=1, got %s", rec.Body.String())
	}
}

func TestListUserReturnsRouteReturnsMeta(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	repo := &fakeOrderHandlerRepo{
		returnsByID: map[string]*model.ReturnRequest{
			"return-1": {
				ID:        "return-1",
				OrderID:   "order-1",
				UserID:    "user-1",
				UserEmail: "user@example.com",
				Status:    model.ReturnStatusRequested,
				Reason:    "Package arrived damaged",
			},
			"return-2": {
				ID:      "return-2",
				OrderID: "order-2",
				UserID:  "user-2",
				Status:  model.ReturnStatusApproved,
				Reason:  "Wrong size",
			},
		},
	}

	handler := NewOrderHandler(service.NewOrderService(repo, nil, zap.NewNop(), nil, nil))
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/returns?page=1&limit=6&status=requested", http.NoBody)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"total":1`)) {
		t.Fatalf("expected response meta with total=1, got %s", rec.Body.String())
	}
	if bytes.Contains(rec.Body.Bytes(), []byte(`"return-2"`)) {
		t.Fatalf("expected other user returns to be excluded, got %s", rec.Body.String())
	}
}

func TestListUserReturnsRouteReturnsEmptyArrayWhenRepoIsEmpty(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	repo := &fakeOrderHandlerRepo{}

	handler := NewOrderHandler(service.NewOrderService(repo, nil, zap.NewNop(), nil, nil))
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/returns?page=1&limit=6", http.NoBody)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"data":[]`)) {
		t.Fatalf("expected empty array payload, got %s", rec.Body.String())
	}
}

func TestGetReturnQueueHealthRouteReturnsSnapshot(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	nextRetryAt := time.Now().Add(5 * time.Minute).UTC()
	longestInFlightStartedAt := time.Now().Add(-3 * time.Minute).UTC()
	repo := &fakeOrderHandlerRepo{
		queueHealth: &model.ReturnQueueHealth{
			PendingCount:             4,
			ReadyNowCount:            2,
			ReadyWithFailuresCount:   1,
			InFlightCount:            1,
			RetryScheduledCount:      1,
			FailedAttemptCount:       1,
			StaleInFlightCount:       1,
			MaxAttemptCount:          3,
			NextRetryAt:              &nextRetryAt,
			LongestInFlightStartedAt: &longestInFlightStartedAt,
			RecentFailures: []model.ReturnQueueFailure{
				{
					ReturnID:     "return-1",
					OrderID:      "order-1",
					UserID:       "user-1",
					LastError:    "gateway timeout",
					AttemptCount: 2,
					UpdatedAt:    time.Now().UTC(),
				},
			},
		},
	}

	handler := NewOrderHandler(service.NewOrderService(repo, nil, zap.NewNop(), nil, nil))
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/returns/health", http.NoBody)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleAdmin))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"pending_count":4`)) {
		t.Fatalf("expected pending_count=4, got %s", rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"ready_with_failures_count":1`)) {
		t.Fatalf("expected ready_with_failures_count=1, got %s", rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"stale_in_flight_count":1`)) {
		t.Fatalf("expected stale_in_flight_count=1, got %s", rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte("gateway timeout")) {
		t.Fatalf("expected recent failure payload, got %s", rec.Body.String())
	}
}

func TestGetReturnQueueHealthRouteReturnsEmptySnapshotWhenServiceReturnsNil(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()

	repo := &fakeOrderHandlerRepo{forceNilQueueHealth: true}

	handler := NewOrderHandler(service.NewOrderService(repo, nil, zap.NewNop(), nil, nil))
	secret := "super-secret-order-handler-key-1234567890"
	handler.RegisterRoutes(e, secret)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/returns/health", http.NoBody)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedOrderToken(t, secret, appmw.RoleAdmin))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"pending_count":0`)) {
		t.Fatalf("expected normalized empty health snapshot, got %s", rec.Body.String())
	}
}

func signedOrderToken(t *testing.T, secret string, role string) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, appmw.JWTClaims{
		UserID: "user-1",
		Email:  "user@example.com",
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})

	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return signed
}
