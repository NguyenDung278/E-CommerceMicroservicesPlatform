package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

var ErrOAuthAccountAlreadyExists = errors.New("oauth account already exists")

type OAuthAccountRepository interface {
	Create(ctx context.Context, account *model.OAuthAccount) error
	GetByProviderUserID(ctx context.Context, provider, providerUserID string) (*model.OAuthAccount, error)
	GetByUserIDAndProvider(ctx context.Context, userID, provider string) (*model.OAuthAccount, error)
}

type postgresOAuthAccountRepository struct {
	db *sql.DB
}

func NewOAuthAccountRepository(db *sql.DB) OAuthAccountRepository {
	return &postgresOAuthAccountRepository{db: db}
}

func (r *postgresOAuthAccountRepository) Create(ctx context.Context, account *model.OAuthAccount) error {
	query := `
		INSERT INTO user_oauth_accounts (
			id, user_id, provider, provider_user_id, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := r.db.ExecContext(ctx, query,
		account.ID,
		account.UserID,
		account.Provider,
		account.ProviderUserID,
		account.CreatedAt,
		account.UpdatedAt,
	)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return ErrOAuthAccountAlreadyExists
		}
		return fmt.Errorf("failed to create oauth account: %w", err)
	}

	return nil
}

func (r *postgresOAuthAccountRepository) GetByProviderUserID(ctx context.Context, provider, providerUserID string) (*model.OAuthAccount, error) {
	query := `
		SELECT id, user_id, provider, provider_user_id, created_at, updated_at
		FROM user_oauth_accounts
		WHERE provider = $1 AND provider_user_id = $2
	`

	account, err := scanOAuthAccount(r.db.QueryRowContext(ctx, query, provider, providerUserID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get oauth account by provider identity: %w", err)
	}

	return account, nil
}

func (r *postgresOAuthAccountRepository) GetByUserIDAndProvider(ctx context.Context, userID, provider string) (*model.OAuthAccount, error) {
	query := `
		SELECT id, user_id, provider, provider_user_id, created_at, updated_at
		FROM user_oauth_accounts
		WHERE user_id = $1 AND provider = $2
	`

	account, err := scanOAuthAccount(r.db.QueryRowContext(ctx, query, userID, provider))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get oauth account by user and provider: %w", err)
	}

	return account, nil
}

type oauthAccountScanner interface {
	Scan(dest ...any) error
}

func scanOAuthAccount(scanner oauthAccountScanner) (*model.OAuthAccount, error) {
	account := &model.OAuthAccount{}
	err := scanner.Scan(
		&account.ID,
		&account.UserID,
		&account.Provider,
		&account.ProviderUserID,
		&account.CreatedAt,
		&account.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return account, nil
}
