CREATE TABLE IF NOT EXISTS outbox_events (
    id             VARCHAR(36)  PRIMARY KEY,
    aggregate_type VARCHAR(50)  NOT NULL,
    aggregate_id   VARCHAR(36)  NOT NULL,
    event_type     VARCHAR(80)  NOT NULL,
    routing_key    VARCHAR(120) NOT NULL,
    payload        JSONB        NOT NULL,
    request_id     VARCHAR(120),
    attempts       INTEGER      NOT NULL DEFAULT 0,
    last_error     TEXT         NOT NULL DEFAULT '',
    available_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    published_at   TIMESTAMP,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_pending
ON outbox_events (available_at, created_at)
WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS inbox_messages (
    consumer    VARCHAR(80)  NOT NULL,
    message_id  VARCHAR(120) NOT NULL,
    routing_key VARCHAR(120) NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (consumer, message_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_created_at
ON inbox_messages (created_at);
