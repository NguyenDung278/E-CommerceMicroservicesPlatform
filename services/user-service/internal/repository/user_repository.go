package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

// UserRepository defines the interface for user data access.
// WHY AN INTERFACE: This lets us swap implementations for testing
// (mock repository) without changing business logic.
type UserRepository interface {
	Create(ctx context.Context, user *model.User) error
	GetByID(ctx context.Context, id string) (*model.User, error)
	GetByEmail(ctx context.Context, email string) (*model.User, error)
	GetByPhone(ctx context.Context, phone string) (*model.User, error)
	GetByEmailVerificationTokenHash(ctx context.Context, tokenHash string) (*model.User, error)
	GetByPasswordResetTokenHash(ctx context.Context, tokenHash string) (*model.User, error)
	List(ctx context.Context) ([]*model.User, error)
	Update(ctx context.Context, user *model.User) error
}

var (
	ErrUserEmailAlreadyExists = errors.New("user email already exists")
	ErrUserPhoneAlreadyExists = errors.New("user phone already exists")
)

// postgresUserRepository implements UserRepository using PostgreSQL.
type postgresUserRepository struct {
	executor sqlExecutor
}

// NewUserRepository creates a new PostgreSQL-backed user repository.
func NewUserRepository(db *sql.DB) UserRepository {
	return newUserRepositoryWithExecutor(db)
}

func newUserRepositoryWithExecutor(executor sqlExecutor) UserRepository {
	return &postgresUserRepository{executor: executor}
}

// Create inserts a new user into the database.
// PITFALL: Always use parameterized queries ($1, $2...) to prevent SQL injection.
func (r *postgresUserRepository) Create(ctx context.Context, user *model.User) error {
	query := `
		INSERT INTO users (
			id, email, phone, phone_verified, phone_verified_at, phone_last_changed_at, password, first_name, last_name, role,
			email_verified, email_verification_token_hash, email_verification_expires_at,
			password_reset_token_hash, password_reset_expires_at,
			created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`
	_, err := r.executor.ExecContext(ctx, query,
		user.ID,
		user.Email,
		toNullableString(user.Phone),
		user.PhoneVerified,
		user.PhoneVerifiedAt,
		user.PhoneLastChangedAt,
		user.Password,
		user.FirstName,
		user.LastName,
		user.Role,
		user.EmailVerified,
		toNullableString(user.EmailVerificationTokenHash),
		user.EmailVerificationExpiresAt,
		toNullableString(user.PasswordResetTokenHash),
		user.PasswordResetExpiresAt,
		user.CreatedAt,
		user.UpdatedAt,
	)
	if err != nil {
		if isUserRepositoryUniqueViolation(err, "email") {
			return ErrUserEmailAlreadyExists
		}
		if isUserRepositoryUniqueViolation(err, "phone") {
			return ErrUserPhoneAlreadyExists
		}
		return fmt.Errorf("failed to create user: %w", err)
	}
	return nil
}

// GetByID retrieves a user by their UUID.
// Returns nil, nil if the user is not found (not an error condition).
func (r *postgresUserRepository) GetByID(ctx context.Context, id string) (*model.User, error) {
	query := `
		SELECT
			id, email, COALESCE(phone, ''), phone_verified, phone_verified_at, phone_last_changed_at,
			password, first_name, last_name, role,
			email_verified,
			COALESCE(email_verification_token_hash, ''), email_verification_expires_at,
			COALESCE(password_reset_token_hash, ''), password_reset_expires_at,
			created_at, updated_at
		FROM users
		WHERE id = $1
	`

	user, err := scanUser(r.executor.QueryRowContext(ctx, query, id))
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
	query := `
		SELECT
			id, email, COALESCE(phone, ''), phone_verified, phone_verified_at, phone_last_changed_at,
			password, first_name, last_name, role,
			email_verified,
			COALESCE(email_verification_token_hash, ''), email_verification_expires_at,
			COALESCE(password_reset_token_hash, ''), password_reset_expires_at,
			created_at, updated_at
		FROM users
		WHERE email = $1
	`

	user, err := scanUser(r.executor.QueryRowContext(ctx, query, email))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}
	return user, nil
}

// GetByPhone retrieves a user by their normalized phone number.
func (r *postgresUserRepository) GetByPhone(ctx context.Context, phone string) (*model.User, error) {
	query := `
		SELECT
			id, email, COALESCE(phone, ''), phone_verified, phone_verified_at, phone_last_changed_at,
			password, first_name, last_name, role,
			email_verified,
			COALESCE(email_verification_token_hash, ''), email_verification_expires_at,
			COALESCE(password_reset_token_hash, ''), password_reset_expires_at,
			created_at, updated_at
		FROM users
		WHERE phone = $1
	`

	user, err := scanUser(r.executor.QueryRowContext(ctx, query, phone))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by phone: %w", err)
	}
	return user, nil
}

func (r *postgresUserRepository) GetByEmailVerificationTokenHash(ctx context.Context, tokenHash string) (*model.User, error) {
	query := `
		SELECT
			id, email, COALESCE(phone, ''), phone_verified, phone_verified_at, phone_last_changed_at,
			password, first_name, last_name, role,
			email_verified,
			COALESCE(email_verification_token_hash, ''), email_verification_expires_at,
			COALESCE(password_reset_token_hash, ''), password_reset_expires_at,
			created_at, updated_at
		FROM users
		WHERE email_verification_token_hash = $1
	`

	user, err := scanUser(r.executor.QueryRowContext(ctx, query, tokenHash))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by email verification token: %w", err)
	}

	return user, nil
}

