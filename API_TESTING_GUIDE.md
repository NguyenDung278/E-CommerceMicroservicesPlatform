# API Testing Guide

Tài liệu này hướng dẫn test HTTP API của repo theo trạng thái source hiện tại. Mục tiêu là:

- test đúng qua `api-gateway`
- bám đúng route thật đang được expose
- có một thứ tự test đủ thực dụng để dev mới không bị ngợp
- giúp bạn verify cả happy path, auth path, admin path, và các luồng async quan trọng

Guide này không cố thay Postman collection chi tiết đến từng request nhỏ. Nó đóng vai trò như một playbook để bạn tự dựng collection, hoặc dùng làm checklist smoke test mỗi khi sửa backend/frontend.

Collection và environment starter hiện có sẵn tại:

- `postman/ecommerce-platform-local.postman_collection.json`
- `postman/ecommerce-platform-local.postman_environment.json`

Checklist verify theo flow hiện có tại:

- `docs/learning/README.md`

---

## 1. Source Of Truth Khi Test API

Khi tài liệu và code lệch nhau, hãy tin các file sau:

- `api-gateway/internal/handler/*.go`: route public thật
- `services/*-service/internal/handler/*.go`: contract service thật
- `frontend/src/services/api/`: các route mà frontend hiện đang gọi

Hiện tại, public HTTP entrypoint chuẩn để test là:

```text
http://localhost:8080
```

Tất cả request public nên đi qua gateway thay vì gọi trực tiếp từng service nội bộ.

---

## 2. Phạm Vi Của Guide

Guide này tập trung vào HTTP API có thể test trực tiếp:

- auth và user profile
- email verification và phone verification
- wishlist và addresses
- storefront data
- products và reviews
- cart
- orders, returns, coupons, admin order/report
- payments, refunds, webhook

Không nằm trong phạm vi test trực tiếp bằng Postman:

- gRPC nội bộ giữa `cart-service` / `order-service` và `product-service`
- outbox / inbox internals
- RabbitMQ consumer của `notification-service`

Các phần async vẫn có thể kiểm tra gián tiếp qua:

- order status
- payment history
- return / refund status
- log và trace

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
curl http://localhost:4173/health
```

Các URL hay dùng:

- `http://localhost:8080`: API Gateway
- `http://localhost:4173`: frontend Docker
- `http://localhost:5174`: frontend Vite dev nếu bạn chạy `make frontend-dev`
- `http://localhost:16686`: Jaeger

Lưu ý:

- `http://localhost` là nginx edge proxy, không phải UI chính
- Postgres/Redis/RabbitMQ không publish ra host trong compose mặc định

---

## 4. Tài Khoản Test Local

Nếu `user-service` bật bootstrap dev accounts, local thường có sẵn:

- `admin.dev@ndshop.local` / `AdminTest!2026-ChangeMe`
- `staff.dev@ndshop.local` / `StaffTest!2026-ChangeMe`

Những tài khoản này hữu ích để test:

- `/api/v1/admin/users`
- `/api/v1/admin/orders`
- `/api/v1/admin/returns`
- `/api/v1/admin/coupons`
- `/api/v1/admin/payments`

Nếu bootstrap đang tắt, hãy tự đăng ký user thường rồi seed thêm role admin bằng DB hoặc API admin phù hợp.

---

## 5. Postman Environment Gợi Ý

Tạo environment tên `ecommerce-local` với các biến sau:

| Biến | Mục đích |
| --- | --- |
| `base_url` | `http://localhost:8080` |
| `access_token` | token user thường |
| `admin_access_token` | token admin/staff |
| `refresh_token` | refresh token nếu cần verify flow refresh |
| `user_id` | user hiện tại |
| `product_id` | sản phẩm đang test |
| `order_id` | đơn hàng đang test |
| `payment_id` | payment đang test |
| `address_id` | địa chỉ đã tạo |
| `return_id` | return request đã tạo |
| `coupon_code` | coupon admin đã tạo |
| `order_idempotency_key` | dùng cho create-order replay testing |
| `payment_idempotency_key` | dùng cho payment/refund replay testing |
| `oauth_ticket` | dùng khi test OAuth exchange |

Header hay dùng:

```text
Content-Type: application/json
Accept: application/json
Authorization: Bearer {{access_token}}
```

