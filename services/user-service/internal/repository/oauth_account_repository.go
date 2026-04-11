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
	Update(ctx context.Context, account *model.OAuthAccount) error
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
			id,
			user_id,
			provider,
			provider_user_id,
			provider_email,
			access_token,
			refresh_token,
			token_type,
			scope,
			id_token,
			access_token_expires_at,
			created_at,
			updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	_, err := r.db.ExecContext(ctx, query,
		account.ID,
		account.UserID,
		account.Provider,
		account.ProviderUserID,
		account.ProviderEmail,
		account.AccessToken,
		account.RefreshToken,
		account.TokenType,
		account.Scope,
		account.IDToken,
		account.AccessTokenExpiresAt,
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

func (r *postgresOAuthAccountRepository) Update(ctx context.Context, account *model.OAuthAccount) error {
	query := `
		UPDATE user_oauth_accounts
		SET provider_email = $2,
		    access_token = $3,
		    refresh_token = $4,
		    token_type = $5,
		    scope = $6,
		    id_token = $7,
		    access_token_expires_at = $8,
		    updated_at = $9
		WHERE id = $1
	`

	result, err := r.db.ExecContext(
		ctx,
		query,
		account.ID,
		account.ProviderEmail,
		account.AccessToken,
		account.RefreshToken,
		account.TokenType,
		account.Scope,
		account.IDToken,
		account.AccessTokenExpiresAt,
		account.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to update oauth account: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to read oauth account update result: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *postgresOAuthAccountRepository) GetByProviderUserID(ctx context.Context, provider, providerUserID string) (*model.OAuthAccount, error) {
	query := `
		SELECT
			id,
			user_id,
			provider,
			provider_user_id,
			provider_email,
			access_token,
			refresh_token,
			token_type,
			scope,
			id_token,
			access_token_expires_at,
			created_at,
			updated_at
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
		SELECT
			id,
			user_id,
			provider,
			provider_user_id,
			provider_email,
			access_token,
			refresh_token,
			token_type,
			scope,
			id_token,
			access_token_expires_at,
			created_at,
			updated_at
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
	var providerEmail sql.NullString
	var accessToken sql.NullString
	var refreshToken sql.NullString
	var tokenType sql.NullString
	var scope sql.NullString
	var idToken sql.NullString
	var accessTokenExpiresAt sql.NullTime
	err := scanner.Scan(
		&account.ID,
		&account.UserID,
		&account.Provider,
		&account.ProviderUserID,
		&providerEmail,
		&accessToken,
		&refreshToken,
		&tokenType,
		&scope,
		&idToken,
		&accessTokenExpiresAt,
		&account.CreatedAt,
		&account.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	account.ProviderEmail = providerEmail.String
	account.AccessToken = accessToken.String
	account.RefreshToken = refreshToken.String
	account.TokenType = tokenType.String
	account.Scope = scope.String
	account.IDToken = idToken.String
	if accessTokenExpiresAt.Valid {
		expiresAt := accessTokenExpiresAt.Time
		account.AccessTokenExpiresAt = &expiresAt
	}

	return account, nil
}
