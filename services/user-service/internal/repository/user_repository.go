package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

// UserRepository defines the interface for user data access.
// WHY AN INTERFACE: This lets us swap implementations for testing
// (mock repository) without changing business logic.
type UserRepository interface {
	Create(ctx context.Context, user *model.User) error
	GetByID(ctx context.Context, id string) (*model.User, error)
	GetByEmail(ctx context.Context, email string) (*model.User, error)
	Update(ctx context.Context, user *model.User) error
}

// postgresUserRepository implements UserRepository using PostgreSQL.
type postgresUserRepository struct {
	db *sql.DB
}

// NewUserRepository creates a new PostgreSQL-backed user repository.
func NewUserRepository(db *sql.DB) UserRepository {
	return &postgresUserRepository{db: db}
}

// Create inserts a new user into the database.
// PITFALL: Always use parameterized queries ($1, $2...) to prevent SQL injection.
func (r *postgresUserRepository) Create(ctx context.Context, user *model.User) error {
	query := `
		INSERT INTO users (id, email, password, first_name, last_name, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.db.ExecContext(ctx, query,
		user.ID, user.Email, user.Password, user.FirstName,
		user.LastName, user.Role, user.CreatedAt, user.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}
	return nil
}

// GetByID retrieves a user by their UUID.
// Returns nil, nil if the user is not found (not an error condition).
func (r *postgresUserRepository) GetByID(ctx context.Context, id string) (*model.User, error) {
	query := `SELECT id, email, password, first_name, last_name, role, created_at, updated_at FROM users WHERE id = $1`

	user := &model.User{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID, &user.Email, &user.Password, &user.FirstName,
		&user.LastName, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by ID: %w", err)
	}
	return user, nil
}

// GetByEmail retrieves a user by their email address.
// Used during login to look up the user and verify their password.
func (r *postgresUserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	query := `SELECT id, email, password, first_name, last_name, role, created_at, updated_at FROM users WHERE email = $1`

	user := &model.User{}
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID, &user.Email, &user.Password, &user.FirstName,
		&user.LastName, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}
	return user, nil
}

// Update modifies an existing user's profile information.
func (r *postgresUserRepository) Update(ctx context.Context, user *model.User) error {
	query := `
		UPDATE users SET first_name = $1, last_name = $2, updated_at = $3
		WHERE id = $4
	`
	_, err := r.db.ExecContext(ctx, query,
		user.FirstName, user.LastName, user.UpdatedAt, user.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}
	return nil
}
