ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_order_id_key;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS order_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(20) NOT NULL DEFAULT 'charge',
    ADD COLUMN IF NOT EXISTS reference_payment_id VARCHAR(36),
    ADD COLUMN IF NOT EXISTS gateway_provider VARCHAR(50) NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS gateway_transaction_id VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS checkout_url VARCHAR(500) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(255) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_payments_order_created_at ON payments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_reference_payment_id ON payments(reference_payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_order_id
ON payments(gateway_order_id)
WHERE gateway_order_id <> '';
