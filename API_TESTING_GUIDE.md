# API Testing Guide

Tài liệu này hướng dẫn test HTTP API backend qua `api-gateway` theo trạng thái source hiện tại. Mục tiêu:

- test đúng public route đang được gateway expose
- bám đúng contract handler/service hiện có
- verify happy path, auth path, admin path, idempotency path và async path quan trọng
- không dùng route cũ hoặc route chưa được gateway expose làm contract

Collection và environment starter:

- `postman/ecommerce-platform-local.postman_collection.json`
- `postman/ecommerce-platform-local.postman_environment.json`

---

## 1. Source Of Truth Khi Test API

Khi tài liệu và code lệch nhau, ưu tiên kiểm tra:

- `api-gateway/internal/handler/*.go`
- `api-gateway/internal/proxy/*.go`
- `services/*-service/internal/handler/*.go`
- `services/*-service/internal/service/`
- `services/*-service/internal/repository/`
- `pkg/response`

Public HTTP entrypoint:

```text
http://localhost:8080
```

Tất cả request public nên đi qua gateway thay vì gọi trực tiếp service nội bộ.

---

## 2. Phạm Vi

Guide này tập trung vào HTTP API có thể test trực tiếp:

- auth, token, OAuth exchange
- user profile, email verification, phone verification
- addresses, wishlist
- product catalog, product detail, reviews, upload
- cart
- order preview, order create, order history, order events
- returns, evidence upload, refund queue
- coupons, admin order/report
- payments, refunds, webhook MoMo và VNPay

Không test trực tiếp bằng Postman:

- gRPC nội bộ giữa service
- outbox/inbox internals
- RabbitMQ consumer internals
- worker loop internals

Các phần async nên verify gián tiếp bằng API trạng thái, log, trace và database.

---

## 3. Chuẩn Bị Runtime

Từ root repo:

```bash
cp .env.local.example .env.local
make compose-up
```

Kiểm tra nhanh:

```bash
curl http://localhost:8080/health
curl http://localhost/health
```

URL backend/runtime:

- `http://localhost:8080`: API Gateway
- `http://localhost`: Nginx edge proxy cho `/api/*` và `/health`
- `http://localhost:16686`: Jaeger trace viewer
- `http://localhost:9000`: MinIO API
- `http://localhost:9001`: MinIO Console
- `http://localhost:9200`: Elasticsearch

Lưu ý:

- PostgreSQL, Redis, RabbitMQ, Prometheus và Grafana không publish ra host trong compose mặc định.
- Service nội bộ nên được gọi qua gateway khi test public API.

---

## 4. Tài Khoản Test Local

Nếu `user-service` bật bootstrap dev accounts, local thường có:

- `admin.dev@ndshop.local` / `AdminTest!2026-ChangeMe`
- `staff.dev@ndshop.local` / `StaffTest!2026-ChangeMe`

Dùng các tài khoản này để test:

- `/api/v1/admin/users`
- `/api/v1/admin/orders`
- `/api/v1/admin/returns`
- `/api/v1/admin/coupons`
- `/api/v1/admin/payments`

Nếu bootstrap tắt, đăng ký user thường rồi seed role admin/staff bằng DB hoặc API admin phù hợp.

---

## 5. Postman Environment

Biến nên có:

| Biến                      | Mục đích                       |
| ------------------------- | ------------------------------ |
| `base_url`                | `http://localhost:8080`        |
| `access_token`            | token user thường              |
| `admin_access_token`      | token admin/staff              |
| `refresh_token`           | refresh token                  |
| `user_id`                 | user hiện tại                  |
| `product_id`              | sản phẩm đang test             |
| `order_id`                | đơn hàng đang test             |
| `payment_id`              | payment đang test              |
| `address_id`              | địa chỉ đã tạo                 |
| `return_id`               | return request đã tạo          |
| `coupon_code`             | coupon admin đã tạo            |
| `order_idempotency_key`   | key test create-order replay   |
| `payment_idempotency_key` | key test payment/refund replay |
| `oauth_ticket`            | ticket cho OAuth exchange      |

Header thường dùng:

```text
Content-Type: application/json
Accept: application/json
Authorization: Bearer {{access_token}}
```

Header admin:

```text
Authorization: Bearer {{admin_access_token}}
```

---

## 6. Response Envelope

Thành công:

```json
{
  "success": true,
  "message": "message",
  "data": {},
  "error": null,
  "meta": null
}
```

Lỗi:

