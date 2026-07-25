ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS stock_released_at TIMESTAMP NULL;

-- Đơn cancelled trước migration này đã được hoàn kho theo cơ chế restore cũ;
-- đánh dấu released để worker mới không quét lại chúng. Kể cả khi sót, release
-- qua ledger stock_reservations cũng chỉ là no-op vì đơn cũ không có ledger row.
UPDATE orders
SET stock_released_at = updated_at
WHERE status = 'cancelled' AND stock_released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_cancelled_pending_stock_release
    ON orders(updated_at)
    WHERE status = 'cancelled' AND stock_released_at IS NULL;
