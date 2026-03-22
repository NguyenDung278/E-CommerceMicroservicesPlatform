CREATE TABLE IF NOT EXISTS users (
    id                            VARCHAR(36) PRIMARY KEY,
    email                         VARCHAR(255) UNIQUE NOT NULL,
    phone                         VARCHAR(20),
    password                      VARCHAR(255) NOT NULL,
    first_name                    VARCHAR(100) NOT NULL,
    last_name                     VARCHAR(100) NOT NULL,
    role                          VARCHAR(20)  NOT NULL DEFAULT 'user',
    email_verified                BOOLEAN      NOT NULL DEFAULT FALSE,
    email_verification_token_hash VARCHAR(64),
    email_verification_expires_at TIMESTAMP,
    password_reset_token_hash     VARCHAR(64),
    password_reset_expires_at     TIMESTAMP,
    created_at                    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
ON users(phone)
WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash
ON users(email_verification_token_hash);

CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash
ON users(password_reset_token_hash);

CREATE TABLE IF NOT EXISTS addresses (
    id             VARCHAR(36)  PRIMARY KEY,
    user_id        VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_name VARCHAR(100) NOT NULL,
    phone          VARCHAR(20)  NOT NULL,
    street         VARCHAR(255) NOT NULL,
    ward           VARCHAR(100) NOT NULL DEFAULT '',
    district       VARCHAR(100) NOT NULL,
    city           VARCHAR(100) NOT NULL,
    is_default     BOOLEAN      NOT NULL DEFAULT false,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
