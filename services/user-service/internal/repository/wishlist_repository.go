package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type WishlistRepository interface {
	ListByUserID(ctx context.Context, userID string) ([]*model.WishlistItem, error)
	Upsert(ctx context.Context, item *model.WishlistItem) error
	UpsertMany(ctx context.Context, userID string, productIDs []string) error
	Delete(ctx context.Context, userID, productID string) error
}

type postgresWishlistRepository struct {
	executor sqlExecutor
}

func NewWishlistRepository(db *sql.DB) WishlistRepository {
	return &postgresWishlistRepository{executor: db}
}

func (r *postgresWishlistRepository) ListByUserID(ctx context.Context, userID string) ([]*model.WishlistItem, error) {
	rows, err := r.executor.QueryContext(ctx, `
		SELECT user_id, product_id, created_at, updated_at
		FROM wishlist_items
		WHERE user_id = $1
		ORDER BY updated_at DESC, product_id ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list wishlist items: %w", err)
	}
	defer rows.Close()

	items := make([]*model.WishlistItem, 0)
	for rows.Next() {
		item := &model.WishlistItem{}
		if err := rows.Scan(&item.UserID, &item.ProductID, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan wishlist item: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate wishlist items: %w", err)
	}

	return items, nil
}

func (r *postgresWishlistRepository) Upsert(ctx context.Context, item *model.WishlistItem) error {
	_, err := r.executor.ExecContext(ctx, `
		INSERT INTO wishlist_items (user_id, product_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, product_id)
		DO UPDATE SET updated_at = EXCLUDED.updated_at
	`, item.UserID, item.ProductID, item.CreatedAt, item.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to upsert wishlist item: %w", err)
	}

	return nil
}

func (r *postgresWishlistRepository) UpsertMany(ctx context.Context, userID string, productIDs []string) error {
	if len(productIDs) == 0 {
		return nil
	}

	_, err := r.executor.ExecContext(ctx, `
		INSERT INTO wishlist_items (user_id, product_id, created_at, updated_at)
		SELECT $1, product_id, NOW(), NOW()
		FROM unnest($2::text[]) AS product_id
		ON CONFLICT (user_id, product_id)
		DO UPDATE SET updated_at = NOW()
	`, userID, pq.Array(productIDs))
	if err != nil {
		return fmt.Errorf("failed to upsert wishlist items: %w", err)
	}

	return nil
}

func (r *postgresWishlistRepository) Delete(ctx context.Context, userID, productID string) error {
	_, err := r.executor.ExecContext(ctx, `
		DELETE FROM wishlist_items
		WHERE user_id = $1 AND product_id = $2
	`, userID, productID)
	if err != nil {
		return fmt.Errorf("failed to delete wishlist item: %w", err)
	}

	return nil
}
