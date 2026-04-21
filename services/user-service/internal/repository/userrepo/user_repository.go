package userrepo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/common"
)

var (
	ErrUserEmailAlreadyExists = errors.New("user email already exists")
	ErrUserPhoneAlreadyExists = errors.New("user phone already exists")
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

func (r *Repository) Create(ctx context.Context, user *model.User) error {
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
		toNullableString(user.Email),
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
		if isUniqueViolation(err, "email") {
			return ErrUserEmailAlreadyExists
		}
		if isUniqueViolation(err, "phone") {
			return ErrUserPhoneAlreadyExists
		}
		return fmt.Errorf("failed to create user: %w", err)
	}
	return nil
}

func (r *Repository) GetByID(ctx context.Context, id string) (*model.User, error) {
	query := `
		SELECT
			id, COALESCE(email, ''), COALESCE(phone, ''), phone_verified, phone_verified_at, phone_last_changed_at,
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

func (r *Repository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	if strings.TrimSpace(email) == "" {
		return nil, nil
	}

	query := `
		SELECT
			id, COALESCE(email, ''), COALESCE(phone, ''), phone_verified, phone_verified_at, phone_last_changed_at,
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

func (r *Repository) GetByPhone(ctx context.Context, phone string) (*model.User, error) {
	query := `
		SELECT
			id, COALESCE(email, ''), COALESCE(phone, ''), phone_verified, phone_verified_at, phone_last_changed_at,
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

func (r *Repository) GetByEmailVerificationTokenHash(ctx context.Context, tokenHash string) (*model.User, error) {
	query := `
		SELECT
			id, COALESCE(email, ''), COALESCE(phone, ''), phone_verified, phone_verified_at, phone_last_changed_at,
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

func (r *Repository) GetByPasswordResetTokenHash(ctx context.Context, tokenHash string) (*model.User, error) {
	query := `
		SELECT
			id, COALESCE(email, ''), COALESCE(phone, ''), phone_verified, phone_verified_at, phone_last_changed_at,
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

func (r *Repository) List(ctx context.Context) ([]*model.User, error) {
	query := `
		SELECT
			id, COALESCE(email, ''), COALESCE(phone, ''), phone_verified, phone_verified_at, phone_last_changed_at,
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

func (r *Repository) Update(ctx context.Context, user *model.User) error {
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
		toNullableString(user.Email),
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
		if isUniqueViolation(err, "email") {
			return ErrUserEmailAlreadyExists
		}
		if isUniqueViolation(err, "phone") {
			return ErrUserPhoneAlreadyExists
		}
		return fmt.Errorf("failed to update user: %w", err)
	}
	return nil
}

func isUniqueViolation(err error, field string) bool {
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
