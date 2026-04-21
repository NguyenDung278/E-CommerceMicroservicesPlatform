# Backend Learning Guide

File này không lặp lại source map, mà biến codebase thành lộ trình học backend Go thực chiến. Mục tiêu là:

- đọc source có phương pháp thay vì đọc ngẫu nhiên
- hiểu ý nghĩa của từng “family function” trong repo
- rút ra pattern mang sang dự án Go khác
- biết chỗ nào đáng học, chỗ nào là pitfall thật
- có bài tập cụ thể để nâng tay backend Golang

## Cách học repo này cho đúng

### Nguyên tắc

- Đừng dừng ở handler; business rule thật luôn nằm sâu hơn trong service.
- Đừng chỉ đọc happy path; repo này đáng học ở retry, idempotency, outbox, inbox, queue worker và graceful degradation.
- Đừng xem helper function là “code phụ”. Trong repo này, rất nhiều invariant được giữ bằng helper rõ tên như `normalize*`, `build*`, `apply*`, `Claim*`, `Mark*`, `RunInTx`.

### Quy trình đọc một feature

1. Mở `cmd/main.go` để thấy dependency nào là bắt buộc, dependency nào là optional.
2. Mở `RegisterRoutes` hoặc gRPC server để thấy contract đầu vào.
3. Mở service method chính để thấy invariant nghiệp vụ.
4. Mở repository để hiểu persistence, transaction, pagination, outbox/inbox.
5. Mở test/benchmark tương ứng để thấy assumption nào đã được khoá lại.

## Ý nghĩa của các family function trong source

### `RegisterRoutes`, `New*`, `With*`

| Family | Ý nghĩa | Ví dụ nên đọc |
| --- | --- | --- |
| `RegisterRoutes` | Tuyên bố public contract của service qua HTTP route. | `user_handler.go:60`, `product_handler.go:50`, `order_handler.go:29`, `payment_handler.go:26` |
| `New*` constructor | Dựng service/repo/client/worker với dependency cụ thể. | `NewUserService`, `NewProductService`, `NewOrderService`, `NewPaymentService`, `NewEventHandler` |
| `With*` option | Functional Options cho dependency optional hoặc config phụ. | `user_service.go:100-323`, `product_service.go:64-114`, `product_review_service.go:88-112` |

### `normalize*`, `resolve*`, `validate*`

| Family | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `normalize*` | Chuẩn hoá input về dạng an toàn/nhất quán trước khi xử lý tiếp. | `normalizePaymentMethod`, `normalizeCouponCode`, `normalizeProductIDs`, `normalizeOAuthProvider` |
| `resolve*` | Suy ra giá trị cuối cùng từ nhiều nguồn hoặc nhiều điều kiện business. | `resolveShippingPromise`, `resolveOAuthCallbackURL`, `resolveOptionalPhone` |
| `validate*` | Kiểm tra boundary/invariant trước khi mutate state. | `validateOrderRequest`, `validateCoupon`, `isValidReturnStatus`, `isValidOrderStatus` |

### `build*`, `new*`, `apply*`

| Family | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `build*` | Tạo DTO/payload/event/object key từ state hiện có. | `buildCreatedOrderOutbox`, `buildPaymentOutboxMessage`, `buildReturnRefundIdempotencyKey`, `buildHistoryItem` |
| `new*` | Tạo aggregate/model mới ở write path. | `newOrderFromQuote`, `newProductFromCreateRequest`, `newOAuthAccountLink`, `newSocialUser` |
| `apply*` | Cập nhật state đang có theo một rule cụ thể. | `applyCouponToQuote`, `applyOAuthIdentity`, `applyVerifiedPhoneChange`, `ApplyWebhookResult` ở repository |

### `load*`, `list*`, `get*`, `scan*`

| Family | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `get*` | Lấy một entity hoặc một view có semantics hẹp. | `GetOrder`, `GetProductByID`, `GetReturnEligibility`, `GetProfile` |
| `list*` | Đọc collection và thường gắn filter/pagination. | `ListAdminOrders`, `ListFeaturedProductsByCategorySlugs`, `ListDispatchableWishlistAlerts` |
| `load*` | Helper nội bộ để service lấy entity và bọc lỗi ngữ cảnh tốt hơn. | `loadOrderByID`, `loadUserByID`, `loadReviewSummary`, `loadReviewForMutation` |
| `scan*` | SQL row -> model mapping; là lớp primitive rất quan trọng ở repository. | `scanOrder`, `scanPayment`, `scanProductReviewRow`, `scanUser` |

