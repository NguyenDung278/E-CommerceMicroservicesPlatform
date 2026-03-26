package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

func (r *postgresProductRepository) CreateReview(ctx context.Context, review *model.ProductReview) error {
	const query = `
		INSERT INTO product_reviews (
			id, product_id, user_id, author_label, rating, comment, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	if _, err := r.db.ExecContext(ctx, query,
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
			return fmt.Errorf("duplicate product review: %w", err)
		}
		return fmt.Errorf("failed to create product review: %w", err)
	}

	return nil
}

func (r *postgresProductRepository) GetReviewByProductAndUser(ctx context.Context, productID, userID string) (*model.ProductReview, error) {
	const query = `
		SELECT id, product_id, user_id, author_label, rating, comment, created_at, updated_at
		FROM product_reviews
		WHERE product_id = $1 AND user_id = $2
	`

	review, err := scanProductReviewRow(r.db.QueryRowContext(ctx, query, productID, userID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get product review: %w", err)
	}

	return review, nil
}

func (r *postgresProductRepository) UpdateReview(ctx context.Context, review *model.ProductReview) error {
	const query = `
		UPDATE product_reviews
		SET rating = $1, comment = $2, updated_at = $3
		WHERE id = $4
	`

	result, err := r.db.ExecContext(ctx, query, review.Rating, review.Comment, review.UpdatedAt, review.ID)
	if err != nil {
		return fmt.Errorf("failed to update product review: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to inspect updated product review rows: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *postgresProductRepository) DeleteReviewByProductAndUser(ctx context.Context, productID, userID string) (bool, error) {
	const query = `
		DELETE FROM product_reviews
		WHERE product_id = $1 AND user_id = $2
	`

	result, err := r.db.ExecContext(ctx, query, productID, userID)
	if err != nil {
		return false, fmt.Errorf("failed to delete product review: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("failed to inspect deleted product review rows: %w", err)
	}

	return rowsAffected > 0, nil
}

func (r *postgresProductRepository) ListReviewsByProduct(ctx context.Context, productID string, offset, limit int) ([]*model.ProductReview, int64, error) {
	const countQuery = `
		SELECT COUNT(*)
		FROM product_reviews
		WHERE product_id = $1
	`

	var total int64
	if err := r.db.QueryRowContext(ctx, countQuery, productID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count product reviews: %w", err)
	}

	const listQuery = `
		SELECT id, product_id, user_id, author_label, rating, comment, created_at, updated_at
		FROM product_reviews
		WHERE product_id = $1
		ORDER BY created_at DESC, id DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.QueryContext(ctx, listQuery, productID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list product reviews: %w", err)
	}
	defer rows.Close()

	reviews := make([]*model.ProductReview, 0)
	for rows.Next() {
		review, scanErr := scanProductReviewRow(rows)
		if scanErr != nil {
			return nil, 0, fmt.Errorf("failed to scan product review: %w", scanErr)
		}
		reviews = append(reviews, review)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed to iterate product reviews: %w", err)
	}

	return reviews, total, nil
}

func (r *postgresProductRepository) GetReviewSummary(ctx context.Context, productID string) (*model.ProductReviewSummary, error) {
	const query = `
		SELECT
			COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::float8 AS average_rating,
			COUNT(*) AS review_count,
			COUNT(*) FILTER (WHERE rating = 1) AS rating_one,
			COUNT(*) FILTER (WHERE rating = 2) AS rating_two,
			COUNT(*) FILTER (WHERE rating = 3) AS rating_three,
			COUNT(*) FILTER (WHERE rating = 4) AS rating_four,
			COUNT(*) FILTER (WHERE rating = 5) AS rating_five
		FROM product_reviews
		WHERE product_id = $1
	`

	summary := &model.ProductReviewSummary{}
	if err := r.db.QueryRowContext(ctx, query, productID).Scan(
		&summary.AverageRating,
		&summary.ReviewCount,
		&summary.RatingBreakdown.One,
		&summary.RatingBreakdown.Two,
		&summary.RatingBreakdown.Three,
		&summary.RatingBreakdown.Four,
		&summary.RatingBreakdown.Five,
	); err != nil {
		return nil, fmt.Errorf("failed to summarize product reviews: %w", err)
	}

	return summary, nil
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

	review.Comment = strings.TrimSpace(review.Comment)
	return review, nil
}
