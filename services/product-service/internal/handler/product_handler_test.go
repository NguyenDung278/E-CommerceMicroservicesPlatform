package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"sort"
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
	reviews map[string]*model.ProductReview
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
func (r *fakeProductRepo) List(_ context.Context, params repository.ListProductsParams) ([]*model.Product, string, bool, error) {
	products := make([]*model.Product, len(r.created))
	copy(products, r.created)

	sort.Slice(products, func(left, right int) bool {
		if products[left].CreatedAt.Equal(products[right].CreatedAt) {
			return products[left].ID > products[right].ID
		}
		return products[left].CreatedAt.After(products[right].CreatedAt)
	})

	start := 0
	if params.Cursor != "" {
		for idx, product := range products {
			if product.ID == params.Cursor {
				start = idx + 1
				break
			}
		}
	}

	end := int(math.Min(float64(start+params.Limit), float64(len(products))))
	if start > len(products) {
		return []*model.Product{}, "", false, nil
	}

	nextCursor := ""
	hasNext := end < len(products)
	if hasNext {
		nextCursor = products[end-1].ID
	}

	return products[start:end], nextCursor, hasNext, nil
}
func (r *fakeProductRepo) ListByIDs(_ context.Context, ids []string) ([]*model.Product, error) {
	return []*model.Product{}, nil
}
func (r *fakeProductRepo) ListForSearchIndex(_ context.Context) ([]*model.Product, error) {
	return []*model.Product{}, nil
}
func (r *fakeProductRepo) UpdateStock(_ context.Context, id string, quantity int) error  { return nil }
func (r *fakeProductRepo) RestoreStock(_ context.Context, id string, quantity int) error { return nil }
func (r *fakeProductRepo) ListLowStock(_ context.Context, threshold int) ([]*model.Product, error) {
	return []*model.Product{}, nil
}

func (r *fakeProductRepo) CreateReview(_ context.Context, review *model.ProductReview) error {
	if r.reviews == nil {
		r.reviews = make(map[string]*model.ProductReview)
	}
	key := fakeReviewKey(review.ProductID, review.UserID)
	if _, exists := r.reviews[key]; exists {
		return fmt.Errorf("duplicate product review")
	}
	copyReview := *review
	r.reviews[key] = &copyReview
	return nil
}

func (r *fakeProductRepo) GetReviewByProductAndUser(_ context.Context, productID, userID string) (*model.ProductReview, error) {
	if r.reviews == nil {
		return nil, nil
	}
	review, ok := r.reviews[fakeReviewKey(productID, userID)]
	if !ok {
		return nil, nil
	}
	copyReview := *review
	return &copyReview, nil
}

func (r *fakeProductRepo) UpdateReview(_ context.Context, review *model.ProductReview) error {
	if r.reviews == nil {
		r.reviews = make(map[string]*model.ProductReview)
	}
	key := fakeReviewKey(review.ProductID, review.UserID)
	copyReview := *review
	r.reviews[key] = &copyReview
	return nil
}

func (r *fakeProductRepo) DeleteReviewByProductAndUser(_ context.Context, productID, userID string) (bool, error) {
	if r.reviews == nil {
		return false, nil
	}
	key := fakeReviewKey(productID, userID)
	if _, exists := r.reviews[key]; !exists {
		return false, nil
	}
	delete(r.reviews, key)
	return true, nil
}

func (r *fakeProductRepo) ListReviewsByProduct(_ context.Context, productID string, offset, limit int) ([]*model.ProductReview, int64, error) {
	reviews := make([]*model.ProductReview, 0)
	for _, review := range r.reviews {
		if review.ProductID != productID {
			continue
		}
		copyReview := *review
		reviews = append(reviews, &copyReview)
	}

	sort.Slice(reviews, func(left, right int) bool {
		if reviews[left].CreatedAt.Equal(reviews[right].CreatedAt) {
			return reviews[left].ID > reviews[right].ID
		}
		return reviews[left].CreatedAt.After(reviews[right].CreatedAt)
	})

	total := int64(len(reviews))
	if offset >= len(reviews) {
		return []*model.ProductReview{}, total, nil
	}

	end := offset + limit
	if end > len(reviews) {
		end = len(reviews)
	}

	return reviews[offset:end], total, nil
}

func (r *fakeProductRepo) GetReviewSummary(_ context.Context, productID string) (*model.ProductReviewSummary, error) {
	summary := &model.ProductReviewSummary{}
	for _, review := range r.reviews {
		if review.ProductID != productID {
			continue
		}
		summary.ReviewCount++
		summary.AverageRating += float64(review.Rating)

		switch review.Rating {
		case 1:
			summary.RatingBreakdown.One++
		case 2:
			summary.RatingBreakdown.Two++
		case 3:
			summary.RatingBreakdown.Three++
		case 4:
			summary.RatingBreakdown.Four++
		case 5:
			summary.RatingBreakdown.Five++
		}
	}

	if summary.ReviewCount > 0 {
		summary.AverageRating = summary.AverageRating / float64(summary.ReviewCount)
	}

	return summary, nil
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

func TestListReturnsCursorMetadata(t *testing.T) {
	e := echo.New()
	e.Validator = validation.New()
	repo := &fakeProductRepo{created: []*model.Product{
		{ID: "p1", Name: "One", CreatedAt: time.Date(2025, 1, 3, 12, 0, 0, 0, time.UTC)},
		{ID: "p2", Name: "Two", CreatedAt: time.Date(2025, 1, 2, 12, 0, 0, 0, time.UTC)},
		{ID: "p3", Name: "Three", CreatedAt: time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)},
	}}
	productService := service.NewProductService(repo)
	handler := NewProductHandler(productService)
	handler.RegisterRoutes(e, "unused-secret")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/products?limit=2", nil)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Meta    struct {
			Limit      int    `json:"limit"`
			NextCursor string `json:"next_cursor"`
			HasNext    bool   `json:"has_next"`
		} `json:"meta"`
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(payload.Data) != 2 {
		t.Fatalf("expected 2 products, got %d", len(payload.Data))
	}
	if payload.Meta.Limit != 2 {
		t.Fatalf("expected limit=2, got %d", payload.Meta.Limit)
	}
	if !payload.Meta.HasNext {
		t.Fatalf("expected has_next=true")
	}
	if payload.Meta.NextCursor != "p2" {
		t.Fatalf("expected next cursor p2, got %q", payload.Meta.NextCursor)
	}
	if payload.Data[0].ID != "p1" || payload.Data[1].ID != "p2" {
		t.Fatalf("unexpected product order: %+v", payload.Data)
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
	return signedTokenForUser(t, secret, "user-1", "test@example.com", role)
}

func signedTokenForUser(t *testing.T, secret, userID, email, role string) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, appmw.JWTClaims{
		UserID: userID,
		Email:  email,
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

func fakeReviewKey(productID, userID string) string {
	return productID + "::" + userID
}
