package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

func BenchmarkProductReviewServiceListReviewsColdPath(b *testing.B) {
	svc := benchmarkProductReviewService(false)
	query := dto.ListProductReviewsQuery{Page: 1, Limit: 10}
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, _, err := svc.ListReviews(ctx, "product-1", query); err != nil {
			b.Fatalf("ListReviews returned error: %v", err)
		}
	}
}

func BenchmarkProductReviewServiceListReviewsWarmCache(b *testing.B) {
	svc := benchmarkProductReviewService(true)
	query := dto.ListProductReviewsQuery{Page: 1, Limit: 10}
	ctx := context.Background()

	if _, _, err := svc.ListReviews(ctx, "product-1", query); err != nil {
		b.Fatalf("warm-up ListReviews returned error: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, _, err := svc.ListReviews(ctx, "product-1", query); err != nil {
			b.Fatalf("ListReviews returned error: %v", err)
		}
	}
}

func benchmarkProductReviewService(useCache bool) *ProductReviewService {
	repo := newFakeReviewServiceRepo()
	now := time.Date(2026, 4, 2, 8, 0, 0, 0, time.UTC)
	for index := 0; index < 100; index++ {
		repo.reviews[fmt.Sprintf("product-1::user-%d", index)] = &model.ProductReview{
			ID:          fmt.Sprintf("review-%03d", index),
			ProductID:   "product-1",
			UserID:      fmt.Sprintf("user-%d", index),
			AuthorLabel: "u***@example.com",
			Rating:      (index % 5) + 1,
			Comment:     "Benchmark review",
			CreatedAt:   now.Add(time.Duration(index) * time.Second),
			UpdatedAt:   now.Add(time.Duration(index) * time.Second),
		}
	}

	options := []ProductReviewServiceOption{}
	if useCache {
		options = append(options, WithProductReviewCache(&fakeProductReviewCache{}))
	}

	return NewProductReviewService(seededReviewLookup(), repo, options...)
}
