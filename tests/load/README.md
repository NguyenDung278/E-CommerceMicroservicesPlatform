# Load test — chứng minh không oversell

Bộ test này trả lời một câu hỏi duy nhất: **khi N người cùng lúc checkout một
sản phẩm chỉ còn `STOCK` cái, hệ thống có bán quá số tồn kho không?**

Cơ chế được test là inventory reservation ở checkout:

- `order-service` gọi gRPC `ReserveStock` (all-or-nothing, idempotent theo
  `order_id`) sang `product-service`
- `product-service` trừ kho bằng compare-and-set
  (`UPDATE products SET stock = stock - $1 WHERE stock >= $1`) và ghi ledger
  `stock_reservations` trong cùng transaction
- đơn pending không thanh toán trong 15 phút bị worker
  (`StartReservationExpiryWorker`) hủy và trả kho qua `ReleaseStock` idempotent

## Chạy

```bash
# 1. stack phải đang chạy
make compose-up

# 2. chạy trọn gói: seed sản phẩm → bắn k6 → verify DB
./tests/load/run_oversell.sh

# tùy biến
STOCK=10 VUS=50 ITERATIONS=200 ./tests/load/run_oversell.sh
```

Yêu cầu: `k6` (`brew install k6`), Docker đang chạy.

## Kỳ vọng

| Số liệu | Kỳ vọng |
| --- | --- |
| `successful_orders` (k6 threshold) | đúng bằng `STOCK` |
| `unexpected_errors` (k6 threshold) | 0 — hết hàng phải là 4xx nghiệp vụ, không phải 5xx |
| `products.stock` sau khi bắn | 0 |
| Tổng `quantity` ledger `stock_reservations` active | `STOCK` |
| Số đơn `pending` chứa sản phẩm test | `STOCK` |

`run_oversell.sh` tự verify 3 dòng cuối bằng SQL và in PASS/FAIL.

## Ghi chú

- Mỗi request dùng `Idempotency-Key` ngẫu nhiên để mô phỏng N người khác nhau;
  replay cùng key là bài test khác (xem `API_TESTING_GUIDE.md` §11.1).
- Response 429 (rate limiter ở gateway) được đếm riêng, không tính là lỗi;
  nếu 429 quá nhiều làm số request thật xuống dưới `STOCK`, giảm `VUS` xuống.
- Sản phẩm seed mang prefix `oversell-` trong `ecommerce_product`; đơn tạo ra sẽ
  bị reservation expiry worker tự hủy sau 15 phút và trả kho — đó cũng là một
  cách quan sát worker hoạt động thật.
