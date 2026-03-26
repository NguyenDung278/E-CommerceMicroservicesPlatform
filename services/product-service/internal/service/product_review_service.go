package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

var (
	ErrProductReviewNotFound      = errors.New("product review not found")
	ErrProductReviewAlreadyExists = errors.New("product review already exists")
)

func (s *ProductService) ListReviews(ctx context.Context, productID string, query dto.ListProductReviewsQuery) (*model.ProductReviewList, int64, error) {
	if _, err := s.GetByID(ctx, productID); err != nil {
		return nil, 0, err
	}

	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 || query.Limit > 50 {
		query.Limit = 10
	}

	offset := (query.Page - 1) * query.Limit
	reviews, total, err := s.repo.ListReviewsByProduct(ctx, productID, offset, query.Limit)
	if err != nil {
		return nil, 0, err
	}

	summary, err := s.repo.GetReviewSummary(ctx, productID)
	if err != nil {
		return nil, 0, err
	}

	return &model.ProductReviewList{
		Summary: *summary,
		Items:   reviews,
	}, total, nil
}

func (s *ProductService) GetReviewByProductAndUser(ctx context.Context, productID, userID string) (*model.ProductReview, error) {
	if _, err := s.GetByID(ctx, productID); err != nil {
		return nil, err
	}

	review, err := s.repo.GetReviewByProductAndUser(ctx, productID, userID)
	if err != nil {
		return nil, err
	}
	if review == nil {
		return nil, ErrProductReviewNotFound
	}

	return review, nil
}

func (s *ProductService) CreateReview(
	ctx context.Context,
	productID, userID, userEmail string,
	req dto.CreateProductReviewRequest,
) (*model.ProductReview, error) {
	if _, err := s.GetByID(ctx, productID); err != nil {
		return nil, err
	}

	existing, err := s.repo.GetReviewByProductAndUser(ctx, productID, userID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrProductReviewAlreadyExists
	}

	now := time.Now()
	review := &model.ProductReview{
		ID:          uuid.New().String(),
		ProductID:   productID,
		UserID:      userID,
		AuthorLabel: maskAuthorLabel(userEmail),
		Rating:      req.Rating,
		Comment:     strings.TrimSpace(req.Comment),
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.CreateReview(ctx, review); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate product review") {
			return nil, ErrProductReviewAlreadyExists
		}
		return nil, err
	}

	return review, nil
}

func (s *ProductService) UpdateReview(
	ctx context.Context,
	productID, userID string,
	req dto.UpdateProductReviewRequest,
) (*model.ProductReview, error) {
	review, err := s.GetReviewByProductAndUser(ctx, productID, userID)
	if err != nil {
		return nil, err
	}

	review.Rating = req.Rating
	review.Comment = strings.TrimSpace(req.Comment)
	review.UpdatedAt = time.Now()

	if err := s.repo.UpdateReview(ctx, review); err != nil {
		if errors.Is(err, ErrProductReviewNotFound) {
			return nil, ErrProductReviewNotFound
		}
		return nil, err
	}

	return review, nil
}

func (s *ProductService) DeleteReview(ctx context.Context, productID, userID string) error {
	if _, err := s.GetByID(ctx, productID); err != nil {
		return err
	}

	deleted, err := s.repo.DeleteReviewByProductAndUser(ctx, productID, userID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrProductReviewNotFound
	}

	return nil
}

func maskAuthorLabel(email string) string {
	normalized := strings.TrimSpace(strings.ToLower(email))
	if normalized == "" {
		return "Anonymous"
	}

	parts := strings.SplitN(normalized, "@", 2)
	localPart := parts[0]
	if len(parts) == 1 || localPart == "" {
		return "Anonymous"
	}

	domainPart := parts[1]
	maskedLocal := fmt.Sprintf("%c***", localPart[0])
	if domainPart == "" {
		return maskedLocal
	}

	return maskedLocal + "@" + domainPart
}
