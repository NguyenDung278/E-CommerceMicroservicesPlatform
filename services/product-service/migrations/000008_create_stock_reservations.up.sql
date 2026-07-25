-- Ledger giữ chỗ tồn kho theo order. Mỗi dòng là một line item đã trừ kho
-- vật lý cho một order; order_id là idempotency key của toàn bộ reservation:
-- reserve replay không được trừ kho lần hai, release replay không được cộng
-- kho lần hai.
CREATE TABLE IF NOT EXISTS stock_reservations (
    order_id    VARCHAR(64) NOT NULL,
    product_id  VARCHAR(64) NOT NULL,
    quantity    INT         NOT NULL CHECK (quantity > 0),
    status      VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    released_at TIMESTAMP   NULL,
    PRIMARY KEY (order_id, product_id)
);
