package authrepo

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/common"
)

type EmailVerificationRepository struct {
	executor common.SQLExecutor
}

func NewEmailVerification(db *sql.DB) *EmailVerificationRepository {
	return NewEmailVerificationWithExecutor(db)
}

func NewEmailVerificationWithExecutor(executor common.SQLExecutor) *EmailVerificationRepository {
	return &EmailVerificationRepository{executor: executor}
}

func (r *EmailVerificationRepository) Create(ctx context.Context, challenge *model.EmailVerificationChallenge) error {
	query := `
		INSERT INTO user_email_verification_challenges (
			id, user_id, purpose, email, otp_hash, expires_at,
			resend_available_at, last_sent_at, attempt_count, max_attempts,
			status, verified_at, consumed_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`

	_, err := r.executor.ExecContext(ctx, query,
		challenge.ID,
		challenge.UserID,
		challenge.Purpose,
		challenge.Email,
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
		return fmt.Errorf("failed to create email verification challenge: %w", err)
	}

	return nil
}

func (r *EmailVerificationRepository) GetByID(ctx context.Context, id string) (*model.EmailVerificationChallenge, error) {
	query := `
		SELECT id, user_id, purpose, email, otp_hash, expires_at,
		       resend_available_at, last_sent_at, attempt_count, max_attempts,
		       status, verified_at, consumed_at, created_at, updated_at
		FROM user_email_verification_challenges
		WHERE id = $1
	`

	challenge, err := scanEmailVerificationChallenge(r.executor.QueryRowContext(ctx, query, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get email verification challenge by id: %w", err)
	}

	return challenge, nil
}

func (r *EmailVerificationRepository) GetLatestActiveByUserID(ctx context.Context, userID, purpose string) (*model.EmailVerificationChallenge, error) {
	query := `
		SELECT id, user_id, purpose, email, otp_hash, expires_at,
		       resend_available_at, last_sent_at, attempt_count, max_attempts,
		       status, verified_at, consumed_at, created_at, updated_at
		FROM user_email_verification_challenges
		WHERE user_id = $1
		  AND purpose = $2
		  AND status IN ('pending', 'verified')
		ORDER BY updated_at DESC
		LIMIT 1
	`

	challenge, err := scanEmailVerificationChallenge(r.executor.QueryRowContext(ctx, query, userID, purpose))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get latest email verification challenge: %w", err)
	}

	return challenge, nil
}

func (r *EmailVerificationRepository) Update(ctx context.Context, challenge *model.EmailVerificationChallenge) error {
	query := `
		UPDATE user_email_verification_challenges
		SET email = $1,
		    otp_hash = $2,
		    expires_at = $3,
		    resend_available_at = $4,
		    last_sent_at = $5,
		    attempt_count = $6,
		    max_attempts = $7,
		    status = $8,
		    verified_at = $9,
		    consumed_at = $10,
		    updated_at = $11
		WHERE id = $12
	`

	_, err := r.executor.ExecContext(ctx, query,
		challenge.Email,
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
		return fmt.Errorf("failed to update email verification challenge: %w", err)
	}

	return nil
}

func (r *EmailVerificationRepository) DeleteExpired(ctx context.Context) error {
	_, err := r.executor.ExecContext(ctx, `DELETE FROM user_email_verification_challenges WHERE expires_at < NOW() AND status IN ('expired', 'locked', 'consumed')`)
	if err != nil {
		return fmt.Errorf("failed to delete expired email verification challenges: %w", err)
	}

	return nil
}

type emailVerificationScanner interface {
	Scan(dest ...any) error
}

func scanEmailVerificationChallenge(scanner emailVerificationScanner) (*model.EmailVerificationChallenge, error) {
	challenge := &model.EmailVerificationChallenge{}
	var verifiedAt sql.NullTime
	var consumedAt sql.NullTime

	err := scanner.Scan(
		&challenge.ID,
		&challenge.UserID,
		&challenge.Purpose,
		&challenge.Email,
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
