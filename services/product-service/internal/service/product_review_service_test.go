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
	lookup := seededReviewLookup()
	repo := newFakeReviewServiceRepo()
	svc := NewProductReviewService(lookup, repo, WithProductReviewTxManager(fakeProductReviewTxManager{repo: repo}))
	ctx := context.Background()

	if _, err := svc.CreateReview(ctx, "product-1", "user-1", "alice@example.com", dto.CreateProductReviewRequest{
		Rating:  5,
		Comment: "Excellent",
	}); err != nil {
		t.Fatalf("CreateReview returned error: %v", err)
	}

	_, err := svc.CreateReview(ctx, "product-1", "user-1", "alice@example.com", dto.CreateProductReviewRequest{
		Rating:  4,
		Comment: "Duplicate",
	})
	if !errors.Is(err, ErrProductReviewAlreadyExists) {
		t.Fatalf("expected ErrProductReviewAlreadyExists, got %v", err)
	}
}

func TestCreateReviewNormalizesCommentAndMasksAuthor(t *testing.T) {
	lookup := seededReviewLookup()
	repo := newFakeReviewServiceRepo()
	factory := ProductReviewFactory{
		now:   func() time.Time { return time.Date(2026, 4, 2, 10, 0, 0, 0, time.UTC) },
		newID: func() string { return "review-1" },
	}
	svc := NewProductReviewService(
		lookup,
		repo,
		WithProductReviewTxManager(fakeProductReviewTxManager{repo: repo}),
		WithProductReviewFactory(factory),
	)

	review, err := svc.CreateReview(context.Background(), "product-1", "user-1", "Alice@example.com ", dto.CreateProductReviewRequest{
		Rating:  5,
		Comment: "  Excellent craftsmanship  ",
	})
	if err != nil {
		t.Fatalf("CreateReview returned error: %v", err)
	}

	if review.ID != "review-1" {
		t.Fatalf("expected factory-generated review id, got %q", review.ID)
	}
	if review.Comment != "Excellent craftsmanship" {
		t.Fatalf("expected trimmed comment, got %q", review.Comment)
	}
	if review.AuthorLabel != "a***@example.com" {
		t.Fatalf("expected masked author label, got %q", review.AuthorLabel)
	}
}

