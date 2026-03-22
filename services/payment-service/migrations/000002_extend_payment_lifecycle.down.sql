DROP INDEX IF EXISTS idx_payments_gateway_order_id;
DROP INDEX IF EXISTS idx_payments_reference_payment_id;
DROP INDEX IF EXISTS idx_payments_order_created_at;

ALTER TABLE payments
    DROP COLUMN IF EXISTS order_total,
    DROP COLUMN IF EXISTS transaction_type,
    DROP COLUMN IF EXISTS reference_payment_id,
    DROP COLUMN IF EXISTS gateway_provider,
    DROP COLUMN IF EXISTS gateway_transaction_id,
    DROP COLUMN IF EXISTS gateway_order_id,
    DROP COLUMN IF EXISTS checkout_url,
    DROP COLUMN IF EXISTS signature_verified,
    DROP COLUMN IF EXISTS failure_reason;

ALTER TABLE payments
    ADD CONSTRAINT payments_order_id_key UNIQUE (order_id);
