CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_updated
    ON notification_preferences (user_id, updated_at DESC);
