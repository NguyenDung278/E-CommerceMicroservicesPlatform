# Payment Idempotency Scaffold

Tài liệu này chốt hướng triển khai `payment idempotency` theo đúng boundary hiện tại của repo: xử lý trong `payment-service`, lưu state ở PostgreSQL, không đẻ thêm Redis lock hay service mới cho một nhu cầu chưa cần đến.

## Mục tiêu của scaffold hiện tại

- chấp nhận header `Idempotency-Key` ở `POST /api/v1/payments`
- lưu một bản ghi idempotency bền vững theo cặp `(user_id, idempotency_key)`
- trả về đúng payment cũ nếu cùng key được gửi lại với cùng payload
- chặn reuse cùng key cho payload khác
- giữ phần lưu payment và lưu key trong cùng transaction repository

## Những gì code hiện tại đã làm

1. Handler đọc `Idempotency-Key` và chuyển xuống service.
2. Service hash payload thanh toán theo `order_id`, `payment_method`, `amount`.
3. Nếu key đã tồn tại:
   - cùng hash: trả về payment đã tạo trước đó
   - khác hash: trả `409 Conflict`
4. Nếu key chưa tồn tại:
   - xử lý payment như cũ
   - repository insert payment, outbox và bản ghi idempotency trong cùng transaction

## Những gì chưa cố gắng giải quyết hết trong scaffold này

- chưa chuẩn hoá response metadata kiểu `replayed=true` cho client
- chưa bổ sung idempotency cho webhook path và refund path
- chưa có audit trail riêng cho các replay request
- chưa có benchmark cho collision/replay under load

## Bước tiếp theo nên làm

1. Trả thêm header hoặc meta field để client biết response là replay.
2. Mở rộng idempotency sang refund và webhook callback.
3. Thêm integration test với PostgreSQL thật cho race giữa 2 request cùng key.
4. Đo latency của luồng replay so với create path bằng benchmark hoặc tracing label.
