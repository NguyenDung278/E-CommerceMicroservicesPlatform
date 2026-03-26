package service

import (
	"context"
	"errors"
	"sort"
	"testing"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

func TestCreateReviewPreventsDuplicates(t *testing.T) {
	repo := seededReviewRepo()
	productService := NewProductService(repo)
	ctx := context.Background()

	if _, err := productService.CreateReview(ctx, "product-1", "user-1", "alice@example.com", dto.CreateProductReviewRequest{
		Rating:  5,
		Comment: "Excellent",
	}); err != nil {
		t.Fatalf("CreateReview returned error: %v", err)
	}

	_, err := productService.CreateReview(ctx, "product-1", "user-1", "alice@example.com", dto.CreateProductReviewRequest{
		Rating:  4,
		Comment: "Duplicate",
	})
	if !errors.Is(err, ErrProductReviewAlreadyExists) {
		t.Fatalf("expected ErrProductReviewAlreadyExists, got %v", err)
	}
}

func TestUpdateReviewRequiresOwnership(t *testing.T) {
	repo := seededReviewRepo()
	now := time.Now()
	_ = repo.CreateReview(context.Background(), &model.ProductReview{
		ID:          "review-1",
		ProductID:   "product-1",
		UserID:      "user-1",
		AuthorLabel: "a***@example.com",
		Rating:      4,
		Comment:     "Initial",
		CreatedAt:   now,
		UpdatedAt:   now,
	})

	productService := NewProductService(repo)
	_, err := productService.UpdateReview(context.Background(), "product-1", "user-2", dto.UpdateProductReviewRequest{
		Rating:  1,
		Comment: "Should fail",
	})
	if !errors.Is(err, ErrProductReviewNotFound) {
		t.Fatalf("expected ErrProductReviewNotFound, got %v", err)
	}
}

func TestDeleteReviewRequiresOwnership(t *testing.T) {
	repo := seededReviewRepo()
	now := time.Now()
	_ = repo.CreateReview(context.Background(), &model.ProductReview{
		ID:          "review-1",
		ProductID:   "product-1",
		UserID:      "user-1",
		AuthorLabel: "a***@example.com",
		Rating:      4,
		Comment:     "Initial",
		CreatedAt:   now,
		UpdatedAt:   now,
	})

	productService := NewProductService(repo)
	err := productService.DeleteReview(context.Background(), "product-1", "user-2")
	if !errors.Is(err, ErrProductReviewNotFound) {
		t.Fatalf("expected ErrProductReviewNotFound, got %v", err)
	}
}

func TestListReviewsReturnsSummary(t *testing.T) {
	repo := seededReviewRepo()
	now := time.Now()
	_ = repo.CreateReview(context.Background(), &model.ProductReview{
		ID:          "review-1",
		ProductID:   "product-1",
		UserID:      "user-1",
		AuthorLabel: "a***@example.com",
		Rating:      5,
		Comment:     "Excellent",
		CreatedAt:   now,
		UpdatedAt:   now,
	})
	_ = repo.CreateReview(context.Background(), &model.ProductReview{
		ID:          "review-2",
		ProductID:   "product-1",
		UserID:      "user-2",
		AuthorLabel: "b***@example.com",
		Rating:      3,
		Comment:     "Average",
		CreatedAt:   now.Add(time.Minute),
		UpdatedAt:   now.Add(time.Minute),
	})

	productService := NewProductService(repo)
	reviews, total, err := productService.ListReviews(context.Background(), "product-1", dto.ListProductReviewsQuery{
		Page:  1,
		Limit: 10,
	})
	if err != nil {
		t.Fatalf("ListReviews returned error: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected total 2, got %d", total)
	}
	if reviews.Summary.ReviewCount != 2 {
		t.Fatalf("expected review count 2, got %+v", reviews.Summary)
	}
	if reviews.Summary.AverageRating != 4 {
		t.Fatalf("expected average rating 4.0, got %+v", reviews.Summary)
	}
	if reviews.Summary.RatingBreakdown.Five != 1 || reviews.Summary.RatingBreakdown.Three != 1 {
		t.Fatalf("unexpected rating breakdown: %+v", reviews.Summary.RatingBreakdown)
	}
	if len(reviews.Items) != 2 || reviews.Items[0].ID != "review-2" {
		t.Fatalf("expected latest review first, got %+v", reviews.Items)
	}
}

func seededReviewRepo() *fakeReviewServiceRepo {
	return &fakeReviewServiceRepo{
		products: map[string]*model.Product{
			"product-1": {
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
}

type fakeReviewServiceRepo struct {
	products map[string]*model.Product
	reviews  map[string]*model.ProductReview
}

func (r *fakeReviewServiceRepo) Create(_ context.Context, product *model.Product) error {
	if r.products == nil {
		r.products = make(map[string]*model.Product)
	}
	copyProduct := *product
	r.products[product.ID] = &copyProduct
	return nil
}

func (r *fakeReviewServiceRepo) GetByID(_ context.Context, id string) (*model.Product, error) {
	product, ok := r.products[id]
	if !ok {
		return nil, nil
	}
	copyProduct := *product
	return &copyProduct, nil
}

func (r *fakeReviewServiceRepo) Update(_ context.Context, product *model.Product) error {
	return r.Create(context.Background(), product)
}

func (r *fakeReviewServiceRepo) Delete(_ context.Context, id string) error {
	delete(r.products, id)
	return nil
}

func (r *fakeReviewServiceRepo) List(_ context.Context, offset, limit int, category, brand, tag, status, search string, minPrice, maxPrice float64, size, color, sortBy string) ([]*model.Product, int64, error) {
	return []*model.Product{}, 0, nil
}

func (r *fakeReviewServiceRepo) ListByIDs(_ context.Context, ids []string) ([]*model.Product, error) {
	return []*model.Product{}, nil
}

func (r *fakeReviewServiceRepo) ListForSearchIndex(_ context.Context) ([]*model.Product, error) {
	return []*model.Product{}, nil
}

func (r *fakeReviewServiceRepo) UpdateStock(_ context.Context, id string, quantity int) error {
	return nil
}

func (r *fakeReviewServiceRepo) RestoreStock(_ context.Context, id string, quantity int) error {
	return nil
}

func (r *fakeReviewServiceRepo) ListLowStock(_ context.Context, threshold int) ([]*model.Product, error) {
	return []*model.Product{}, nil
}

func (r *fakeReviewServiceRepo) CreateReview(_ context.Context, review *model.ProductReview) error {
	key := review.ProductID + "::" + review.UserID
	if _, exists := r.reviews[key]; exists {
		return ErrProductReviewAlreadyExists
	}
	copyReview := *review
	r.reviews[key] = &copyReview
	return nil
}

func (r *fakeReviewServiceRepo) GetReviewByProductAndUser(_ context.Context, productID, userID string) (*model.ProductReview, error) {
	review, ok := r.reviews[productID+"::"+userID]
	if !ok {
		return nil, nil
	}
	copyReview := *review
	return &copyReview, nil
}

func (r *fakeReviewServiceRepo) UpdateReview(_ context.Context, review *model.ProductReview) error {
	key := review.ProductID + "::" + review.UserID
	copyReview := *review
	r.reviews[key] = &copyReview
	return nil
}

func (r *fakeReviewServiceRepo) DeleteReviewByProductAndUser(_ context.Context, productID, userID string) (bool, error) {
	key := productID + "::" + userID
	if _, exists := r.reviews[key]; !exists {
		return false, nil
	}
	delete(r.reviews, key)
	return true, nil
}

func (r *fakeReviewServiceRepo) ListReviewsByProduct(_ context.Context, productID string, offset, limit int) ([]*model.ProductReview, int64, error) {
	items := make([]*model.ProductReview, 0)
	for _, review := range r.reviews {
		if review.ProductID != productID {
			continue
		}
		copyReview := *review
		items = append(items, &copyReview)
	}

	sort.Slice(items, func(left, right int) bool {
		return items[left].CreatedAt.After(items[right].CreatedAt)
	})

	total := int64(len(items))
	if offset >= len(items) {
		return []*model.ProductReview{}, total, nil
	}

	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	return items[offset:end], total, nil
}

func (r *fakeReviewServiceRepo) GetReviewSummary(_ context.Context, productID string) (*model.ProductReviewSummary, error) {
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