func (r *postgresUserRepository) GetByPasswordResetTokenHash(ctx context.Context, tokenHash string) (*model.User, error) {
	query := `
		SELECT
			id, email, COALESCE(phone, ''), phone_verified, phone_verified_at, phone_last_changed_at,
			password, first_name, last_name, role,
			email_verified,
			COALESCE(email_verification_token_hash, ''), email_verification_expires_at,
			COALESCE(password_reset_token_hash, ''), password_reset_expires_at,
			created_at, updated_at
		FROM users
		WHERE password_reset_token_hash = $1
	`

	user, err := scanUser(r.executor.QueryRowContext(ctx, query, tokenHash))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by password reset token: %w", err)
	}

	return user, nil
}

func (r *postgresUserRepository) List(ctx context.Context) ([]*model.User, error) {
	query := `
		SELECT
			id, email, COALESCE(phone, ''), phone_verified, phone_verified_at, phone_last_changed_at,
			password, first_name, last_name, role,
			email_verified,
			COALESCE(email_verification_token_hash, ''), email_verification_expires_at,
			COALESCE(password_reset_token_hash, ''), password_reset_expires_at,
			created_at, updated_at
		FROM users
		ORDER BY created_at DESC
	`

	rows, err := r.executor.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	var users []*model.User
	for rows.Next() {
		user, err := scanUser(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate users: %w", err)
	}

	return users, nil
}

// Update modifies an existing user's profile information.
func (r *postgresUserRepository) Update(ctx context.Context, user *model.User) error {
	query := `
		UPDATE users
		SET email = $1,
		    phone = $2,
		    phone_verified = $3,
		    phone_verified_at = $4,
		    phone_last_changed_at = $5,
		    password = $6,
		    first_name = $7,
		    last_name = $8,
		    role = $9,
		    email_verified = $10,
		    email_verification_token_hash = $11,
		    email_verification_expires_at = $12,
		    password_reset_token_hash = $13,
		    password_reset_expires_at = $14,
		    updated_at = $15
		WHERE id = $16
	`
	_, err := r.executor.ExecContext(ctx, query,
		user.Email,
		toNullableString(user.Phone),
		user.PhoneVerified,
		user.PhoneVerifiedAt,
		user.PhoneLastChangedAt,
		user.Password,
		user.FirstName,
		user.LastName,
		user.Role,
		user.EmailVerified,
		toNullableString(user.EmailVerificationTokenHash),
		user.EmailVerificationExpiresAt,
		toNullableString(user.PasswordResetTokenHash),
		user.PasswordResetExpiresAt,
		user.UpdatedAt,
		user.ID,
	)
	if err != nil {
		if isUserRepositoryUniqueViolation(err, "email") {
			return ErrUserEmailAlreadyExists
		}
		if isUserRepositoryUniqueViolation(err, "phone") {
			return ErrUserPhoneAlreadyExists
		}
		return fmt.Errorf("failed to update user: %w", err)
	}
	return nil
}

func isUserRepositoryUniqueViolation(err error, field string) bool {
	var pqErr *pq.Error
	if !errors.As(err, &pqErr) || pqErr.Code != "23505" {
		return false
	}

	field = strings.ToLower(field)
	constraint := strings.ToLower(string(pqErr.Constraint))
	detail := strings.ToLower(pqErr.Detail)
	return strings.Contains(constraint, field) || strings.Contains(detail, field)
}

type userScanner interface {
	Scan(dest ...any) error
}

func scanUser(scanner userScanner) (*model.User, error) {
	user := &model.User{}
	var phoneVerifiedAt sql.NullTime
	var phoneLastChangedAt sql.NullTime
	var emailVerificationExpiresAt sql.NullTime
	var passwordResetExpiresAt sql.NullTime

	err := scanner.Scan(
		&user.ID,
		&user.Email,
		&user.Phone,
		&user.PhoneVerified,
		&phoneVerifiedAt,
		&phoneLastChangedAt,
		&user.Password,
		&user.FirstName,
		&user.LastName,
		&user.Role,
		&user.EmailVerified,
		&user.EmailVerificationTokenHash,
		&emailVerificationExpiresAt,
		&user.PasswordResetTokenHash,
		&passwordResetExpiresAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if emailVerificationExpiresAt.Valid {
		value := emailVerificationExpiresAt.Time
		user.EmailVerificationExpiresAt = &value
	}
	if phoneVerifiedAt.Valid {
		value := phoneVerifiedAt.Time
		user.PhoneVerifiedAt = &value
	}
	if phoneLastChangedAt.Valid {
		value := phoneLastChangedAt.Time
		user.PhoneLastChangedAt = &value
	}
	if passwordResetExpiresAt.Valid {
		value := passwordResetExpiresAt.Time
		user.PasswordResetExpiresAt = &value
	}

	return user, nil
}

func toNullableString(value string) any {
	if value == "" {
		return nil
	}

	return value
}
