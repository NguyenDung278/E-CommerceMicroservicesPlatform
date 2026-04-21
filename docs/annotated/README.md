# Annotated Source Map

Mục tiêu của file này là thay toàn bộ bộ annotate cũ bằng một bản đồ nguồn gọn, đủ để lần theo feature, hiểu boundary, và biết chỗ nào đáng học nhất trong source.

## Cách đọc source nhanh mà không bị lạc

1. Mở `pkg/` để nắm config, logger, middleware, observability.
2. Mở `cmd/main.go` của service cần đọc để thấy wiring và dependency thật.
3. Mở `internal/handler/` để biết route hoặc RPC nào là entrypoint.
4. Mở `internal/service/` để đọc nghiệp vụ và orchestration.
5. Mở `internal/repository/` để thấy transaction, query, locking, scan.
6. Quay lại UI caller ở `client/` hoặc `frontend/` nếu cần trace full request path.

## Bản đồ chức năng

| Tính năng | Điểm vào chính | File hoặc hàm nên đọc | Ghi chú |
| --- | --- | --- | --- |
| Auth, đăng ký, đăng nhập, refresh token | `services/user-service/internal/handler/user_handler.go::{Register,Login,RefreshToken}` | `services/user-service/internal/service/user_auth.go::{Register,Login}`, `services/user-service/internal/service/user_tokens.go::RefreshToken`, `pkg/middleware/auth.go::{JWTAuth,RequireRole}` | Handler mỏng, rule auth nằm ở service, authz chung nằm ở middleware. |
| Google OAuth | `services/user-service/internal/handler/user_handler.go::ExchangeOAuthTicket` | `services/user-service/internal/service/oauth_service.go::{BeginOAuth,CompleteOAuthCallback,ExchangeOAuthTicket}` | Flow tách rõ start, callback, ticket exchange để tránh nhét logic vào handler. |
| Hồ sơ người dùng, địa chỉ, wishlist | `services/user-service/internal/handler/address_handler.go`, `wishlist_handler.go` | `services/user-service/internal/service/address_service.go`, repository tương ứng trong `services/user-service/internal/repository/` | Đáng đọc để thấy boundary HTTP -> service -> repository rất thẳng. |
| Catalog, search, storefront listing | `services/product-service/internal/handler/product_handler.go` | `services/product-service/internal/service/product_queries.go`, `storefront_service.go`, `storefront_repository.go` | Catalog đọc từ PostgreSQL; search và media là integration phụ. |
| Review sản phẩm | `services/product-service/internal/handler/product_review_handler.go::ListReviews` | `services/product-service/internal/service/product_review_service.go::{ListReviews,CreateReview}`, `services/product-service/internal/service/product_review_factory.go`, `services/product-service/internal/service/product_review_observer.go`, `services/product-service/internal/repository/product_review_tx_manager.go` | Đây là cụm source đáng học nhất ở `product-service` vì có transaction coordinator, factory, observer. |
| Giỏ hàng | `services/cart-service/internal/handler/cart_handler.go::{MergeCart,AddItem,UpdateItem}` | `services/cart-service/internal/service/cart_mutations.go`, `services/cart-service/internal/repository/cart_repository.go` | Redis chỉ giữ cart state; product truth vẫn phải lấy từ `product-service`. |
| Preview order, tạo order, hủy order | `services/order-service/internal/handler/order_handler.go::{PreviewOrder,CreateOrder,CancelOrder,CancelOrderAsAdmin}` | `services/order-service/internal/service/order_pricing.go`, `order_lifecycle.go`, `order_reservations.go`, `services/order-service/internal/repository/order_repository.go` | Flow này giữ hầu hết invariant về giá, coupon, shipping, stock reservation. |
| Payment, refund, webhook | `services/payment-service/internal/handler/payment_handler.go::{ProcessPayment,RefundPayment,HandleMomoWebhook}` | `services/payment-service/internal/service/payment_processing.go::ProcessPayment`, `payment_refunds.go::{RefundPayment,HandleMomoWebhook}`, `services/payment-service/internal/repository/payment_repository.go` | Payment không tin số tiền từ frontend; write flow đã có idempotency. |
| Event notification và inbox audit | `services/notification-service/cmd/main.go` | `services/notification-service/internal/handler/event_handler.go::HandleMessage`, `inbox_handler.go`, `internal/messaging/`, `internal/inbox/` | Worker dùng RabbitMQ + Redis inbox/history + retry/DLQ. |
| Gateway và reverse proxy | `api-gateway/internal/handler/`, route wiring trong `cmd/main.go` | `api-gateway/internal/proxy/service_proxy.go`, `service_proxy_request.go::Do` | Gateway nên giữ vai trò proxy và resilience, không chứa business logic. |
| Shopper UI | `client/src/app/`, `client/src/providers/`, `client/src/lib/api/` | route App Router, provider tree, API adapter của `client/` | `client/` là storefront runtime chính trong Docker Compose. |
| Admin/workbook UI | `frontend/src/app/`, `frontend/src/features/admin/`, `frontend/src/services/api/` | `frontend/src/pages/admin/admin-page.tsx`, `frontend/src/features/admin/components/*` | `frontend/` là admin app và workbook runtime. |

