package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

// AddressRepository defines the interface for address data access.
type AddressRepository interface {
	Create(ctx context.Context, addr *model.Address) error
	GetByID(ctx context.Context, id string) (*model.Address, error)
	GetByUserID(ctx context.Context, userID string) ([]*model.Address, error)
	Update(ctx context.Context, addr *model.Address) error
	Delete(ctx context.Context, id string) error
	ClearDefault(ctx context.Context, userID string) error
	CountByUserID(ctx context.Context, userID string) (int, error)
}

type postgresAddressRepository struct {
	executor sqlExecutor
}

// NewAddressRepository creates a new PostgreSQL-backed address repository.
func NewAddressRepository(db *sql.DB) AddressRepository {
	return newAddressRepositoryWithExecutor(db)
}

func newAddressRepositoryWithExecutor(executor sqlExecutor) AddressRepository {
	return &postgresAddressRepository{executor: executor}
}

func (r *postgresAddressRepository) Create(ctx context.Context, addr *model.Address) error {
	query := `
		INSERT INTO addresses (id, user_id, recipient_name, phone, street, ward, district, city, is_default, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err := r.executor.ExecContext(ctx, query,
		addr.ID, addr.UserID, addr.RecipientName, addr.Phone,
		addr.Street, addr.Ward, addr.District, addr.City,
		addr.IsDefault, addr.CreatedAt, addr.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create address: %w", err)
	}
	return nil
}

func (r *postgresAddressRepository) GetByID(ctx context.Context, id string) (*model.Address, error) {
	query := `
		SELECT id, user_id, recipient_name, phone, street, ward, district, city, is_default, created_at, updated_at
		FROM addresses WHERE id = $1
	`
	addr := &model.Address{}
	err := r.executor.QueryRowContext(ctx, query, id).Scan(
		&addr.ID, &addr.UserID, &addr.RecipientName, &addr.Phone,
		&addr.Street, &addr.Ward, &addr.District, &addr.City,
		&addr.IsDefault, &addr.CreatedAt, &addr.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get address: %w", err)
	}
	return addr, nil
}

func (r *postgresAddressRepository) GetByUserID(ctx context.Context, userID string) ([]*model.Address, error) {
	query := `
		SELECT id, user_id, recipient_name, phone, street, ward, district, city, is_default, created_at, updated_at
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
			&addr.Street, &addr.Ward, &addr.District, &addr.City,
			&addr.IsDefault, &addr.CreatedAt, &addr.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan address: %w", err)
		}
		addresses = append(addresses, addr)
	}
	return addresses, nil
}

func (r *postgresAddressRepository) Update(ctx context.Context, addr *model.Address) error {
	query := `
		UPDATE addresses
		SET recipient_name = $1, phone = $2, street = $3, ward = $4,
		    district = $5, city = $6, is_default = $7, updated_at = $8
		WHERE id = $9
	`
	_, err := r.executor.ExecContext(ctx, query,
		addr.RecipientName, addr.Phone, addr.Street, addr.Ward,
		addr.District, addr.City, addr.IsDefault, addr.UpdatedAt,
		addr.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update address: %w", err)
	}
	return nil
}

func (r *postgresAddressRepository) Delete(ctx context.Context, id string) error {
	_, err := r.executor.ExecContext(ctx, `DELETE FROM addresses WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete address: %w", err)
	}
	return nil
}

// ClearDefault removes the default flag from all addresses of a user.
// Called before setting a new default address.
func (r *postgresAddressRepository) ClearDefault(ctx context.Context, userID string) error {
	_, err := r.executor.ExecContext(ctx,
		`UPDATE addresses SET is_default = false, updated_at = NOW() WHERE user_id = $1 AND is_default = true`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("failed to clear default address: %w", err)
	}
	return nil
}

func (r *postgresAddressRepository) CountByUserID(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.executor.QueryRowContext(ctx, `SELECT COUNT(*) FROM addresses WHERE user_id = $1`, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count addresses: %w", err)
	}
	return count, nil
}
