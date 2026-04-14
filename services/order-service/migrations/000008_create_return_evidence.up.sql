CREATE TABLE IF NOT EXISTS return_evidence (
    id               VARCHAR(36)   PRIMARY KEY,
    return_id        VARCHAR(36)   NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    file_name        VARCHAR(255)  NOT NULL DEFAULT '',
    content_type     VARCHAR(120)  NOT NULL DEFAULT '',
    size_bytes       BIGINT        NOT NULL CHECK (size_bytes > 0),
    storage_key      VARCHAR(255)  NOT NULL DEFAULT '',
    url              TEXT          NOT NULL,
    uploaded_by      VARCHAR(36)   NOT NULL DEFAULT '',
    uploaded_by_role VARCHAR(20)   NOT NULL DEFAULT '',
    created_at       TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_evidence_return_created_at
ON return_evidence(return_id, created_at DESC);