## Pattern nên học

| Pattern hoặc cách tổ chức | Vị trí | Lợi ích cụ thể |
| --- | --- | --- |
| Layering `handler -> service -> repository` | Hầu hết `services/*/internal/` | Dễ test, dễ map lỗi đúng tầng, tránh lẫn HTTP với SQL. |
| Middleware cho auth/authz | `pkg/middleware/auth.go` | Gom logic JWT và role guard vào một chỗ, tránh copy-paste giữa service. |
| Dependency injection qua constructor | `services/*/cmd/main.go`, `New...Service`, `New...Handler` | Wiring rõ dependency thật, không cần framework nặng. |
| Functional Options | `services/product-service/internal/service/product_service.go`, `product_review_service.go` | Thêm dependency optional như media store, search index, cache mà không làm constructor nổ tham số. |
| Factory | `services/product-service/internal/service/product_review_factory.go` | Chuẩn hóa cách dựng aggregate review trước khi persist. |
| Observer | `services/product-service/internal/service/product_review_observer.go` | Tách side effect sau khi mutate review khỏi core write flow. |
| Transaction Manager | `services/product-service/internal/repository/product_review_tx_manager.go` | Gom write nhiều bước vào cùng transaction mà vẫn giữ service code đọc được. |
| Transactional Outbox | `services/order-service/internal/service/order_events.go`, `services/payment-service/internal/service/payment_events.go` | Event chỉ được publish sau khi DB commit, giảm lệch trạng thái. |
| Inbox và idempotency | `services/payment-service/internal/repository/payment_repository.go::ApplyWebhookResult`, `services/order-service/internal/repository/order_repository.go::ApplyInboxStatusTransition`, `notification-service/internal/inbox/` | Chịu được retry, duplicate webhook và duplicate event. |
| Cursor pagination cho hot path | `services/product-service/internal/service/storefront_service.go`, `services/order-service/internal/repository/order_repository.go::ListAllByCursor` | Giảm chi phí `OFFSET` khi dữ liệu tăng. |

## Ghi chú phát triển đáng giữ

### High

- Không tin dữ liệu tiền bạc hoặc tồn kho từ frontend. Xem `services/order-service/internal/service/order_pricing.go::quoteOrder` và `services/payment-service/internal/service/payment_processing.go::ProcessPayment`.
- JWT phải khóa đúng signing method, không chỉ parse token. Xem `pkg/middleware/auth.go::JWTAuth`.
- Các POST có side effect lớn phải idempotent. Xem `services/order-service/internal/repository/order_repository.go::CreateWithIdempotency`, `services/payment-service/internal/repository/payment_repository.go::CreateWithIdempotency`, `ApplyWebhookResult`.

### Medium

- Redis cart không phải source of truth về catalog. `services/cart-service/internal/service/cart_mutations.go::{AddItem,MergeCart}` luôn phải hỏi `product-service` trước khi cập nhật snapshot.
- Reliability của notification nằm ở `ack/nack`, retry và DLQ, không nằm ở việc gửi mail “một phát ăn ngay”. Xem `services/notification-service/internal/handler/event_handler.go::HandleMessage`.
- MinIO và Elasticsearch là optional integration. Constructor kiểu option trong `services/product-service/internal/service/product_service.go` cho thấy service vẫn phải chạy được khi integration phụ lỗi.

### Low

- Muốn hiểu một service nhanh, đọc `cmd/main.go` trước `internal/service/`.
- Muốn trace full stack, nối handler backend với caller ở `client/src/lib/api/` hoặc `frontend/src/services/api/`.
- Muốn sửa auth đúng cách, đọc `pkg/` trước để không tự viết lại logger, response, middleware, tracing.

## Những file nên mở đầu tiên nếu mục tiêu là backend Go

1. `pkg/config/config.go`
2. `pkg/middleware/auth.go`
3. `api-gateway/internal/proxy/service_proxy.go`
4. `services/order-service/internal/service/order_lifecycle.go`
5. `services/payment-service/internal/service/payment_processing.go`
6. `services/product-service/internal/service/product_review_service.go`
