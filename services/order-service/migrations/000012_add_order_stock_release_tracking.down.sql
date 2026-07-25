DROP INDEX IF EXISTS idx_orders_cancelled_pending_stock_release;

ALTER TABLE orders
    DROP COLUMN IF EXISTS stock_released_at;