### `Start*`, `RunInTx`, `Claim*`, `Mark*`

| Family | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `Start*` | Bắt đầu background worker hoặc consumer loop. | `StartOutboxRelay`, `StartPaymentEventConsumer`, `StartReturnRefundWorker`, `QueueMonitor.Start` |
| `RunInTx` | Gói nhiều repo primitive dưới một transaction boundary rõ ràng. | `profile_tx_manager.go:27`, `product_review_tx_manager.go:25` |
| `Claim*` | Lấy quyền xử lý một record/message trong môi trường at-least-once. | `ClaimPendingOutbox`, `ClaimPendingReturnRefunds`, `redis_store.go:39` `Claim` |
| `Mark*` | Chuyển trạng thái persistence sau khi đã xử lý. | `MarkOutboxPublished`, `MarkOutboxFailed`, `MarkProcessed`, `MarkReturnRefundAttemptFailed` |

### `record*`, `observe*`, `warn*`

| Family | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `record*` | Ghi metric, analytics hoặc audit. | `RecordSearchEvent`, `recordAuditEntry`, `recordReturnRefundQueueHealth` |
| `observe*` | Theo dõi outcome/latency ở hot path. | `observeOperation` trong review service |
| `warn*` | Log degradation nhưng không fail luồng chính. | `warnCacheFailure` trong review service |

## Lộ trình học theo cấp độ

## Cấp độ 1: Hiểu nền Go backend của repo

Đọc theo thứ tự:

1. `pkg/config/config.go:236` `Load`
2. `pkg/database/postgres.go:34`, `:54`
3. `pkg/middleware/auth.go:43`, `:99`
4. `pkg/middleware/rate_limit.go:53`
5. `pkg/observability/tracing.go:25`, `:66`
6. `api-gateway/internal/proxy/service_proxy.go:44`
7. `api-gateway/internal/proxy/service_proxy_request.go:33`, `:141`

Mục tiêu học:

- Cách dựng một backend Go có config, DB, middleware, tracing, logging mà không cần framework nặng.
- Vì sao gateway nên mỏng.
- Vì sao concern chung như auth, rate-limit, request ID nên ở `pkg/` hoặc middleware.

## Cấp độ 2: Hiểu service layer sạch

Đọc theo thứ tự:

1. `services/user-service/internal/service/user_auth.go`
2. `services/user-service/internal/service/oauth_service.go`
3. `services/product-service/internal/service/product_crud.go`
4. `services/product-service/internal/service/storefront_service.go`
5. `services/cart-service/internal/service/cart_mutations.go`

Mục tiêu học:

- Tên hàm nói lên intent.
- Handler mỏng, service giữ business logic.
- Repository chỉ nên làm SQL/persistence primitive.
- Functional Options chỉ dùng khi có lợi ích thật.

## Cấp độ 3: Học consistency và orchestration

Đọc theo thứ tự:

1. `services/order-service/internal/service/order_pricing.go`
2. `services/order-service/internal/service/order_lifecycle.go`
3. `services/order-service/internal/repository/order_repository.go`
4. `services/payment-service/internal/service/payment_processing.go`
5. `services/payment-service/internal/service/payment_refunds.go`
6. `services/payment-service/internal/repository/payment_repository.go`
7. `services/order-service/internal/service/order_events.go`
8. `services/payment-service/internal/service/payment_events.go`

Mục tiêu học:

- Idempotency cho POST quan trọng.
- Transactional outbox.
- Compensation khi side-effect ngoài DB xảy ra trước persistence.
- Internal HTTP/gRPC boundary nên mỏng nhưng đáng tin.

## Cấp độ 4: Học event-driven reliability

Đọc theo thứ tự:

1. `services/order-service/internal/service/payment_events.go`
2. `services/notification-service/internal/handler/event_handler.go`
3. `services/notification-service/internal/inbox/redis_store.go`
4. `services/notification-service/internal/messaging/retry_publisher.go`
5. `services/order-service/internal/service/order_return_refund_worker.go`

Mục tiêu học:

- At-least-once delivery nghĩa là gì trong thực tế.
- Vì sao phải có inbox/dedupe state.
- Phân biệt lỗi transient và permanent.
- Background worker cần lease, retry, metrics, stop signal ra sao.

## 10 cụm source đáng học nhất và bài học rút ra

