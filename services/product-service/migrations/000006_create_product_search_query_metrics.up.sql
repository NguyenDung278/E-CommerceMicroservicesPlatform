CREATE TABLE IF NOT EXISTS product_search_query_metrics (
    day_bucket DATE NOT NULL,
    source VARCHAR(32) NOT NULL,
    query_normalized TEXT NOT NULL,
    query_display TEXT NOT NULL,
    category VARCHAR(120) NOT NULL DEFAULT '',
    request_count INTEGER NOT NULL DEFAULT 0,
    zero_result_count INTEGER NOT NULL DEFAULT 0,
    total_result_count INTEGER NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (day_bucket, source, query_normalized, category)
);

CREATE INDEX IF NOT EXISTS idx_product_search_query_metrics_last_seen
    ON product_search_query_metrics (last_seen_at DESC);