Với admin:

```text
Authorization: Bearer {{admin_access_token}}
```

---

## 6. Chuẩn Response Cần Verify

Repo dùng response envelope thống nhất qua `pkg/response`.

Thành công:

```json
{
  "success": true,
  "message": "human-readable message",
  "data": {},
  "error": null,
  "meta": null
}
```

Khi lỗi:

```json
{
  "success": false,
  "message": "validation failed",
  "error": "email already exists"
}
```

Khi list endpoint có phân trang:

- một số endpoint dùng `page/limit/total`
- product listing public dùng `limit/next_cursor/has_next`

Khi test, đừng chỉ nhìn `200 OK`. Hãy verify thêm:

- `success`
- `message`
- shape của `data`
- `meta` có đúng kiểu pagination không

---

## 7. Thứ Tự Test Khuyến Nghị

Nếu bạn đang dựng collection mới, hãy test theo đúng thứ tự này.

### 7.1. Smoke Test

1. `GET /health`
2. `POST /api/v1/auth/login`
3. `GET /api/v1/users/profile`
4. `GET /api/v1/products`
5. `GET /api/v1/storefront/home`

### 7.2. User Journey Cơ Bản

1. register hoặc login
2. verify email status
3. phone verification status/send/resend/verify
4. create/list address
5. list products
6. add to cart
7. preview order
8. create order với `Idempotency-Key`
9. retry create order với cùng `Idempotency-Key` để verify replay
10. create payment với `Idempotency-Key`
11. retry payment với cùng `Idempotency-Key` để verify replay
12. get payment history

### 7.3. Admin Journey

1. admin login
2. list products / create product / upload image
3. list users / đổi role
4. create coupon / list coupon
5. list orders / update status
6. list returns / refund return
7. list payments / refund payment

---

## 8. Route Map Hiện Tại Theo Gateway

Đây là các route group thật đang được expose bởi gateway.

### 8.1. Auth

| Method | Route |
| --- | --- |
| `POST` | `/api/v1/auth/register` |
| `POST` | `/api/v1/auth/register/email/send-otp` |
| `POST` | `/api/v1/auth/register/email/verify-otp` |
| `POST` | `/api/v1/auth/register/email/resend-otp` |
| `POST` | `/api/v1/auth/register/phone/send-otp` |
| `POST` | `/api/v1/auth/register/phone/verify-otp` |
| `POST` | `/api/v1/auth/register/phone/resend-otp` |
| `POST` | `/api/v1/auth/login` |
| `POST` | `/api/v1/auth/refresh` |
| `POST` | `/api/v1/auth/verify-email` |
| `POST` | `/api/v1/auth/forgot-password` |
| `POST` | `/api/v1/auth/reset-password` |
| `GET` | `/api/v1/auth/oauth/google/start` |
| `GET` | `/api/v1/auth/oauth/google/callback` |
| `POST` | `/api/v1/auth/oauth/exchange` |

### 8.2. Users

| Method | Route |
| --- | --- |
| `GET` | `/api/v1/users/profile` |
| `PUT` | `/api/v1/users/profile` |
| `POST` | `/api/v1/users/avatar` |
| `PUT` | `/api/v1/users/password` |
| `GET` | `/api/v1/users/profile/phone-verification` |
| `POST` | `/api/v1/users/profile/phone-verification/send-otp` |
| `POST` | `/api/v1/users/profile/phone-verification/verify-otp` |
| `POST` | `/api/v1/users/profile/phone-verification/resend-otp` |
| `GET` | `/api/v1/users/verify-email/status` |
| `POST` | `/api/v1/users/verify-email/send-otp` |
| `POST` | `/api/v1/users/verify-email/verify-otp` |
| `POST` | `/api/v1/users/verify-email/resend-otp` |
| `POST` | `/api/v1/users/verify-email/resend` |
| `POST` | `/api/v1/users/addresses` |
| `GET` | `/api/v1/users/addresses` |
| `PUT` | `/api/v1/users/addresses/:id` |
| `DELETE` | `/api/v1/users/addresses/:id` |
| `PUT` | `/api/v1/users/addresses/:id/default` |
| `GET` | `/api/v1/users/wishlist` |
| `POST` | `/api/v1/users/wishlist` |
| `POST` | `/api/v1/users/wishlist/sync` |
| `DELETE` | `/api/v1/users/wishlist/:productId` |