| Cụm source | Học được gì |
| --- | --- |
| `order_lifecycle.go:42` | Orchestration đa bước nhưng vẫn đọc được vì flow tách theo intent. |
| `order_repository.go:91` | Idempotency record + outbox được persist cùng transaction. |
| `payment_processing.go:43` | Payment luôn dựa trên order truth, không tin frontend. |
| `payment_refunds.go:230` | Webhook phải replay-safe, verify signature, map lỗi đúng bản chất. |
| `event_handler.go:127` | Consumer bền vững cần claim, retry, DLQ, audit và history. |
| `product_review_service.go:138` | Cache + tx + observer + metrics có thể sống chung nếu dependency rõ vai trò. |
| `oauth_service.go:70`, `:118`, `:172` | OAuth tốt là flow nhiều bước, không phải một handler dài. |
| `user_profile.go:60` | Profile patch phức tạp vẫn có thể sạch nếu normalize tốt. |
| `wishlist_service.go:107`, `:178` | Feature nhỏ vẫn có thể dạy orchestration và downstream signaling. |
| `order_return_refund_worker.go:24` | Worker thực chiến cần lease, backoff và failure persistence. |

## Repository này dạy gì về “Backend Go chuẩn”

### 1. Dùng Go standard style nhiều hơn framework

- Wiring nằm ở `cmd/main.go`.
- Interface chỉ xuất hiện khi consumer thực sự cần fake/mock hoặc ẩn external dependency.
- Không có framework DI; constructor + option là đủ.

### 2. Service layer phải giữ domain rule

Đọc các hàm sau để thấy rõ:

- `CreateOrder`
- `ProcessPayment`
- `UpdateProfile`
- `CreateReview`
- `CreateReturn`

Điểm chung:

- validate input boundary
- load truth từ source of truth
- áp rule
- persist qua repository
- phát side-effect qua outbox/worker hoặc best-effort rõ ràng

### 3. Repository nên là nơi giữ SQL và transaction primitive

Đọc:

- `order_repository.go`
- `payment_repository.go`
- `product_repository.go`
- `product_review_repository.go`

Học được:

- `scan*` helper làm code đọc SQL đỡ lặp.
- Transaction helper nên ít nhưng rõ.
- Pagination, lock, upsert delta, outbox/inbox đều là bài toán persistence chứ không phải handler concern.

### 4. External integration phải degrade có chủ đích

Đọc:

- `product_queries.go:434`, `:462`
- `product-service/cmd/main.go:237`
- `notification-service/cmd/main.go:69-76`
- `event_handler.go:697`

Học được:

- Search, cache, history, dedupe là integration phụ.
- Degrade không có nghĩa là nuốt lỗi vô điều kiện; vẫn phải log và giữ observability.

## Best practices xuất hiện rõ trong repo

| Best practice | Nơi thể hiện | Vì sao tốt |
| --- | --- | --- |
| Idempotency cho write API quan trọng | `CreateOrder`, `ProcessPayment`, `RefundPayment`, webhook apply path | Client retry không gây double side effect. |
| Transactional outbox | order/payment repository + `StartOutboxRelay` | DB commit và event publish không lệch nhau. |
| Inbox/consumer dedupe | `ApplyInboxStatusTransition`, `redis_store.Claim` | At-least-once delivery không làm state bị apply lặp. |
| Functional Options tiết chế | `user_service.go`, `product_service.go` | Constructor dài nhưng vẫn dễ đọc, tránh config struct loãng. |
| Thin handler | hầu hết file `internal/handler` | Mapping request/response rõ, test đơn giản hơn. |
| Cache invalidation qua observer | `product_review_observer.go` | Không nhét cache code cứng vào flow write. |
| Graceful degradation | product search/media, notification Redis fallback | Tăng availability mà không nói dối về failure mode. |
| Structured logging | toàn repo với `zap` | Debug production dễ hơn log string nối chuỗi. |

## Pitfall thực tế rút ra từ source

