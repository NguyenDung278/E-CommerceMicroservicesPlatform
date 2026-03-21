ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash
ON users(email_verification_token_hash);

CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash
ON users(password_reset_token_hash);