```json
{
  "success": false,
  "message": "validation failed",
  "error": "safe error"
}
```

Khi test, verify:

- HTTP status
- `success`
- `message`
- shape của `data`
- `error` không leak chi tiết nội bộ
- `meta` đúng kiểu pagination nếu là list endpoint

---

## 7. Route Map Qua Gateway

### 7.1 Auth

| Method | Route                                    |
| ------ | ---------------------------------------- |
| `POST` | `/api/v1/auth/register`                  |
| `POST` | `/api/v1/auth/register/email/send-otp`   |
| `POST` | `/api/v1/auth/register/email/verify-otp` |
| `POST` | `/api/v1/auth/register/email/resend-otp` |
| `POST` | `/api/v1/auth/register/phone/send-otp`   |
| `POST` | `/api/v1/auth/register/phone/verify-otp` |
| `POST` | `/api/v1/auth/register/phone/resend-otp` |
| `POST` | `/api/v1/auth/login`                     |
| `POST` | `/api/v1/auth/refresh`                   |
| `POST` | `/api/v1/auth/verify-email`              |
| `POST` | `/api/v1/auth/forgot-password`           |
| `POST` | `/api/v1/auth/reset-password`            |
| `GET`  | `/api/v1/auth/oauth/google/start`        |
| `GET`  | `/api/v1/auth/oauth/google/callback`     |
| `POST` | `/api/v1/auth/oauth/exchange`            |

### 7.2 Users

| Method   | Route                                                 |
| -------- | ----------------------------------------------------- |
| `GET`    | `/api/v1/users/profile`                               |
| `PUT`    | `/api/v1/users/profile`                               |
| `POST`   | `/api/v1/users/avatar`                                |
| `PUT`    | `/api/v1/users/password`                              |
| `GET`    | `/api/v1/users/profile/phone-verification`            |
| `POST`   | `/api/v1/users/profile/phone-verification/send-otp`   |
| `POST`   | `/api/v1/users/profile/phone-verification/verify-otp` |
| `POST`   | `/api/v1/users/profile/phone-verification/resend-otp` |
| `GET`    | `/api/v1/users/verify-email/status`                   |
| `POST`   | `/api/v1/users/verify-email/send-otp`                 |
| `POST`   | `/api/v1/users/verify-email/verify-otp`               |
| `POST`   | `/api/v1/users/verify-email/resend-otp`               |
| `POST`   | `/api/v1/users/verify-email/resend`                   |
| `POST`   | `/api/v1/users/addresses`                             |
| `GET`    | `/api/v1/users/addresses`                             |
| `PUT`    | `/api/v1/users/addresses/:id`                         |
| `DELETE` | `/api/v1/users/addresses/:id`                         |
| `PUT`    | `/api/v1/users/addresses/:id/default`                 |
| `GET`    | `/api/v1/users/wishlist`                              |
| `POST`   | `/api/v1/users/wishlist`                              |
| `POST`   | `/api/v1/users/wishlist/sync`                         |
| `DELETE` | `/api/v1/users/wishlist/:productId`                   |

### 7.3 Products And Reviews

| Method   | Route                             |
| -------- | --------------------------------- |
| `GET`    | `/api/v1/products`                |
| `GET`    | `/api/v1/products/batch`          |
| `GET`    | `/api/v1/products/search/assist`  |
| `GET`    | `/api/v1/products/:id`            |
| `GET`    | `/api/v1/products/:id/reviews`    |
| `POST`   | `/api/v1/products`                |
| `POST`   | `/api/v1/products/uploads`        |
| `PUT`    | `/api/v1/products/:id`            |
| `DELETE` | `/api/v1/products/:id`            |
| `GET`    | `/api/v1/products/:id/reviews/me` |
| `POST`   | `/api/v1/products/:id/reviews`    |
| `PUT`    | `/api/v1/products/:id/reviews/me` |
| `DELETE` | `/api/v1/products/:id/reviews/me` |

### 7.4 Catalog Aggregation

| Method | Route                                       |
| ------ | ------------------------------------------- |
| `GET`  | `/api/v1/storefront/home`                   |
| `GET`  | `/api/v1/storefront/categories`             |
| `GET`  | `/api/v1/storefront/categories/:identifier` |
| `GET`  | `/api/v1/catalog/popularity`                |

### 7.5 Cart

