CREATE TABLE IF NOT EXISTS user_avatars (
    user_id      VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    file_name    VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    data         BYTEA        NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_avatars_updated_at
ON user_avatars(updated_at DESC);

ALTER TABLE IF EXISTS user_oauth_accounts
    ADD COLUMN IF NOT EXISTS provider_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS access_token TEXT,
    ADD COLUMN IF NOT EXISTS refresh_token TEXT,
    ADD COLUMN IF NOT EXISTS token_type VARCHAR(64),
    ADD COLUMN IF NOT EXISTS scope TEXT,
    ADD COLUMN IF NOT EXISTS id_token TEXT,
    ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMP;
