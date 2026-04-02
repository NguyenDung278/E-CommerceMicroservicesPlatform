package repository

import (
	"context"
	"database/sql"
	"fmt"
	"math"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

type ProductReviewRepository interface {
	CreateReview(ctx context.Context, review *model.ProductReview) error
	GetReviewByProductAndUser(ctx context.Context, productID, userID string) (*model.ProductReview, error)
	GetReviewByProductAndUserForUpdate(ctx context.Context, productID, userID string) (*model.ProductReview, error)
	UpdateReview(ctx context.Context, review *model.ProductReview) error
	DeleteReviewByProductAndUser(ctx context.Context, productID, userID string) (*model.ProductReview, error)
	ListReviewsByProduct(ctx context.Context, productID string, offset, limit int) ([]*model.ProductReview, error)
	GetReviewSummary(ctx context.Context, productID string) (*model.ProductReviewSummary, error)
	ApplyReviewSummaryDelta(ctx context.Context, productID string, delta model.ProductReviewSummaryDelta) error
}

type postgresProductReviewRepository struct {
	executor sqlExecutor
}

func NewProductReviewRepository(db *sql.DB) ProductReviewRepository {
	return newProductReviewRepositoryWithExecutor(db)
}

func newProductReviewRepositoryWithExecutor(executor sqlExecutor) ProductReviewRepository {
	return &postgresProductReviewRepository{executor: executor}
}

func (r *postgresProductReviewRepository) CreateReview(ctx context.Context, review *model.ProductReview) error {
	const query = `
		INSERT INTO product_reviews (
			id, product_id, user_id, author_label, rating, comment, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	if _, err := r.executor.ExecContext(ctx, query,
		review.ID,
		review.ProductID,
		review.UserID,
		review.AuthorLabel,
		review.Rating,
		review.Comment,
		review.CreatedAt,
		review.UpdatedAt,
	); err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return model.ErrProductReviewAlreadyExists
		}
		return fmt.Errorf("failed to create product review: %w", err)
	}

	return nil
}

func (r *postgresProductReviewRepository) GetReviewByProductAndUser(ctx context.Context, productID, userID string) (*model.ProductReview, error) {
	return r.getReviewByProductAndUser(ctx, productID, userID, false)
}

func (r *postgresProductReviewRepository) GetReviewByProductAndUserForUpdate(ctx context.Context, productID, userID string) (*model.ProductReview, error) {
	return r.getReviewByProductAndUser(ctx, productID, userID, true)
}

func (r *postgresProductReviewRepository) getReviewByProductAndUser(
	ctx context.Context,
	productID string,
	userID string,
	forUpdate bool,
) (*model.ProductReview, error) {
	query := `
		SELECT id, product_id, user_id, author_label, rating, comment, created_at, updated_at
		FROM product_reviews
		WHERE product_id = $1 AND user_id = $2
	`
	if forUpdate {
		query += "\n\t\tFOR UPDATE"
	}

	review, err := scanProductReviewRow(r.executor.QueryRowContext(ctx, query, productID, userID))
	if err == sql.ErrNoRows {
		return nil, model.ErrProductReviewNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get product review: %w", err)
	}

	return review, nil
}

func (r *postgresProductReviewRepository) UpdateReview(ctx context.Context, review *model.ProductReview) error {
	const query = `
		UPDATE product_reviews
		SET rating = $1, comment = $2, updated_at = $3
		WHERE id = $4
	`

	result, err := r.executor.ExecContext(ctx, query, review.Rating, review.Comment, review.UpdatedAt, review.ID)
	if err != nil {
		return fmt.Errorf("failed to update product review: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to inspect updated product review rows: %w", err)
	}
	if rowsAffected == 0 {
		return model.ErrProductReviewNotFound
	}

	return nil
}

func (r *postgresProductReviewRepository) DeleteReviewByProductAndUser(ctx context.Context, productID, userID string) (*model.ProductReview, error) {
	const query = `
		DELETE FROM product_reviews
		WHERE product_id = $1 AND user_id = $2
		RETURNING id, product_id, user_id, author_label, rating, comment, created_at, updated_at
	`

	review, err := scanProductReviewRow(r.executor.QueryRowContext(ctx, query, productID, userID))
	if err == sql.ErrNoRows {
		return nil, model.ErrProductReviewNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to delete product review: %w", err)
	}

	return review, nil
}

func (r *postgresProductReviewRepository) ListReviewsByProduct(ctx context.Context, productID string, offset, limit int) ([]*model.ProductReview, error) {
	const query = `
		SELECT id, product_id, user_id, author_label, rating, comment, created_at, updated_at
		FROM product_reviews
		WHERE product_id = $1
		ORDER BY created_at DESC, id DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.executor.QueryContext(ctx, query, productID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list product reviews: %w", err)
	}
	defer rows.Close()

	reviews := make([]*model.ProductReview, 0)
	for rows.Next() {
		review, scanErr := scanProductReviewRow(rows)
		if scanErr != nil {
			return nil, fmt.Errorf("failed to scan product review: %w", scanErr)
		}
		reviews = append(reviews, review)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate product reviews: %w", err)
	}

	return reviews, nil
}

func (r *postgresProductReviewRepository) GetReviewSummary(ctx context.Context, productID string) (*model.ProductReviewSummary, error) {
	const query = `
		SELECT review_count, rating_total, rating_one, rating_two, rating_three, rating_four, rating_five
		FROM product_review_summaries
		WHERE product_id = $1
	`

	var (
		reviewCount int64
		ratingTotal int64
		breakdown   model.ProductRatingBreakdown
	)
	if err := r.executor.QueryRowContext(ctx, query, productID).Scan(
		&reviewCount,
		&ratingTotal,
		&breakdown.One,
		&breakdown.Two,
		&breakdown.Three,
		&breakdown.Four,
		&breakdown.Five,
	); err != nil {
		if err == sql.ErrNoRows {
			return &model.ProductReviewSummary{}, nil
		}
		return nil, fmt.Errorf("failed to summarize product reviews: %w", err)
	}

	return &model.ProductReviewSummary{
		AverageRating:   averageRating(reviewCount, ratingTotal),
		ReviewCount:     reviewCount,
		RatingBreakdown: breakdown,
	}, nil
}

func (r *postgresProductReviewRepository) ApplyReviewSummaryDelta(
	ctx context.Context,
	productID string,
	delta model.ProductReviewSummaryDelta,
) error {
	if delta.ReviewCountDelta > 0 {
		return r.upsertReviewSummaryDelta(ctx, productID, delta)
	}

	const query = `
		UPDATE product_review_summaries
		SET review_count = review_count + $2,
		    rating_total = rating_total + $3,
		    rating_one = rating_one + $4,
		    rating_two = rating_two + $5,
		    rating_three = rating_three + $6,
		    rating_four = rating_four + $7,
		    rating_five = rating_five + $8,
		    updated_at = $9
		WHERE product_id = $1
	`

	result, err := r.executor.ExecContext(ctx, query,
		productID,
		delta.ReviewCountDelta,
		delta.RatingTotalDelta,
		delta.RatingBreakdown.One,
		delta.RatingBreakdown.Two,
		delta.RatingBreakdown.Three,
		delta.RatingBreakdown.Four,
		delta.RatingBreakdown.Five,
		delta.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to update product review summary: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to inspect updated product review summary rows: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("product review summary does not exist for product %s", productID)
	}

	return nil
}

func (r *postgresProductReviewRepository) upsertReviewSummaryDelta(
	ctx context.Context,
	productID string,
	delta model.ProductReviewSummaryDelta,
) error {
	const query = `
		INSERT INTO product_review_summaries (
			product_id, review_count, rating_total, rating_one, rating_two, rating_three, rating_four, rating_five, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (product_id) DO UPDATE
		SET review_count = product_review_summaries.review_count + EXCLUDED.review_count,
		    rating_total = product_review_summaries.rating_total + EXCLUDED.rating_total,
		    rating_one = product_review_summaries.rating_one + EXCLUDED.rating_one,
		    rating_two = product_review_summaries.rating_two + EXCLUDED.rating_two,
		    rating_three = product_review_summaries.rating_three + EXCLUDED.rating_three,
		    rating_four = product_review_summaries.rating_four + EXCLUDED.rating_four,
		    rating_five = product_review_summaries.rating_five + EXCLUDED.rating_five,
		    updated_at = EXCLUDED.updated_at
	`

	if _, err := r.executor.ExecContext(ctx, query,
		productID,
		delta.ReviewCountDelta,
		delta.RatingTotalDelta,
		delta.RatingBreakdown.One,
		delta.RatingBreakdown.Two,
		delta.RatingBreakdown.Three,
		delta.RatingBreakdown.Four,
		delta.RatingBreakdown.Five,
		delta.UpdatedAt,
	); err != nil {
		return fmt.Errorf("failed to upsert product review summary: %w", err)
	}

	return nil
}

type productReviewScanner interface {
	Scan(dest ...any) error
}

func scanProductReviewRow(scanner productReviewScanner) (*model.ProductReview, error) {
	review := &model.ProductReview{}

	if err := scanner.Scan(
		&review.ID,
		&review.ProductID,
		&review.UserID,
		&review.AuthorLabel,
		&review.Rating,
		&review.Comment,
		&review.CreatedAt,
		&review.UpdatedAt,
	); err != nil {
		return nil, err
	}

	return review, nil
}

func averageRating(reviewCount int64, ratingTotal int64) float64 {
	if reviewCount == 0 {
		return 0
	}

	average := float64(ratingTotal) / float64(reviewCount)
	return math.Round(average*10) / 10
}