| Method   | Route                           |
| -------- | ------------------------------- |
| `GET`    | `/api/v1/cart`                  |
| `DELETE` | `/api/v1/cart`                  |
| `POST`   | `/api/v1/cart/merge`            |
| `POST`   | `/api/v1/cart/items`            |
| `PUT`    | `/api/v1/cart/items/:productId` |
| `DELETE` | `/api/v1/cart/items/:productId` |

### 7.6 Orders, Returns, Coupons

| Method | Route                                   |
| ------ | --------------------------------------- |
| `GET`  | `/api/v1/coupons/public`                |
| `POST` | `/api/v1/orders/preview`                |
| `POST` | `/api/v1/orders`                        |
| `GET`  | `/api/v1/orders/summary`                |
| `GET`  | `/api/v1/orders`                        |
| `GET`  | `/api/v1/orders/:id/events`             |
| `GET`  | `/api/v1/orders/:id/tracking`           |
| `GET`  | `/api/v1/orders/:id/return-eligibility` |
| `GET`  | `/api/v1/orders/:id`                    |
| `PUT`  | `/api/v1/orders/:id/cancel`             |
| `POST` | `/api/v1/orders/:id/returns`            |
| `GET`  | `/api/v1/orders/:id/returns`            |
| `GET`  | `/api/v1/returns`                       |
| `GET`  | `/api/v1/returns/:id`                   |
| `POST` | `/api/v1/returns/:id/evidence`          |
| `GET`  | `/api/v1/admin/orders/report`           |
| `GET`  | `/api/v1/admin/orders`                  |
| `GET`  | `/api/v1/admin/orders/:id/events`       |
| `GET`  | `/api/v1/admin/orders/:id/tracking`     |
| `PUT`  | `/api/v1/admin/orders/:id/tracking`     |
| `GET`  | `/api/v1/admin/orders/:id`              |
| `PUT`  | `/api/v1/admin/orders/:id/cancel`       |
| `PUT`  | `/api/v1/admin/orders/:id/status`       |
| `GET`  | `/api/v1/admin/returns`                 |
| `GET`  | `/api/v1/admin/returns/health`          |
| `PUT`  | `/api/v1/admin/returns/:id/status`      |
| `POST` | `/api/v1/admin/returns/:id/refund`      |
| `POST` | `/api/v1/admin/coupons`                 |
| `GET`  | `/api/v1/admin/coupons`                 |

### 7.7 Payments

| Method | Route                                           |
| ------ | ----------------------------------------------- |
| `POST` | `/api/v1/payments`                              |
| `GET`  | `/api/v1/payments/history`                      |
| `GET`  | `/api/v1/payments/:id`                          |
| `GET`  | `/api/v1/payments/order/:orderId`               |
| `GET`  | `/api/v1/payments/order/:orderId/history`       |
| `POST` | `/api/v1/payments/webhooks/momo`                |
| `POST` | `/api/v1/payments/webhooks/vnpay`               |
| `GET`  | `/api/v1/payments/webhooks/vnpay`               |
| `GET`  | `/api/v1/admin/payments/history`                |
| `GET`  | `/api/v1/admin/payments/order/:orderId/history` |
| `POST` | `/api/v1/admin/payments/:id/refunds`            |

Không dùng `GET /api/v1/payments/:id/verify` làm contract nếu gateway handler chưa expose route này.

---

## 8. Smoke Test Tối Thiểu

1. `GET /health`
2. `POST /api/v1/auth/login`
3. `GET /api/v1/users/profile`
4. `GET /api/v1/products`
5. `GET /api/v1/cart`
6. `POST /api/v1/orders/preview`
7. `POST /api/v1/orders` với `Idempotency-Key`
8. `POST /api/v1/payments` với `Idempotency-Key`

---

## 9. Flow Cần Test Kỹ

### 9.1 Auth

- register thành công
- login thành công
- refresh token
- forgot/reset password
- verify email send/resend/verify
- phone verification send/resend/verify

### 9.2 Product Catalog

- list products với filter
- cursor pagination
- get product detail
- search assist
- create/update/delete product bằng admin hoặc staff
- upload image
- review create/update/delete

### 9.3 Cart And Checkout

- get cart
- add item
- update quantity
- remove item
- clear cart
- merge cart
- preview order
- create order
- cancel order

### 9.4 Payment And Refund

- create payment cho order hợp lệ
- payment history
- get payment by id
- refund qua admin
- webhook MoMo với signature đúng/sai
- replay cùng `Idempotency-Key`

### 9.5 Returns

- create return request
- list returns
- get return detail
- upload evidence
- admin list return queue
- admin update return status
- admin queue refund
- refund worker success/failure path qua DB/log

