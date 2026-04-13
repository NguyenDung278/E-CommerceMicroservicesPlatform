package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
	coupons map[string]*model.Coupon
}

func (r *fakeOrderHandlerRepo) Create(_ context.Context, _ *model.Order, _ *model.OutboxMessage) error {
	return nil
}

func (r *fakeOrderHandlerRepo) GetByID(_ context.Context, _ string) (*model.Order, error) {
	return nil, nil
}

func (r *fakeOrderHandlerRepo) GetByUserID(_ context.Context, _ string) ([]*model.Order, error) {
	return nil, nil
}

func (r *fakeOrderHandlerRepo) ListAll(_ context.Context, _ model.OrderFilters) ([]*model.Order, int64, error) {
	return nil, 0, nil
}

func (r *fakeOrderHandlerRepo) GetEventsByOrderID(_ context.Context, _ string) ([]*model.OrderEvent, error) {
	return nil, nil
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
