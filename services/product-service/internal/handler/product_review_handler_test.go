package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
)

func TestCreateReviewRequiresAuthentication(t *testing.T) {
	e, _ := newReviewHandlerTestServer()

	body, _ := json.Marshal(dto.CreateProductReviewRequest{Rating: 5, Comment: "Excellent"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/products/product-1/reviews", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated review create, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestCreateReviewAllowsAuthenticatedUser(t *testing.T) {
	e, repo := newReviewHandlerTestServer()

	body, _ := json.Marshal(dto.CreateProductReviewRequest{Rating: 5, Comment: "Excellent craftsmanship"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/products/product-1/reviews", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedTokenForUser(t, reviewSecret, "user-1", "alice@example.com", middleware.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for authenticated review create, got %d body=%s", rec.Code, rec.Body.String())
	}

	review, err := repo.GetReviewByProductAndUser(req.Context(), "product-1", "user-1")
	if err != nil {
		t.Fatalf("unexpected error looking up created review: %v", err)
	}
	if review == nil || review.AuthorLabel != "a***@example.com" {
		t.Fatalf("expected masked author label, got %+v", review)
	}
}

func TestCreateReviewRejectsDuplicate(t *testing.T) {
	e, repo := newReviewHandlerTestServer()
	now := time.Now()
	_ = repo.CreateReview(nil, &model.ProductReview{
		ID:          "review-1",
		ProductID:   "product-1",
		UserID:      "user-1",
		AuthorLabel: "a***@example.com",
		Rating:      4,
		Comment:     "Already reviewed",
		CreatedAt:   now,
		UpdatedAt:   now,
	})

	body, _ := json.Marshal(dto.CreateProductReviewRequest{Rating: 5, Comment: "Trying again"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/products/product-1/reviews", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedTokenForUser(t, reviewSecret, "user-1", "alice@example.com", middleware.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409 for duplicate review, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGetMyReviewReturnsNotFoundWhenMissing(t *testing.T) {
	e, _ := newReviewHandlerTestServer()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/products/product-1/reviews/me", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedTokenForUser(t, reviewSecret, "user-1", "alice@example.com", middleware.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for missing own review, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestUpdateMyReviewDoesNotAllowOtherUsersReview(t *testing.T) {
	e, repo := newReviewHandlerTestServer()
	now := time.Now()
	_ = repo.CreateReview(nil, &model.ProductReview{
		ID:          "review-1",
		ProductID:   "product-1",
		UserID:      "user-1",
		AuthorLabel: "a***@example.com",
		Rating:      4,
		Comment:     "Already reviewed",
		CreatedAt:   now,
		UpdatedAt:   now,
	})

	body, _ := json.Marshal(dto.UpdateProductReviewRequest{Rating: 1, Comment: "Wrong owner"})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/products/product-1/reviews/me", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedTokenForUser(t, reviewSecret, "user-2", "bob@example.com", middleware.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when updating another user's review, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestDeleteMyReviewRemovesReview(t *testing.T) {
	e, repo := newReviewHandlerTestServer()
	now := time.Now()
	_ = repo.CreateReview(nil, &model.ProductReview{
		ID:          "review-1",
		ProductID:   "product-1",
		UserID:      "user-1",
		AuthorLabel: "a***@example.com",
		Rating:      4,
		Comment:     "Already reviewed",
		CreatedAt:   now,
		UpdatedAt:   now,
	})

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/products/product-1/reviews/me", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+signedTokenForUser(t, reviewSecret, "user-1", "alice@example.com", middleware.RoleUser))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 when deleting own review, got %d body=%s", rec.Code, rec.Body.String())
	}

	review, err := repo.GetReviewByProductAndUser(req.Context(), "product-1", "user-1")
	if err != nil {
		t.Fatalf("unexpected error looking up deleted review: %v", err)
	}
	if review != nil {
		t.Fatalf("expected review to be deleted, got %+v", review)
	}
}

const reviewSecret = "super-secret-test-key-1234567890"

func newReviewHandlerTestServer() (*echo.Echo, *fakeProductRepo) {
	e := echo.New()
	e.Validator = validation.New()

	repo := &fakeProductRepo{
		created: []*model.Product{
			{
				ID:          "product-1",
				Name:        "Reviewable Product",
				Description: "A product used for review tests",
				Price:       120,
				Stock:       10,
				Status:      "active",
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			},
		},
		reviews: make(map[string]*model.ProductReview),
	}

	productService := service.NewProductService(repo)
	NewProductHandler(productService).RegisterRoutes(e, reviewSecret)

	return e, repo
}
