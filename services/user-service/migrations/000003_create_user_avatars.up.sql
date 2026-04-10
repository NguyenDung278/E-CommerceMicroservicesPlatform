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
