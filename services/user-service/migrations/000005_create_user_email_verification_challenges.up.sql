CREATE TABLE IF NOT EXISTS user_email_verification_challenges (
    id                  VARCHAR(36) PRIMARY KEY,
    user_id             VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose             VARCHAR(50) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    otp_hash            VARCHAR(128) NOT NULL,
    expires_at          TIMESTAMP NOT NULL,
    resend_available_at TIMESTAMP NOT NULL,
    last_sent_at        TIMESTAMP NOT NULL,
    attempt_count       INT NOT NULL DEFAULT 0,
    max_attempts        INT NOT NULL DEFAULT 5,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    verified_at         TIMESTAMP,
    consumed_at         TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_email_verification_status CHECK (status IN ('pending', 'verified', 'locked', 'consumed', 'expired')),
    CONSTRAINT chk_user_email_verification_attempt_count CHECK (attempt_count >= 0),
    CONSTRAINT chk_user_email_verification_max_attempts CHECK (max_attempts > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_pending_user_purpose
ON user_email_verification_challenges(user_id, purpose)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_email_verification_email
ON user_email_verification_challenges(email);

CREATE INDEX IF NOT EXISTS idx_email_verification_expires_at
ON user_email_verification_challenges(expires_at);

CREATE INDEX IF NOT EXISTS idx_email_verification_status_updated_at
ON user_email_verification_challenges(status, updated_at DESC);
