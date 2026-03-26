CREATE TABLE IF NOT EXISTS user_oauth_accounts (
    id               VARCHAR(36) PRIMARY KEY,
    user_id          VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         VARCHAR(32) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    created_at       TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_oauth_accounts_provider_identity
ON user_oauth_accounts(provider, provider_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_oauth_accounts_user_provider
ON user_oauth_accounts(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_user_oauth_accounts_user_id
ON user_oauth_accounts(user_id);
