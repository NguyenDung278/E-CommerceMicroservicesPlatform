CREATE TABLE IF NOT EXISTS product_search_event_metrics (
    day_bucket DATE NOT NULL,
    source VARCHAR(32) NOT NULL,
    event_kind VARCHAR(32) NOT NULL,
    query_normalized VARCHAR(255) NOT NULL DEFAULT '',
    query_display VARCHAR(255) NOT NULL DEFAULT '',
    category VARCHAR(120) NOT NULL DEFAULT '',
    filter_key VARCHAR(64) NOT NULL DEFAULT '',
    filter_value VARCHAR(255) NOT NULL DEFAULT '',
    event_count INTEGER NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (day_bucket, source, event_kind, query_normalized, category, filter_key, filter_value)
);

CREATE INDEX IF NOT EXISTS idx_product_search_event_metrics_last_seen
    ON product_search_event_metrics (last_seen_at DESC);
