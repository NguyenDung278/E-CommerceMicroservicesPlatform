package authrepo

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/common"
)

type EmailSignupRepository struct {
	executor common.SQLExecutor
}

func NewEmailSignup(db *sql.DB) *EmailSignupRepository {
	return NewEmailSignupWithExecutor(db)
}

func NewEmailSignupWithExecutor(executor common.SQLExecutor) *EmailSignupRepository {
	return &EmailSignupRepository{executor: executor}
}

func (r *EmailSignupRepository) Create(ctx context.Context, challenge *model.EmailSignupChallenge) error {
	query := `
		INSERT INTO user_email_signup_challenges (
			id, email, password_hash, first_name, last_name, otp_hash, expires_at,
			resend_available_at, last_sent_at, attempt_count, max_attempts,
			status, verified_at, consumed_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`

	_, err := r.executor.ExecContext(ctx, query,
		challenge.ID,
		challenge.Email,
		challenge.PasswordHash,
		challenge.FirstName,
		challenge.LastName,
		challenge.OTPHash,
		challenge.ExpiresAt,
		challenge.ResendAvailableAt,
		challenge.LastSentAt,
		challenge.AttemptCount,
		challenge.MaxAttempts,
		challenge.Status,
		challenge.VerifiedAt,
		challenge.ConsumedAt,
		challenge.CreatedAt,
		challenge.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create email signup challenge: %w", err)
	}

	return nil
}

func (r *EmailSignupRepository) GetByID(ctx context.Context, id string) (*model.EmailSignupChallenge, error) {
	query := `
		SELECT id, email, password_hash, first_name, last_name, otp_hash, expires_at,
		       resend_available_at, last_sent_at, attempt_count, max_attempts,
		       status, verified_at, consumed_at, created_at, updated_at
		FROM user_email_signup_challenges
		WHERE id = $1
	`

	challenge, err := scanEmailSignupChallenge(r.executor.QueryRowContext(ctx, query, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get email signup challenge by id: %w", err)
	}

	return challenge, nil
}

func (r *EmailSignupRepository) GetLatestActiveByEmail(ctx context.Context, email string) (*model.EmailSignupChallenge, error) {
	query := `
		SELECT id, email, password_hash, first_name, last_name, otp_hash, expires_at,
		       resend_available_at, last_sent_at, attempt_count, max_attempts,
		       status, verified_at, consumed_at, created_at, updated_at
		FROM user_email_signup_challenges
		WHERE email = $1
		  AND status IN ('pending', 'verified')
		ORDER BY updated_at DESC
		LIMIT 1
	`

	challenge, err := scanEmailSignupChallenge(r.executor.QueryRowContext(ctx, query, email))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get latest email signup challenge: %w", err)
	}

	return challenge, nil
}

func (r *EmailSignupRepository) Update(ctx context.Context, challenge *model.EmailSignupChallenge) error {
	query := `
		UPDATE user_email_signup_challenges
		SET password_hash = $1,
		    first_name = $2,
		    last_name = $3,
		    otp_hash = $4,
		    expires_at = $5,
		    resend_available_at = $6,
		    last_sent_at = $7,
		    attempt_count = $8,
		    max_attempts = $9,
		    status = $10,
		    verified_at = $11,
		    consumed_at = $12,
		    updated_at = $13
		WHERE id = $14
	`

	_, err := r.executor.ExecContext(ctx, query,
		challenge.PasswordHash,
		challenge.FirstName,
		challenge.LastName,
		challenge.OTPHash,
		challenge.ExpiresAt,
		challenge.ResendAvailableAt,
		challenge.LastSentAt,
		challenge.AttemptCount,
		challenge.MaxAttempts,
		challenge.Status,
		challenge.VerifiedAt,
		challenge.ConsumedAt,
		challenge.UpdatedAt,
		challenge.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update email signup challenge: %w", err)
	}

	return nil
}

func (r *EmailSignupRepository) DeleteExpired(ctx context.Context) error {
	_, err := r.executor.ExecContext(ctx, `DELETE FROM user_email_signup_challenges WHERE expires_at < NOW() AND status IN ('expired', 'locked', 'consumed')`)
	if err != nil {
		return fmt.Errorf("failed to delete expired email signup challenges: %w", err)
	}

	return nil
}

type emailSignupScanner interface {
	Scan(dest ...any) error
}

func scanEmailSignupChallenge(scanner emailSignupScanner) (*model.EmailSignupChallenge, error) {
	challenge := &model.EmailSignupChallenge{}
	var verifiedAt sql.NullTime
	var consumedAt sql.NullTime

	err := scanner.Scan(
		&challenge.ID,
		&challenge.Email,
		&challenge.PasswordHash,
		&challenge.FirstName,
		&challenge.LastName,
		&challenge.OTPHash,
		&challenge.ExpiresAt,
		&challenge.ResendAvailableAt,
		&challenge.LastSentAt,
		&challenge.AttemptCount,
		&challenge.MaxAttempts,
		&challenge.Status,
		&verifiedAt,
		&consumedAt,
		&challenge.CreatedAt,
		&challenge.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if verifiedAt.Valid {
		value := verifiedAt.Time
		challenge.VerifiedAt = &value
	}
	if consumedAt.Valid {
		value := consumedAt.Time
		challenge.ConsumedAt = &value
	}

	return challenge, nil
}