---

## 10. Negative Tests

- thiếu token
- token sai role
- body thiếu field bắt buộc
- ID không tồn tại
- quantity âm hoặc bằng 0
- coupon không hợp lệ
- create payment cho order không thuộc actor hiện tại
- refund vượt số tiền cho phép
- webhook signature sai

---

## 11. Audit-Level Test Cases

### 11.1 Order Idempotency Replay

1. Gửi `POST /api/v1/orders` với `Idempotency-Key`.
2. Gửi lại đúng body và đúng key.
3. Gửi lại body khác với đúng key.

Kỳ vọng:

- request 1 tạo order thành công
- request 2 replay an toàn, không tạo order mới
- request 3 trả idempotency conflict

### 11.2 Payment Create And Refund Idempotency

1. `POST /api/v1/payments` với `Idempotency-Key`.
2. Replay cùng body.
3. Replay body khác cùng key.
4. `POST /api/v1/admin/payments/:id/refunds` với `Idempotency-Key`.
5. Replay refund request giống hệt.

Kỳ vọng:

- cùng key và cùng payload replay an toàn
- cùng key và khác payload trả conflict

### 11.3 Product Cursor Pagination

1. `GET /api/v1/products?limit=5`
2. Lấy `meta.next_cursor`.
3. Gọi `GET /api/v1/products?limit=5&cursor={{next_cursor}}`.
4. Thử đổi sort rồi reuse cursor cũ.

Kỳ vọng:

- không duplicate item giữa các trang
- `has_next` và `next_cursor` hợp lý
- reuse cursor sai sort trả invalid cursor

### 11.4 Return Evidence Upload

Route:

```text
POST /api/v1/returns/:id/evidence
```

Yêu cầu:

- dùng `multipart/form-data`
- field file là `evidence`
- file ảnh nhỏ hợp lệ

Kỳ vọng:

- response thành công
- payload có evidence data
- timeline/event của return có mốc upload evidence

### 11.5 Webhook Replay And Signature Failure

1. Gửi webhook payload hợp lệ.
2. Gửi lại payload hợp lệ lần hai.
3. Gửi payload với signature sai.

Kỳ vọng:

- lần đầu cập nhật payment state đúng
- replay không nhân đôi transition/outbox effect
- signature sai bị reject

### 11.6 Concurrent Checkout Không Oversell

Bài này chạy tự động bằng k6, không cần Postman:

```bash
./tests/load/run_oversell.sh   # stack phải đang chạy, cần k6
```

Script seed một sản phẩm stock nhỏ, bắn N request `POST /api/v1/orders` đồng
thời (mỗi request một `Idempotency-Key` khác nhau) rồi verify DB.

Kỳ vọng:

- số đơn tạo thành công đúng bằng stock ban đầu
- `products.stock` về 0, không âm
- ledger `stock_reservations` active khớp đúng tổng đã giữ
- request thua trả lỗi nghiệp vụ 4xx `insufficient stock`, không có 5xx

Chi tiết ở `tests/load/README.md`.

---

## 12. Verify Async Flow

Với payment event, return refund queue, notification:

- kiểm tra `GET /api/v1/orders/:id/events`
- kiểm tra `GET /api/v1/payments/order/:orderId/history`
- kiểm tra `GET /api/v1/admin/returns/health`
- kiểm tra log `order-service`, `payment-service`, `notification-service`
- dùng Jaeger khi nghi flow qua nhiều boundary

Log:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f order-service payment-service notification-service
```

---

## 13. DB Verification

### Sau create order

- `orders`
- `order_items`
- `order_events`
- `order_idempotency_keys`
- `outbox_events`

### Sau create payment hoặc refund

- `payments`
- `payment_idempotency_keys`
- `outbox_events`
- `audit_entries`

### Sau webhook

- `payments.status`
- `inbox_messages`
- `outbox_events`
- `orders.status` nếu flow đã sync sang order

### Sau queue refund return

- `returns`
- `refund_attempt_count`
- `refund_last_error`
- `refund_next_retry_at`
- `refund_processing_started_at`

---

## 14. Cách Cập Nhật Guide

Khi thêm hoặc sửa backend API:

1. rà gateway route trước
2. rà service handler tương ứng
3. cập nhật route map trong guide này
4. thêm happy path và negative path
5. thêm replay/retry test nếu có idempotency hoặc async side effect
6. cập nhật DB/log verification nếu flow ghi dữ liệu mới