### 8.3. Products And Reviews

| Method | Route |
| --- | --- |
| `GET` | `/api/v1/products` |
| `GET` | `/api/v1/products/batch` |
| `GET` | `/api/v1/products/search/assist` |
| `GET` | `/api/v1/products/:id` |
| `GET` | `/api/v1/products/:id/reviews` |
| `POST` | `/api/v1/products` |
| `POST` | `/api/v1/products/uploads` |
| `PUT` | `/api/v1/products/:id` |
| `DELETE` | `/api/v1/products/:id` |
| `GET` | `/api/v1/products/:id/reviews/me` |
| `POST` | `/api/v1/products/:id/reviews` |
| `PUT` | `/api/v1/products/:id/reviews/me` |
| `DELETE` | `/api/v1/products/:id/reviews/me` |

### 8.4. Storefront

| Method | Route |
| --- | --- |
| `GET` | `/api/v1/storefront/home` |
| `GET` | `/api/v1/storefront/categories` |
| `GET` | `/api/v1/storefront/categories/:identifier` |
| `GET` | `/api/v1/catalog/popularity` |

### 8.5. Cart

| Method | Route |
| --- | --- |
| `GET` | `/api/v1/cart` |
| `DELETE` | `/api/v1/cart` |
| `POST` | `/api/v1/cart/merge` |
| `POST` | `/api/v1/cart/items` |
| `PUT` | `/api/v1/cart/items/:productId` |
| `DELETE` | `/api/v1/cart/items/:productId` |

Lưu ý quan trọng:

- `POST /api/v1/cart/merge` hiện là route thật để merge guest cart vào server-side cart sau login
- frontend vẫn giữ guest cart ở local storage khi chưa đăng nhập, nhưng việc merge sau khi có token giờ đã được chuyển xuống backend

### 8.6. Orders, Returns, Coupons

| Method | Route |
| --- | --- |
| `POST` | `/api/v1/orders/preview` |
| `POST` | `/api/v1/orders` |
| `GET` | `/api/v1/orders/summary` |
| `GET` | `/api/v1/orders` |
| `GET` | `/api/v1/orders/:id/events` |
| `GET` | `/api/v1/orders/:id/return-eligibility` |
| `GET` | `/api/v1/orders/:id` |
| `PUT` | `/api/v1/orders/:id/cancel` |
| `POST` | `/api/v1/orders/:id/returns` |
| `GET` | `/api/v1/orders/:id/returns` |
| `GET` | `/api/v1/returns` |
| `GET` | `/api/v1/returns/:id` |
| `POST` | `/api/v1/returns/:id/evidence` |
| `GET` | `/api/v1/admin/orders/report` |
| `GET` | `/api/v1/admin/orders` |
| `GET` | `/api/v1/admin/orders/:id/events` |
| `GET` | `/api/v1/admin/orders/:id` |
| `PUT` | `/api/v1/admin/orders/:id/cancel` |
| `PUT` | `/api/v1/admin/orders/:id/status` |
| `GET` | `/api/v1/admin/returns` |
| `GET` | `/api/v1/admin/returns/health` |
| `PUT` | `/api/v1/admin/returns/:id/status` |
| `POST` | `/api/v1/admin/returns/:id/refund` |
| `POST` | `/api/v1/admin/coupons` |
| `GET` | `/api/v1/admin/coupons` |

### 8.7. Payments

| Method | Route |
| --- | --- |
| `POST` | `/api/v1/payments` |
| `GET` | `/api/v1/payments/history` |
| `GET` | `/api/v1/payments/:id` |
| `GET` | `/api/v1/payments/order/:orderId` |
| `GET` | `/api/v1/payments/order/:orderId/history` |
| `POST` | `/api/v1/payments/webhooks/momo` |
| `GET` | `/api/v1/admin/payments/history` |
| `GET` | `/api/v1/admin/payments/order/:orderId/history` |
| `POST` | `/api/v1/admin/payments/:id/refunds` |

Lưu ý:

- route `GET /api/v1/payments/:id/verify` không có ở gateway handler hiện tại
- helper hoặc test cũ có thể vẫn nhắc tới route này, nhưng đừng dùng nó như contract thật

