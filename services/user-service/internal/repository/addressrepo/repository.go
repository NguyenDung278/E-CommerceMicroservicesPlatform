package addressrepo

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/common"
)

type Repository struct {
	executor common.SQLExecutor
}

func New(db *sql.DB) *Repository {
	return NewWithExecutor(db)
}

func NewWithExecutor(executor common.SQLExecutor) *Repository {
	return &Repository{executor: executor}
}

func (r *Repository) Create(ctx context.Context, addr *model.Address) error {
	query := `
		INSERT INTO addresses (
			id, user_id, recipient_name, phone, location, is_default, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.executor.ExecContext(ctx, query,
		addr.ID, addr.UserID, addr.RecipientName, addr.Phone,
		addr.Location, addr.IsDefault, addr.CreatedAt, addr.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create address: %w", err)
	}
	return nil
}

func (r *Repository) GetByID(ctx context.Context, id string) (*model.Address, error) {
	query := `
		SELECT id, user_id, recipient_name, phone, location, is_default, created_at, updated_at
		FROM addresses WHERE id = $1
	`
	addr := &model.Address{}
	err := r.executor.QueryRowContext(ctx, query, id).Scan(
		&addr.ID, &addr.UserID, &addr.RecipientName, &addr.Phone,
		&addr.Location, &addr.IsDefault, &addr.CreatedAt, &addr.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get address: %w", err)
	}
	return addr, nil
}

func (r *Repository) GetByUserID(ctx context.Context, userID string) ([]*model.Address, error) {
	query := `
		SELECT id, user_id, recipient_name, phone, location, is_default, created_at, updated_at
		FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC
	`
	rows, err := r.executor.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list addresses: %w", err)
	}
	defer rows.Close()

	var addresses []*model.Address
	for rows.Next() {
		addr := &model.Address{}
		if err := rows.Scan(
			&addr.ID, &addr.UserID, &addr.RecipientName, &addr.Phone,
			&addr.Location, &addr.IsDefault, &addr.CreatedAt, &addr.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan address: %w", err)
		}
		addresses = append(addresses, addr)
	}
	return addresses, nil
}

func (r *Repository) Update(ctx context.Context, addr *model.Address) error {
	query := `
		UPDATE addresses
		SET recipient_name = $1, phone = $2, location = $3, is_default = $4, updated_at = $5
		WHERE id = $6
	`
	_, err := r.executor.ExecContext(ctx, query,
		addr.RecipientName, addr.Phone, addr.Location, addr.IsDefault, addr.UpdatedAt, addr.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update address: %w", err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.executor.ExecContext(ctx, `DELETE FROM addresses WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete address: %w", err)
	}
	return nil
}

func (r *Repository) ClearDefault(ctx context.Context, userID string) error {
	_, err := r.executor.ExecContext(ctx,
		`UPDATE addresses SET is_default = false, updated_at = NOW() WHERE user_id = $1 AND is_default = true`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("failed to clear default address: %w", err)
	}
	return nil
}

func (r *Repository) CountByUserID(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.executor.QueryRowContext(ctx, `SELECT COUNT(*) FROM addresses WHERE user_id = $1`, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count addresses: %w", err)
	}
	return count, nil
}
