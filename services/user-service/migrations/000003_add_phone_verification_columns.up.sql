ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS phone_last_changed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_phone_verified ON users(phone_verified);

CREATE TABLE IF NOT EXISTS user_phone_verification_challenges (
    id                  VARCHAR(36) PRIMARY KEY,
    user_id             VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose             VARCHAR(50) NOT NULL,
    phone_candidate     VARCHAR(20) NOT NULL,
    otp_hash            VARCHAR(128) NOT NULL,
    expires_at          TIMESTAMP NOT NULL,
    resend_available_at TIMESTAMP NOT NULL,
    last_sent_at        TIMESTAMP NOT NULL,
    attempt_count       INT NOT NULL DEFAULT 0,
    max_attempts        INT NOT NULL DEFAULT 5,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    telegram_chat_id    VARCHAR(64) NOT NULL,
    verified_at         TIMESTAMP,
    consumed_at         TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_phone_verification_status CHECK (status IN ('pending', 'verified', 'locked', 'consumed', 'expired')),
    CONSTRAINT chk_user_phone_verification_attempt_count CHECK (attempt_count >= 0),
    CONSTRAINT chk_user_phone_verification_max_attempts CHECK (max_attempts > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_verification_pending_user_purpose
ON user_phone_verification_challenges(user_id, purpose)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_phone_verification_phone_candidate
ON user_phone_verification_challenges(phone_candidate);

CREATE INDEX IF NOT EXISTS idx_phone_verification_expires_at
ON user_phone_verification_challenges(expires_at);

CREATE INDEX IF NOT EXISTS idx_phone_verification_status_updated_at
ON user_phone_verification_challenges(status, updated_at DESC);
