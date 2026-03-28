package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type PhoneVerificationRepository interface {
	Create(ctx context.Context, challenge *model.PhoneVerificationChallenge) error
	GetByID(ctx context.Context, id string) (*model.PhoneVerificationChallenge, error)
	GetLatestActiveByUserID(ctx context.Context, userID, purpose string) (*model.PhoneVerificationChallenge, error)
	Update(ctx context.Context, challenge *model.PhoneVerificationChallenge) error
	DeleteExpired(ctx context.Context) error
}

type postgresPhoneVerificationRepository struct {
	db *sql.DB
}

func NewPhoneVerificationRepository(db *sql.DB) PhoneVerificationRepository {
	return &postgresPhoneVerificationRepository{db: db}
}

func (r *postgresPhoneVerificationRepository) Create(ctx context.Context, challenge *model.PhoneVerificationChallenge) error {
	query := `
		INSERT INTO user_phone_verification_challenges (
			id, user_id, purpose, phone_candidate, otp_hash, expires_at,
			resend_available_at, last_sent_at, attempt_count, max_attempts,
			status, telegram_chat_id, verified_at, consumed_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`

	_, err := r.db.ExecContext(ctx, query,
		challenge.ID,
		challenge.UserID,
		challenge.Purpose,
		challenge.PhoneCandidate,
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
		return fmt.Errorf("failed to create phone verification challenge: %w", err)
	}

	return nil
}

func (r *postgresPhoneVerificationRepository) GetByID(ctx context.Context, id string) (*model.PhoneVerificationChallenge, error) {
	query := `
		SELECT id, user_id, purpose, phone_candidate, otp_hash, expires_at,
		       resend_available_at, last_sent_at, attempt_count, max_attempts,
		       status, telegram_chat_id, verified_at, consumed_at, created_at, updated_at
		FROM user_phone_verification_challenges
		WHERE id = $1
	`

	challenge, err := scanPhoneVerificationChallenge(r.db.QueryRowContext(ctx, query, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get phone verification challenge by id: %w", err)
	}

	return challenge, nil
}

func (r *postgresPhoneVerificationRepository) GetLatestActiveByUserID(ctx context.Context, userID, purpose string) (*model.PhoneVerificationChallenge, error) {
	query := `
		SELECT id, user_id, purpose, phone_candidate, otp_hash, expires_at,
		       resend_available_at, last_sent_at, attempt_count, max_attempts,
		       status, telegram_chat_id, verified_at, consumed_at, created_at, updated_at
		FROM user_phone_verification_challenges
		WHERE user_id = $1
		  AND purpose = $2
		  AND status IN ('pending', 'verified')
		ORDER BY updated_at DESC
		LIMIT 1
	`

	challenge, err := scanPhoneVerificationChallenge(r.db.QueryRowContext(ctx, query, userID, purpose))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get latest phone verification challenge: %w", err)
	}

	return challenge, nil
}

func (r *postgresPhoneVerificationRepository) Update(ctx context.Context, challenge *model.PhoneVerificationChallenge) error {
	query := `
		UPDATE user_phone_verification_challenges
		SET phone_candidate = $1,
		    otp_hash = $2,
		    expires_at = $3,
		    resend_available_at = $4,
		    last_sent_at = $5,
		    attempt_count = $6,
		    max_attempts = $7,
		    status = $8,
		    telegram_chat_id = $9,
		    verified_at = $10,
		    consumed_at = $11,
		    updated_at = $12
		WHERE id = $13
	`

	_, err := r.db.ExecContext(ctx, query,
		challenge.PhoneCandidate,
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
		return fmt.Errorf("failed to update phone verification challenge: %w", err)
	}

	return nil
}

func (r *postgresPhoneVerificationRepository) DeleteExpired(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM user_phone_verification_challenges WHERE expires_at < NOW() AND status IN ('expired', 'locked', 'consumed')`)
	if err != nil {
		return fmt.Errorf("failed to delete expired phone verification challenges: %w", err)
	}

	return nil
}

type phoneVerificationScanner interface {
	Scan(dest ...any) error
}

func scanPhoneVerificationChallenge(scanner phoneVerificationScanner) (*model.PhoneVerificationChallenge, error) {
	challenge := &model.PhoneVerificationChallenge{}
	var verifiedAt sql.NullTime
	var consumedAt sql.NullTime

	err := scanner.Scan(
		&challenge.ID,
		&challenge.UserID,
		&challenge.Purpose,
		&challenge.PhoneCandidate,
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
