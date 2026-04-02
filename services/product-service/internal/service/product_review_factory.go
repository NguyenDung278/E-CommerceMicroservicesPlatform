package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

type ProductReviewFactory struct {
	now   func() time.Time
	newID func() string
}

func NewProductReviewFactory() ProductReviewFactory {
	return ProductReviewFactory{
		now:   time.Now,
		newID: func() string { return uuid.New().String() },
	}
}

func (f ProductReviewFactory) New(
	productID string,
	userID string,
	userEmail string,
	req dto.CreateProductReviewRequest,
) *model.ProductReview {
	now := f.now()

	return &model.ProductReview{
		ID:          f.newID(),
		ProductID:   productID,
		UserID:      userID,
		AuthorLabel: maskAuthorLabel(userEmail),
		Rating:      req.Rating,
		Comment:     normalizeProductReviewComment(req.Comment),
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

func (f ProductReviewFactory) Update(review *model.ProductReview, req dto.UpdateProductReviewRequest) *model.ProductReview {
	review.Rating = req.Rating
	review.Comment = normalizeProductReviewComment(req.Comment)
	review.UpdatedAt = f.now()

	return review
}

func cloneProductReview(review *model.ProductReview) *model.ProductReview {
	if review == nil {
		return nil
	}

	copied := *review
	return &copied
}

func normalizeProductReviewComment(comment string) string {
	return strings.TrimSpace(comment)
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