| Pitfall | File hoặc hàm | Nguyên nhân | Hướng khắc phục |
| --- | --- | --- | --- |
| Cart update không re-check product truth | `cart_mutations.go:121` | Update đi trên snapshot cũ | Re-fetch product ở `UpdateItem`, hoặc ít nhất re-check stock/price trước save. |
| Default address chưa có tx chặt | `address_service.go:34`, `:134`, `:192` | `ClearDefault` và write tiếp theo tách rời | Dùng `ProfileTxManager` hoặc tx manager riêng cho address invariant. |
| Admin order list còn nhánh offset | `order_handler.go:314`, `order_repository.go:651` | Backward compatibility với page/limit | Chuyển UI/admin API sang cursor-first, giữ offset chỉ cho backoffice nhỏ. |
| Review list vẫn offset-based | `product_review_service.go:138` | Thiết kế list cũ | Nâng lên cursor hoặc cached page key tốt hơn. |
| Redis chết làm notification mất dedupe/history | `notification-service/cmd/main.go`, `redis_store.go` | Redis là reliability layer | Bổ sung metric/alert rõ hơn và xem xét persistent inbox nếu cần mạnh hơn. |
| Gateway forward header rộng | `service_proxy_request.go:72` | Clone header gần như nguyên vẹn | Xây allowlist header nội bộ đáng tin cậy. |
| Proto product dùng `float` cho money | `proto/product.proto` | Tiện lúc đầu nhưng risk về precision/contract | Chuyển sang integer minor units hoặc string decimal có migration plan. |

## Test và benchmark nên đọc song song với source

| Chủ đề | File test |
| --- | --- |
| User auth/profile/OAuth | `services/user-service/internal/service/user_service_test.go` |
| Phone verification/profile-address | `services/user-service/internal/service/phone_verification_test.go` |
| Email signup | `services/user-service/internal/service/email_signup_test.go` |
| Login brute-force guard | `services/user-service/internal/handler/login_protection_test.go` |
| Product review service | `services/product-service/internal/service/product_review_service_test.go` |
| Product review benchmark | `services/product-service/internal/service/product_review_service_benchmark_test.go` |
| Storefront service | `services/product-service/internal/service/storefront_service_test.go` |
| Cart mutations | `services/cart-service/internal/service/cart_service_test.go` |
| Order pricing/lifecycle/returns | `services/order-service/internal/service/order_service_test.go` |
| Return eligibility | `services/order-service/internal/service/order_return_eligibility_test.go` |
| RabbitMQ integration | `services/order-service/internal/service/rabbitmq_integration_test.go` |
| Payment process/refund/webhook | `services/payment-service/internal/service/payment_service_test.go` |
| Notification event handling | `services/notification-service/internal/handler/event_handler_test.go` |
| Wishlist alert worker | `services/notification-service/internal/service/wishlist_alert_worker_test.go` |

## Cách đọc test để học nhanh hơn

### Test service

- Tìm tên test chứa hành vi nghiệp vụ rõ ràng như:
  - `TestCreateOrderRestoresReservedStockWhenPersistenceFails`
  - `TestProcessPaymentRejectsIdempotencyKeyReuseForDifferentPayload`
  - `TestHandleMessageSkipsDuplicateEvent`

Những tên này cho biết maintainer đang xem failure mode nào là đáng sợ nhất.

### Benchmark

- `BenchmarkProductReviewServiceListReviewsColdPath`
- `BenchmarkProductReviewServiceListReviewsWarmCache`

Đây là cách tốt để học “tối ưu bằng số liệu thay vì cảm giác”.

## Lộ trình đọc source trong 14 ngày

| Ngày | Việc nên làm |
| --- | --- |
| 1 | Đọc `pkg/config`, `pkg/database`, `pkg/middleware`, `pkg/observability` |
| 2 | Đọc `api-gateway` để hiểu boundary của toàn hệ thống |
| 3 | Đọc `user_auth.go`, `user_tokens.go`, `auth_recovery.go` |
| 4 | Đọc `oauth_service.go`, `email_signup.go`, `phone_verification.go` |
| 5 | Đọc `user_profile.go`, `address_service.go`, `wishlist_service.go` |
| 6 | Đọc `product_crud.go`, `product_queries.go`, `product_repository.go` |
| 7 | Đọc `storefront_service.go`, `product_search_assist.go`, `search_analytics_repository.go` |
| 8 | Đọc `product_review_service.go`, `product_review_repository.go`, benchmark/test liên quan |
| 9 | Đọc `cart_mutations.go` và test cart |
| 10 | Đọc `order_pricing.go`, `order_lifecycle.go` |
| 11 | Đọc `order_repository.go`, `order_events.go`, `payment_events.go` |
| 12 | Đọc `payment_processing.go`, `payment_refunds.go`, `payment_repository.go` |
| 13 | Đọc `notification event_handler`, `retry_publisher`, `redis_store`, `history_store` |
| 14 | Chọn một pitfall hoặc exercise bên dưới và tự sửa/test nó |

## Bài tập nâng tay backend Golang nên làm trên repo này

### 1. Sửa `UpdateItem` để re-check giá và stock

