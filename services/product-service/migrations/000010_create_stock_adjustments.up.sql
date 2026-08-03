-- Sổ cái mọi lần tồn kho thay đổi ngoài luồng bán hàng: nhập hàng về, kiểm kê
-- lệch, hàng hỏng phải loại, khách trả về nhập lại kho.
--
-- VÌ SAO CẦN BẢNG NÀY: trước đây tồn kho chỉ có đường GIẢM (reservation lúc
-- checkout) mà không có đường TĂNG nào qua API. Sửa thẳng `products.stock` bằng
-- endpoint update sản phẩm thì mất dấu vết: không biết ai sửa, sửa vì lý do gì,
-- và không đối chiếu được khi kiểm kê lệch.
--
-- delta âm là xuất kho, dương là nhập kho. resulting_stock chốt lại tồn kho của
-- đúng bể bị tác động NGAY SAU khi áp delta, để về sau dựng lại được lịch sử mà
-- không phải cộng dồn từ đầu.
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id              VARCHAR(36)  PRIMARY KEY,
    product_id      VARCHAR(36)  NOT NULL,
    -- sku rỗng nghĩa là điều chỉnh bể tồn kho mức sản phẩm, chỉ hợp lệ với sản
    -- phẩm không khai báo variant. Giống hệt quy ước ở stock_reservations.
    sku             VARCHAR(120) NOT NULL DEFAULT '',
    delta           INT          NOT NULL CHECK (delta <> 0),
    resulting_stock INT          NOT NULL CHECK (resulting_stock >= 0),
    reason          VARCHAR(40)  NOT NULL,
    note            VARCHAR(255) NOT NULL DEFAULT '',
    actor_id        VARCHAR(36)  NOT NULL DEFAULT '',
    actor_role      VARCHAR(20)  NOT NULL DEFAULT '',
    -- Khoá chống double-submit. Nhập kho bị lặp vì bấm nút hai lần sẽ thổi phồng
    -- tồn kho một cách âm thầm, nên client gửi Idempotency-Key và lần gửi lại
    -- cùng key trả về đúng bản ghi cũ thay vì cộng thêm lần nữa.
    idempotency_key VARCHAR(128) NOT NULL DEFAULT '',
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_created_at
    ON stock_adjustments (product_id, created_at DESC);

-- Unique một phần: chỉ ràng buộc khi client thực sự gửi idempotency key, để các
-- điều chỉnh không kèm key vẫn ghi được nhiều lần.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_adjustments_idempotency_key
    ON stock_adjustments (idempotency_key)
    WHERE idempotency_key <> '';