---

## 9. Các Flow Nên Test Kỹ

### 9.1. Auth

Ít nhất nên verify:

- register thành công
- login thành công
- refresh token
- forgot/reset password
- verify email resend/verify
- phone verification send/resend/verify

### 9.2. Product Catalog

Ít nhất nên verify:

- list products với filter
- get product detail
- search assist
- create/update/delete product bằng role admin hoặc staff
- upload image
- review create/update/delete

### 9.3. Cart Và Checkout

Ít nhất nên verify:

- add item
- update quantity
- remove item
- clear cart
- preview order
- create order
- cancel order

Lưu ý:

- checkout UI hiện đã tối giản form giao hàng
- address APIs vẫn tồn tại ở `user-service`, nhưng storefront checkout không còn bắt user nhập đầy đủ `street/ward/district/city` như trước

### 9.4. Payment Và Refund

Ít nhất nên verify:

- create payment cho order hợp lệ
- payment history
- get payment by id
- refund qua admin
- webhook MoMo với signature đúng/sai

Hiện trạng đáng chú ý:

- `payment-service` đã có idempotency cho create payment và refund path
- nên test thêm replay cùng `Idempotency-Key` để xác nhận backend trả kết quả an toàn

### 9.5. Returns

Ít nhất nên verify:

- user tạo return request
- user upload evidence
- admin list return queue
- admin đổi trạng thái
- admin queue refund cho return

Flow này đáng test kỹ vì nó liên quan cả order, payment và retry background.

---

## 10. Negative Tests Nên Có

Collection của bạn nên có một folder `99. Negative Tests` để giữ các case sau:

- thiếu token
- token sai role
- body thiếu field bắt buộc
- ID không tồn tại
- quantity âm hoặc bằng 0
- coupon không hợp lệ
- create payment cho order không thuộc user
- refund vượt số tiền cho phép
- webhook signature sai

Đây là phần giúp bạn bắt regressions tốt hơn rất nhiều so với chỉ test happy path.

---

## 11. Verify Async Flow Sau Khi Gọi API

Với các flow async như payment event, return refund queue, notification:

- kiểm tra `GET /api/v1/orders/:id/events`
- kiểm tra `GET /api/v1/payments/order/:orderId/history`
- kiểm tra admin returns queue
- kiểm tra log của `order-service`, `payment-service`, `notification-service`
- dùng Jaeger khi nghi ngờ flow qua nhiều boundary