- Mục tiêu học: internal gRPC client, Redis mutation, backward compatibility.
- File nên tập trung:
  - `services/cart-service/internal/service/cart_mutations.go`
  - `services/cart-service/internal/grpc_client/product_client.go`
  - `services/cart-service/internal/service/cart_service_test.go`

### 2. Gói invariant default-address vào transaction

- Mục tiêu học: transaction boundary, repo primitive, race/invariant nhỏ nhưng quan trọng.
- File nên tập trung:
  - `services/user-service/internal/service/address_service.go`
  - `services/user-service/internal/repository/profile_tx_manager.go`
  - `services/user-service/internal/repository/address_repository.go`

### 3. Chuyển admin order list sang cursor-first hoàn toàn

- Mục tiêu học: pagination design, compatibility strategy, query cost.
- File nên tập trung:
  - `services/order-service/internal/handler/order_handler.go`
  - `services/order-service/internal/service/order_queries.go`
  - `services/order-service/internal/repository/order_repository.go`

### 4. Thêm benchmark cho order quote và payment processing

- Mục tiêu học: benchmark, allocation awareness, profiling bằng số liệu.
- File nên tập trung:
  - `services/order-service/internal/service/order_pricing.go`
  - `services/payment-service/internal/service/payment_processing.go`
  - thêm benchmark file mới trong từng service

### 5. Thêm admin endpoint hoặc job replay cho outbox thất bại

- Mục tiêu học: operability, failure recovery, event-driven systems.
- File nên tập trung:
  - `services/order-service/internal/service/order_events.go`
  - `services/payment-service/internal/service/payment_events.go`
  - `services/order-service/internal/repository/order_repository.go`
  - `services/payment-service/internal/repository/payment_repository.go`

### 6. Chuẩn hoá payment/order client timeout và retry policy

- Mục tiêu học: inter-service resilience.
- File nên tập trung:
  - `services/payment-service/internal/client/order_client.go`
  - `services/order-service/internal/client/payment_client.go`
  - so sánh với `api-gateway/internal/proxy/service_proxy.go`

### 7. Nâng review list lên cursor hoặc keyset cache

- Mục tiêu học: hot-path pagination, cache-aware list design.
- File nên tập trung:
  - `services/product-service/internal/service/product_review_service.go`
  - `services/product-service/internal/repository/product_review_repository.go`
  - `services/product-service/internal/repository/product_review_cache.go`

### 8. Chuyển money fields trong proto nội bộ sang representation an toàn hơn

- Mục tiêu học: proto evolution, compatibility, money-safe contract.
- File nên tập trung:
  - `proto/product.proto`
  - `services/product-service/internal/grpc/product_grpc.go`
  - `services/cart-service/internal/grpc_client/product_client.go`
  - `services/order-service/internal/grpc_client/product_client.go`

## 5 kỹ năng backend Go sẽ tăng mạnh nếu học repo này nghiêm túc

1. Thiết kế service layer rõ trách nhiệm.
2. Làm idempotent write API và webhook.
3. Dùng transactional outbox/inbox một cách thực dụng.
4. Viết worker có lease, retry, stop signal và metric.
5. Dùng PostgreSQL và Redis đúng vai trò thay vì lạm dụng abstraction.

## Checklist tự hỏi khi đọc hoặc sửa source

- Hàm này là transport, business hay persistence?
- Hàm này đang normalize input, apply rule hay chỉ build payload?
- Nếu request bị retry hai lần thì side effect có nhân đôi không?
- Nếu MQ/Redis/Search chết thì luồng chính có degrade hợp lý không?
- Nếu đang ở repository, transaction này có đang giữ đúng invariant business không?
- Nếu đang ở service, có đang vô tình tin dữ liệu từ frontend thay vì source of truth không?
- Nếu đang thêm helper, tên helper đã nói rõ intent chưa?

## Nếu chỉ chọn 7 file để học nghề backend Go từ repo này

1. `services/order-service/internal/service/order_lifecycle.go`
2. `services/order-service/internal/repository/order_repository.go`
3. `services/payment-service/internal/service/payment_processing.go`
4. `services/payment-service/internal/service/payment_refunds.go`
5. `services/notification-service/internal/handler/event_handler.go`
6. `services/product-service/internal/service/product_review_service.go`
7. `services/user-service/internal/service/oauth_service.go`

7 file này bao phủ gần như toàn bộ các kỹ năng backend quan trọng nhất trong repo: orchestration, persistence, idempotency, outbox/inbox, webhook, cache, observer, external auth và worker reliability.
