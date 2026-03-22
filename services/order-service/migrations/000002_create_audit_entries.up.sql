CREATE TABLE IF NOT EXISTS audit_entries (
    id          VARCHAR(36) PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   VARCHAR(36) NOT NULL,
    action      VARCHAR(100) NOT NULL,
    actor_id    VARCHAR(36),
    actor_role  VARCHAR(20),
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entries_entity
ON audit_entries(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_entries_action_created_at
ON audit_entries(action, created_at DESC);
