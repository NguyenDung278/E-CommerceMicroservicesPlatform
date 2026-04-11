package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type PhoneSignupRepository interface {
	Create(ctx context.Context, challenge *model.PhoneSignupChallenge) error
	GetByID(ctx context.Context, id string) (*model.PhoneSignupChallenge, error)
	GetLatestActiveByPhone(ctx context.Context, phone string) (*model.PhoneSignupChallenge, error)
	Update(ctx context.Context, challenge *model.PhoneSignupChallenge) error
	DeleteExpired(ctx context.Context) error
}

type postgresPhoneSignupRepository struct {
	executor sqlExecutor
}

func NewPhoneSignupRepository(db *sql.DB) PhoneSignupRepository {
	return newPhoneSignupRepositoryWithExecutor(db)
}

func newPhoneSignupRepositoryWithExecutor(executor sqlExecutor) PhoneSignupRepository {
	return &postgresPhoneSignupRepository{executor: executor}
}

func (r *postgresPhoneSignupRepository) Create(ctx context.Context, challenge *model.PhoneSignupChallenge) error {
	query := `
		INSERT INTO user_phone_signup_challenges (
			id, phone, password_hash, first_name, last_name, otp_hash, expires_at,
			resend_available_at, last_sent_at, attempt_count, max_attempts,
			status, telegram_chat_id, verified_at, consumed_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`

	_, err := r.executor.ExecContext(ctx, query,
		challenge.ID,
		challenge.Phone,
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
		challenge.TelegramChatID,
		challenge.VerifiedAt,
		challenge.ConsumedAt,
		challenge.CreatedAt,
		challenge.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create phone signup challenge: %w", err)
	}

	return nil
}

func (r *postgresPhoneSignupRepository) GetByID(ctx context.Context, id string) (*model.PhoneSignupChallenge, error) {
	query := `
		SELECT id, phone, password_hash, first_name, last_name, otp_hash, expires_at,
		       resend_available_at, last_sent_at, attempt_count, max_attempts,
		       status, telegram_chat_id, verified_at, consumed_at, created_at, updated_at
		FROM user_phone_signup_challenges
		WHERE id = $1
	`

	challenge, err := scanPhoneSignupChallenge(r.executor.QueryRowContext(ctx, query, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get phone signup challenge by id: %w", err)
	}

	return challenge, nil
}

func (r *postgresPhoneSignupRepository) GetLatestActiveByPhone(ctx context.Context, phone string) (*model.PhoneSignupChallenge, error) {
	query := `
		SELECT id, phone, password_hash, first_name, last_name, otp_hash, expires_at,
		       resend_available_at, last_sent_at, attempt_count, max_attempts,
		       status, telegram_chat_id, verified_at, consumed_at, created_at, updated_at
		FROM user_phone_signup_challenges
		WHERE phone = $1
		  AND status IN ('pending', 'verified')
		ORDER BY updated_at DESC
		LIMIT 1
	`

	challenge, err := scanPhoneSignupChallenge(r.executor.QueryRowContext(ctx, query, phone))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get latest phone signup challenge: %w", err)
	}

	return challenge, nil
}

func (r *postgresPhoneSignupRepository) Update(ctx context.Context, challenge *model.PhoneSignupChallenge) error {
	query := `
		UPDATE user_phone_signup_challenges
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
		    telegram_chat_id = $11,
		    verified_at = $12,
		    consumed_at = $13,
		    updated_at = $14
		WHERE id = $15
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
		challenge.TelegramChatID,
		challenge.VerifiedAt,
		challenge.ConsumedAt,
		challenge.UpdatedAt,
		challenge.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update phone signup challenge: %w", err)
	}

	return nil
}

func (r *postgresPhoneSignupRepository) DeleteExpired(ctx context.Context) error {
	_, err := r.executor.ExecContext(ctx, `DELETE FROM user_phone_signup_challenges WHERE expires_at < NOW() AND status IN ('expired', 'locked', 'consumed')`)
	if err != nil {
		return fmt.Errorf("failed to delete expired phone signup challenges: %w", err)
	}

	return nil
}

type phoneSignupScanner interface {
	Scan(dest ...any) error
}

func scanPhoneSignupChallenge(scanner phoneSignupScanner) (*model.PhoneSignupChallenge, error) {
	challenge := &model.PhoneSignupChallenge{}
	var verifiedAt sql.NullTime
	var consumedAt sql.NullTime

	err := scanner.Scan(
		&challenge.ID,
		&challenge.Phone,
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
		&challenge.TelegramChatID,
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
