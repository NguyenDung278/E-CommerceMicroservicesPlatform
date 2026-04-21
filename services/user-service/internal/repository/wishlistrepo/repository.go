package wishlistrepo

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/common"
)

type Repository struct {
	executor common.SQLExecutor
}

func New(db *sql.DB) *Repository {
	return &Repository{executor: db}
}

func (r *Repository) ListByUserID(ctx context.Context, userID string) ([]*model.WishlistItem, error) {
	rows, err := r.executor.QueryContext(ctx, `
		SELECT user_id, product_id, baseline_price, baseline_stock, created_at, updated_at
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
		if err := rows.Scan(
			&item.UserID,
			&item.ProductID,
			&item.BaselinePrice,
			&item.BaselineStock,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan wishlist item: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate wishlist items: %w", err)
	}

	return items, nil
}

func (r *Repository) ListUserIDs(ctx context.Context, limit int) ([]string, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := r.executor.QueryContext(ctx, `
		SELECT user_id
		FROM wishlist_items
		GROUP BY user_id
		ORDER BY MAX(updated_at) DESC, user_id ASC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list wishlist user ids: %w", err)
	}
	defer rows.Close()

	userIDs := make([]string, 0)
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, fmt.Errorf("failed to scan wishlist user id: %w", err)
		}
		userIDs = append(userIDs, userID)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate wishlist user ids: %w", err)
	}

	return userIDs, nil
}

func (r *Repository) Upsert(ctx context.Context, item *model.WishlistItem) error {
	_, err := r.executor.ExecContext(ctx, `
		INSERT INTO wishlist_items (user_id, product_id, baseline_price, baseline_stock, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, product_id)
		DO UPDATE SET updated_at = EXCLUDED.updated_at
	`, item.UserID, item.ProductID, item.BaselinePrice, item.BaselineStock, item.CreatedAt, item.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to upsert wishlist item: %w", err)
	}

	return nil
}

func (r *Repository) UpsertMany(ctx context.Context, items []*model.WishlistItem) error {
	if len(items) == 0 {
		return nil
	}

	userIDs := make([]string, 0, len(items))
	productIDs := make([]string, 0, len(items))
	baselinePrices := make([]float64, 0, len(items))
	baselineStocks := make([]int, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		userIDs = append(userIDs, item.UserID)
		productIDs = append(productIDs, item.ProductID)
		baselinePrices = append(baselinePrices, item.BaselinePrice)
		baselineStocks = append(baselineStocks, item.BaselineStock)
	}
	if len(userIDs) == 0 {
		return nil
	}

	_, err := r.executor.ExecContext(ctx, `
		INSERT INTO wishlist_items (user_id, product_id, baseline_price, baseline_stock, created_at, updated_at)
		SELECT user_id, product_id, baseline_price, baseline_stock, NOW(), NOW()
		FROM unnest($1::text[], $2::text[], $3::double precision[], $4::integer[]) AS payload(user_id, product_id, baseline_price, baseline_stock)
		ON CONFLICT (user_id, product_id)
		DO UPDATE SET updated_at = NOW()
	`, pq.Array(userIDs), pq.Array(productIDs), pq.Array(baselinePrices), pq.Array(baselineStocks))
	if err != nil {
		return fmt.Errorf("failed to upsert wishlist items: %w", err)
	}

	return nil
}

func (r *Repository) Delete(ctx context.Context, userID, productID string) error {
	_, err := r.executor.ExecContext(ctx, `
		DELETE FROM wishlist_items
		WHERE user_id = $1 AND product_id = $2
	`, userID, productID)
	if err != nil {
		return fmt.Errorf("failed to delete wishlist item: %w", err)
	}

	return nil
}