func TestUpdateReviewRequiresOwnership(t *testing.T) {
	repo := newFakeReviewServiceRepo()
	now := time.Now()
	repo.reviews["product-1::user-1"] = &model.ProductReview{
		ID:          "review-1",
		ProductID:   "product-1",
		UserID:      "user-1",
		AuthorLabel: "a***@example.com",
		Rating:      4,
		Comment:     "Initial",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	svc := NewProductReviewService(seededReviewLookup(), repo, WithProductReviewTxManager(fakeProductReviewTxManager{repo: repo}))
	_, err := svc.UpdateReview(context.Background(), "product-1", "user-2", dto.UpdateProductReviewRequest{
		Rating:  1,
		Comment: "Should fail",
	})
	if !errors.Is(err, ErrProductReviewNotFound) {
		t.Fatalf("expected ErrProductReviewNotFound, got %v", err)
	}
}

func TestDeleteReviewRequiresOwnership(t *testing.T) {
	repo := newFakeReviewServiceRepo()
	now := time.Now()
	repo.reviews["product-1::user-1"] = &model.ProductReview{
		ID:          "review-1",
		ProductID:   "product-1",
		UserID:      "user-1",
		AuthorLabel: "a***@example.com",
		Rating:      4,
		Comment:     "Initial",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	svc := NewProductReviewService(seededReviewLookup(), repo, WithProductReviewTxManager(fakeProductReviewTxManager{repo: repo}))
	err := svc.DeleteReview(context.Background(), "product-1", "user-2")
	if !errors.Is(err, ErrProductReviewNotFound) {
		t.Fatalf("expected ErrProductReviewNotFound, got %v", err)
	}
}

func TestListReviewsReturnsSummary(t *testing.T) {
	repo := newFakeReviewServiceRepo()
	now := time.Now()
	repo.reviews["product-1::user-1"] = &model.ProductReview{
		ID:          "review-1",
		ProductID:   "product-1",
		UserID:      "user-1",
		AuthorLabel: "a***@example.com",
		Rating:      5,
		Comment:     "Excellent",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	repo.reviews["product-1::user-2"] = &model.ProductReview{
		ID:          "review-2",
		ProductID:   "product-1",
		UserID:      "user-2",
		AuthorLabel: "b***@example.com",
		Rating:      3,
		Comment:     "Average",
		CreatedAt:   now.Add(time.Minute),
		UpdatedAt:   now.Add(time.Minute),
	}

	svc := NewProductReviewService(seededReviewLookup(), repo)
	reviews, total, err := svc.ListReviews(context.Background(), "product-1", dto.ListProductReviewsQuery{
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

func TestListReviewsFallsBackWhenCacheFails(t *testing.T) {
	repo := newFakeReviewServiceRepo()
	now := time.Now()
	repo.reviews["product-1::user-1"] = &model.ProductReview{
		ID:          "review-1",
		ProductID:   "product-1",
		UserID:      "user-1",
		AuthorLabel: "a***@example.com",
		Rating:      5,
		Comment:     "Excellent",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	cache := &fakeProductReviewCache{
		summaryErr:   errors.New("redis down"),
		firstPageErr: errors.New("redis down"),
	}
	svc := NewProductReviewService(seededReviewLookup(), repo, WithProductReviewCache(cache))

	reviews, total, err := svc.ListReviews(context.Background(), "product-1", dto.ListProductReviewsQuery{
		Page:  1,
		Limit: 10,
	})
	if err != nil {
		t.Fatalf("ListReviews returned error: %v", err)
	}
	if total != 1 || len(reviews.Items) != 1 {
		t.Fatalf("expected DB fallback results, got total=%d items=%d", total, len(reviews.Items))
	}
}

func seededReviewLookup() ProductLookup {
	return fakeProductLookup{
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
	}
}

type fakeProductLookup struct {
	products map[string]*model.Product
}

func (f fakeProductLookup) GetByID(_ context.Context, id string) (*model.Product, error) {
	product, ok := f.products[id]
	if !ok {
		return nil, ErrProductNotFound
	}

	copyProduct := *product
	return &copyProduct, nil
}

type fakeProductReviewTxManager struct {
	repo ProductReviewRepository
}

func (m fakeProductReviewTxManager) RunInTx(ctx context.Context, fn func(ProductReviewTxRepositories) error) error {
	return fn(ProductReviewTxRepositories{Reviews: m.repo})
}

type fakeProductReviewCache struct {
	summary      *model.ProductReviewSummary
	summaryHit   bool
	summaryErr   error
	firstPage    []*model.ProductReview
	firstPageHit bool
	firstPageErr error
}

func (c *fakeProductReviewCache) GetSummary(_ context.Context, _ string) (*model.ProductReviewSummary, bool, error) {
	if c.summaryErr != nil {
		return nil, false, c.summaryErr
	}
	if !c.summaryHit {
		return nil, false, nil
	}

	return c.summary, true, nil
}

func (c *fakeProductReviewCache) SetSummary(_ context.Context, _ string, summary *model.ProductReviewSummary) error {
	c.summary = summary
	c.summaryHit = true
	return nil
}

func (c *fakeProductReviewCache) GetFirstPage(_ context.Context, _ string, _ int) ([]*model.ProductReview, bool, error) {
	if c.firstPageErr != nil {
		return nil, false, c.firstPageErr
	}
	if !c.firstPageHit {
		return nil, false, nil
	}

	return c.firstPage, true, nil
}

func (c *fakeProductReviewCache) SetFirstPage(_ context.Context, _ string, _ int, reviews []*model.ProductReview) error {
	c.firstPage = reviews
	c.firstPageHit = true
	return nil
}

func (c *fakeProductReviewCache) Invalidate(_ context.Context, _ string) error {
	c.summary = nil
	c.summaryHit = false
	c.firstPage = nil
	c.firstPageHit = false
	return nil
}

type fakeReviewServiceRepo struct {
	reviews map[string]*model.ProductReview
}

func newFakeReviewServiceRepo() *fakeReviewServiceRepo {
	return &fakeReviewServiceRepo{
		reviews: make(map[string]*model.ProductReview),
	}
}

func (r *fakeReviewServiceRepo) CreateReview(_ context.Context, review *model.ProductReview) error {
	key := review.ProductID + "::" + review.UserID
	if _, exists := r.reviews[key]; exists {
		return model.ErrProductReviewAlreadyExists
	}
	copyReview := *review
	r.reviews[key] = &copyReview
	return nil
}

func (r *fakeReviewServiceRepo) GetReviewByProductAndUser(_ context.Context, productID, userID string) (*model.ProductReview, error) {
	review, ok := r.reviews[productID+"::"+userID]
	if !ok {
		return nil, model.ErrProductReviewNotFound
	}
	copyReview := *review
	return &copyReview, nil
}

func (r *fakeReviewServiceRepo) GetReviewByProductAndUserForUpdate(ctx context.Context, productID, userID string) (*model.ProductReview, error) {
	return r.GetReviewByProductAndUser(ctx, productID, userID)
}

func (r *fakeReviewServiceRepo) UpdateReview(_ context.Context, review *model.ProductReview) error {
	key := review.ProductID + "::" + review.UserID
	if _, exists := r.reviews[key]; !exists {
		return model.ErrProductReviewNotFound
	}
	copyReview := *review
	r.reviews[key] = &copyReview
	return nil
}

func (r *fakeReviewServiceRepo) DeleteReviewByProductAndUser(_ context.Context, productID, userID string) (*model.ProductReview, error) {
	key := productID + "::" + userID
	review, exists := r.reviews[key]
	if !exists {
		return nil, model.ErrProductReviewNotFound
	}
	delete(r.reviews, key)
	copyReview := *review
	return &copyReview, nil
}

func (r *fakeReviewServiceRepo) ListReviewsByProduct(_ context.Context, productID string, offset, limit int) ([]*model.ProductReview, error) {
	items := make([]*model.ProductReview, 0)
	for _, review := range r.reviews {
		if review.ProductID != productID {
			continue
		}
		copyReview := *review
		items = append(items, &copyReview)
	}

	sort.Slice(items, func(left, right int) bool {
		if items[left].CreatedAt.Equal(items[right].CreatedAt) {
			return items[left].ID > items[right].ID
		}
		return items[left].CreatedAt.After(items[right].CreatedAt)
	})

	if offset >= len(items) {
		return []*model.ProductReview{}, nil
	}

	end := offset + limit
	if end > len(items) {
		end = len(items)
	}

	return items[offset:end], nil
}

func (r *fakeReviewServiceRepo) GetReviewSummary(_ context.Context, productID string) (*model.ProductReviewSummary, error) {
	summary := &model.ProductReviewSummary{}
	ratingTotal := 0
	for _, review := range r.reviews {
		if review.ProductID != productID {
			continue
		}
		summary.ReviewCount++
		ratingTotal += review.Rating

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
		summary.AverageRating = float64(ratingTotal) / float64(summary.ReviewCount)
	}

	return summary, nil
}

func (r *fakeReviewServiceRepo) ApplyReviewSummaryDelta(_ context.Context, _ string, _ model.ProductReviewSummaryDelta) error {
	return nil
}