Ví dụ:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f order-service payment-service notification-service
```

---

## 12. Cách Dùng Guide Này Hiệu Quả

Khi thêm hoặc sửa feature:

1. rà gateway route trước
2. cập nhật collection theo route thật
3. thêm ít nhất một happy path và một negative path
4. nếu flow có idempotency hoặc async side effect, thêm test replay/retry
5. nếu frontend đang gọi route khác, sửa tài liệu hoặc sửa code ngay để tránh contract trôi tiếp

Nếu bạn chỉ có 10 phút để smoke test nhanh, hãy chạy:

1. `/health`
2. login
3. profile
4. products
5. cart get/add
6. order preview
7. create payment

Chỉ cần 7 bước này fail là bạn đã biết runtime đang có vấn đề ở boundary quan trọng nào đó.

---

## 13. Audit-Level Test Cases Bắt Buộc Nên Có Trong Collection

Đây là các case giúp bạn bắt đúng bug production-oriented thay vì chỉ test API “có trả 200 hay không”.

### 13.1. Order idempotency replay

Mục tiêu:

- xác nhận `POST /api/v1/orders` chịu được client retry
- xác nhận backend phát hiện reuse key sai payload

Cách test:

1. Gửi `POST /api/v1/orders` với header `Idempotency-Key: {{order_idempotency_key}}`
2. Gửi lại đúng body và đúng key
3. Gửi lại body khác nhưng vẫn dùng đúng key

Kỳ vọng:

- request 1: tạo order thành công
- request 2: replay an toàn, không tạo order mới
- request 3: `409 idempotency conflict`

### 13.2. Payment create và refund idempotency

Mục tiêu:

- xác nhận payment create/refund không nhân đôi side effect khi retry

Cách test:

1. `POST /api/v1/payments` với `Idempotency-Key`
2. replay cùng body
3. replay body khác cùng key
4. `POST /api/v1/admin/payments/:id/refunds` với `Idempotency-Key`
5. replay lại refund request y hệt

Kỳ vọng:

- create/refund cùng key + cùng payload phải replay an toàn
- create/refund cùng key + payload khác phải conflict

### 13.3. Product cursor pagination

Mục tiêu:

- xác nhận catalog public không bị duplicate hoặc skip item giữa các trang

Cách test:

1. `GET /api/v1/products?limit=5`
2. lấy `meta.next_cursor`
3. gọi tiếp `GET /api/v1/products?limit=5&cursor={{next_cursor}}`
4. thử thay sort rồi reuse cursor cũ

Kỳ vọng:

- trang 1 và 2 không trùng item
- `has_next` và `next_cursor` hợp lý
- reuse cursor sai sort phải trả `400 invalid cursor`

### 13.4. Return evidence upload dạng multipart

Mục tiêu:

- xác nhận route evidence không bị test sai như JSON endpoint thường

Route thật:

- `POST /api/v1/returns/:id/evidence`

Cách test:

- dùng `form-data`
- key file phải là `evidence`
- gửi 1-2 file ảnh nhỏ hợp lệ

Kỳ vọng:

- `201`
- payload trả về `return.evidence`
- event/timeline của return tăng thêm mốc evidence upload

### 13.5. Webhook replay và signature fail

Mục tiêu:

- xác nhận webhook MoMo vừa verify chữ ký vừa replay-safe

Cách test:

1. gửi webhook payload hợp lệ một lần
2. gửi lại đúng payload lần hai
3. gửi payload với signature sai

Kỳ vọng:

- lần 1: payment state đổi đúng
- lần 2: backend không nhân đôi state transition/outbox effect
- signature sai: bị reject

### 13.6. Admin batch/history path

Mục tiêu:

- xác nhận UI admin có thể dùng đúng các endpoint batch/read-heavy hiện có

Ít nhất nên test:

- `GET /api/v1/admin/orders`
- `GET /api/v1/admin/payments/history`
- `GET /api/v1/admin/payments/order/:orderId/history`
- `GET /api/v1/admin/returns`
- `GET /api/v1/admin/returns/health`

Khi test, đừng chỉ nhìn status code. Hãy verify:

- `meta`
- shape của item list
- filter/sort/pagination hoạt động
- role staff/admin được phép, user thường bị chặn

## 14. Kiểm Tra DB Và Log Sau Khi Test Hot Path

Với các flow write quan trọng, nên verify thêm state thật ở DB/log thay vì chỉ dừng ở HTTP response.

### 14.1. Sau create order

Kiểm tra:

- bảng `orders`
- bảng `order_items`
- bảng `order_events`
- bảng `order_idempotency_keys`
- bảng `outbox_events`

### 14.2. Sau create payment hoặc refund

Kiểm tra:

- bảng `payments`
- bảng `payment_idempotency_keys`
- bảng `outbox_events`
- bảng `audit_entries`

### 14.3. Sau webhook

Kiểm tra:

- `payments.status`
- `inbox_messages`
- `outbox_events`
- `orders.status` nếu flow đã sync sang order

### 14.4. Sau queue refund return

Kiểm tra:

- bảng `returns`
- `refund_attempt_count`
- `refund_last_error`
- `refund_next_retry_at`
- `refund_processing_started_at`

Log nên xem cùng lúc:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f api-gateway order-service payment-service notification-service
```

## 15. Bộ Smoke Test 15 Phút Nên Có Sẵn

Nếu bạn muốn một collection gọn nhưng vẫn có giá trị thật, hãy giữ 3 folder:

1. `00. Health`
   - `/health`
   - login
   - profile
2. `10. Shopper Core`
   - list products
   - cart add/update
   - order preview
   - create order với `Idempotency-Key`
   - create payment với `Idempotency-Key`
3. `20. Admin And Async`
   - admin orders
   - admin payments history
   - create/list coupon
   - create return
   - queue refund
   - webhook replay

Nếu chỉ cần một bộ smoke test tối thiểu cho release, đây là bộ đáng giữ nhất vì nó chạm đủ:

- auth
- catalog
- cart
- order
- payment
- admin
- async/refund path
