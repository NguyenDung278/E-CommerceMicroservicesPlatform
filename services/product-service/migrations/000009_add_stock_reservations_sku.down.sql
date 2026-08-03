-- Quay lại ledger khoá theo (order_id, product_id). Nếu đang tồn tại order giữ
-- chỗ nhiều variant của cùng một sản phẩm thì các dòng đó trùng khoá cũ, nên
-- gộp chúng lại thành một dòng trước khi dựng lại primary key.
DELETE FROM stock_reservations a
USING stock_reservations b
WHERE a.order_id = b.order_id
  AND a.product_id = b.product_id
  AND a.sku > b.sku;

ALTER TABLE stock_reservations DROP CONSTRAINT IF EXISTS stock_reservations_pkey;
ALTER TABLE stock_reservations ADD PRIMARY KEY (order_id, product_id);
ALTER TABLE stock_reservations DROP COLUMN IF EXISTS sku;
