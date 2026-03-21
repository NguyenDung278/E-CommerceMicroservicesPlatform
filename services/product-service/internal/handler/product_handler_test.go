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
	"testing"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"

	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
)

type fakeProductRepo struct {
	created []*model.Product
}

type fakeMediaStore struct{}

func (r *fakeProductRepo) Create(_ context.Context, product *model.Product) error {
	r.created = append(r.created, product)
	return nil
}

func (r *fakeProductRepo) GetByID(_ context.Context, id string) (*model.Product, error) {
	for _, product := range r.created {
		if product.ID == id {
			return product, nil
		}
	}
	return nil, nil
}

func (r *fakeProductRepo) Update(_ context.Context, product *model.Product) error { return nil }
func (r *fakeProductRepo) Delete(_ context.Context, id string) error              { return nil }
func (r *fakeProductRepo) List(_ context.Context, offset, limit int, category, brand, tag, status, search string) ([]*model.Product, int64, error) {
	return []*model.Product{}, 0, nil
}
func (r *fakeProductRepo) UpdateStock(_ context.Context, id string, quantity int) error  { return nil }
func (r *fakeProductRepo) RestoreStock(_ context.Context, id string, quantity int) error { return nil }
func (r *fakeProductRepo) ListLowStock(_ context.Context, threshold int) ([]*model.Product, error) {
	return []*model.Product{}, nil
}

var _ repository.ProductRepository = (*fakeProductRepo)(nil)

func (s *fakeMediaStore) EnsureBucket(_ context.Context) error { return nil }

func (s *fakeMediaStore) Upload(_ context.Context, objectKey string, reader io.Reader, size int64, contentType string) (string, error) {
	return "https://cdn.example.com/" + objectKey, nil
}

func TestCreateRequiresAdminRole(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()
	repo := &fakeProductRepo{}
	productService := service.NewProductService(repo)
	handler := NewProductHandler(productService)
	secret := "super-secret-test-key-1234567890"
	handler.RegisterRoutes(e, secret)

	body, _ := json.Marshal(dto.CreateProductRequest{
		Name:  "Laptop",
		Price: 1999,
		Stock: 5,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedToken(t, secret, appmw.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-admin, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestCreateAllowsAdminRole(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()
	repo := &fakeProductRepo{}
	productService := service.NewProductService(repo)
	handler := NewProductHandler(productService)
	secret := "super-secret-test-key-1234567890"
	handler.RegisterRoutes(e, secret)

	body, _ := json.Marshal(dto.CreateProductRequest{
		Name:  "Laptop",
		Price: 1999,
		Stock: 5,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedToken(t, secret, appmw.RoleAdmin))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for admin, got %d body=%s", rec.Code, rec.Body.String())
	}
	if len(repo.created) != 1 {
		t.Fatalf("expected product to be created, got %d", len(repo.created))
	}
}

func TestCreateAllowsStaffRole(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()
	repo := &fakeProductRepo{}
	productService := service.NewProductService(repo)
	handler := NewProductHandler(productService)
	secret := "super-secret-test-key-1234567890"
	handler.RegisterRoutes(e, secret)

	body, _ := json.Marshal(dto.CreateProductRequest{
		Name:  "Laptop",
		Price: 1999,
		Stock: 5,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedToken(t, secret, appmw.RoleStaff))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for staff, got %d body=%s", rec.Code, rec.Body.String())
	}
	if len(repo.created) != 1 {
		t.Fatalf("expected product to be created, got %d", len(repo.created))
	}
}

func TestUploadAllowsStaffRole(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()
	repo := &fakeProductRepo{}
	productService := service.NewProductService(repo, service.WithMediaStore(&fakeMediaStore{}))
	handler := NewProductHandler(productService)
	secret := "super-secret-test-key-1234567890"
	handler.RegisterRoutes(e, secret)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", `form-data; name="images"; filename="sample.png"`)
	header.Set("Content-Type", "image/png")
	part, err := writer.CreatePart(header)
	if err != nil {
		t.Fatalf("failed to create multipart part: %v", err)
	}
	if _, err := part.Write([]byte("fake-image-bytes")); err != nil {
		t.Fatalf("failed to write multipart body: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/products/uploads", &body)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedToken(t, secret, appmw.RoleStaff))
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for upload, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func signedToken(t *testing.T, secret string, role string) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, appmw.JWTClaims{
		UserID: "user-1",
		Email:  "test@example.com",
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
