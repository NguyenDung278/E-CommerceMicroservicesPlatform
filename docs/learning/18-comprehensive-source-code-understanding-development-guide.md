# Comprehensive Source Code Understanding & Development Guide

Tài liệu này biến template "source code understanding" thành một bản đồ cụ thể cho chính repo `ecommerce-platform`. Mục tiêu không phải mô tả mọi file, mà là giúp bạn:

- hiểu nhanh hệ thống đang chạy thế nào
- biết mở đúng file khi debug hoặc thêm feature
- học được các pattern backend Go đáng giữ lại cho sự nghiệp dài hạn
- tránh đi nhầm vào những abstraction hoặc assumption không đúng với repo hiện tại

## Project Overview

| Mục | Nội dung |
| --- | --- |
| Project name | `ecommerce-platform` |
| Primary purpose | Nền tảng thương mại điện tử nhiều service, chạy local gần production bằng Docker Compose, có shopper storefront, admin/workbook, checkout, payment, returns, notification, observability. Repo đồng thời được dùng như một case study để học backend Golang thực chiến. |
| Target audience | Người dùng cuối: shopper, admin, staff. Người đọc source: backend Go developers muốn học HTTP/gRPC, PostgreSQL, Redis, RabbitMQ, tracing, idempotency, outbox/inbox. |
| Key technologies | Go, Echo, gRPC, PostgreSQL, Redis, RabbitMQ, Zap, OpenTelemetry, Prometheus, Grafana, Jaeger, MinIO, Elasticsearch, React + Vite, Next.js App Router, Docker Compose. |
| Runtime ownership | `client/` là storefront/account runtime chính thức. `frontend/` là admin/workbook/smoke-test app. `api-gateway/` là cửa HTTP chính cho host/local runtime. |

## Repository Structure

| Thư mục | Vai trò |
| --- | --- |
| `api-gateway/` | Reverse proxy HTTP, auth middleware, rate limit, tracing, circuit breaker, retry có chọn lọc. Không nên đặt business logic ở đây. |
| `services/*-service/` | Mỗi domain service giữ handler, service, repository, model, dto, migration riêng. Đây là source of truth của business logic. |
| `pkg/` | Shared packages cho config, logger, middleware, observability, response, validation. |
| `proto/` | Contract gRPC giữa các service, hiện quan trọng nhất cho `product-service` lookup từ `cart-service` và `order-service`. |
| `shared/` | Shared TypeScript contract và helper cho UI layer. |
| `client/` | Shopper app chính thức cho storefront/account. |
| `frontend/` | Admin/workbook app; dùng để vận hành local, report, workbook sync và admin surface. |
| `deployments/docker/` | Docker Compose và config runtime gần production nhất của repo. |
| `docs/` | Handbook học source code, deep dive kiến trúc và tài liệu nghề nghiệp. |
| `artifacts/` | Workbook/import template/sample data cho local demo hoặc import flow. |

## Functional Mapping & Code Location Guide

### 1. Authentication, OAuth, Profile, Address, Wishlist

**Purpose**

- Đăng ký, đăng nhập, refresh token, OAuth Google.
- Quản lý profile, avatar, địa chỉ mặc định, phone/email verification.
- Wishlist, wishlist alerts, notification preferences.

**Code locations**

- Gateway entry:
  - `api-gateway/internal/handler/user_handler.go`
  - `RegisterRoutes` ở `L24-L75`
- User HTTP boundary:
  - `services/user-service/internal/handler/user_handler.go`
  - `RegisterRoutes` ở `L60-L101`
  - `Register` ở `L111-L138`
  - `Login` ở `L148-L184`
  - `RefreshToken` ở `L193-L215`
- Auth core:
  - `services/user-service/internal/service/user_auth.go`
  - `Register` ở `L35-L97`
  - `Login` ở `L117-L136`
  - `ChangePassword` ở `L159-L178`
  - `buildAuthResponse` ở `L198-L214`
- OAuth flow:
  - `services/user-service/internal/service/oauth_service.go`
  - `BeginOAuth` ở `L70-L115`
  - `CompleteOAuthCallback` ở `L118-L169`
  - `ExchangeOAuthTicket` ở `L172-L193`
- Profile update flow:
  - `services/user-service/internal/service/user_profile.go`
  - `GetProfile` ở `L30-L37`
  - `UpdateProfile` ở `L60-L90`
  - `updateProfileWithDependencies` ở `L114-L203`
  - `applyVerifiedPhoneChange` ở `L228-L260`
- Persistence:
  - `services/user-service/internal/repository/user_repository.go`
  - `services/user-service/internal/repository/address_repository.go`
  - `services/user-service/internal/repository/notification_preference_repository.go`
  - `services/user-service/internal/repository/wishlist_repository.go`

**Important behaviors to study**

- Login protection được chặn ở handler trước khi gọi service: `services/user-service/internal/handler/user_handler.go:L160-L183`
- OAuth không trả access token trực tiếp từ callback, mà dùng short-lived login ticket để exchange: `oauth_service.go:L152-L193`
- Profile update có thể chạy transaction-safe qua `profileTxManager` nếu dependency có hỗ trợ: `user_profile.go:L61-L90`
- JWT claims mang theo `user_id`, `email`, `role`, giúp downstream service không phải gọi lại `user-service`: `pkg/middleware/auth.go:L22-L30`

**Configuration**

- JWT secret: `pkg/config/config.go:L219-L223`, default ở `L261-L262`
- Google OAuth config: `pkg/config/config.go:L98-L106`, default callback ở `L270-L272`
- Frontend base URL cho OAuth redirect: `pkg/config/config.go:L108-L110`, default ở `L280`

**Related tests**

- `services/user-service/internal/service/user_service_test.go`
- `services/user-service/internal/handler/oauth_handler_test.go`
- `services/user-service/internal/handler/login_protection_test.go`
- `services/user-service/internal/service/notification_preference_service_test.go`
- `services/user-service/internal/service/phone_verification_test.go`

### 2. Catalog, Search Assist, Search Analytics, Reviews

**Purpose**

- CRUD sản phẩm, listing catalog, detail, search assist, filter analytics, product reviews, optional media/search integrations.

**Code locations**

- Gateway route mirror:
  - `api-gateway/internal/handler/product_handler.go`
  - `RegisterRoutes` ở `L22-L45`
- Product HTTP boundary:
  - `services/product-service/internal/handler/product_handler.go`
  - `RegisterRoutes` ở `L50-L77`
  - `List` ở `L174-L222`
  - `SearchAssist` ở `L224-L251`
  - `GetSearchAnalytics` ở `L253-L276`
  - `RecordSearchEvent` ở `L278-L309`
- Catalog query logic:
  - `services/product-service/internal/service/product_queries.go`
  - `List` ở `L49-L83`
  - `GetSearchAnalytics` bắt đầu ở `L333`
- Search assist + analytics recording:
  - `services/product-service/internal/service/product_search_assist.go`
  - `GetSearchAssist` ở `L26-L52`
  - `recordSearchAnalyticsBestEffort` ở `L102-L130`
  - `RecordSearchEvent` ở `L132-L160`
- Review domain:
  - `services/product-service/internal/service/product_review_service.go`
  - `ListReviews` ở `L138-L187`
  - `CreateReview` ở `L215-L253`
- Persistence:
  - `services/product-service/internal/repository/product_repository.go`
  - `services/product-service/internal/repository/storefront_repository.go`
  - `services/product-service/internal/repository/search_analytics_repository.go`
  - `services/product-service/internal/repository/product_review_repository.go`

**Important behaviors to study**

- Search backend chỉ dùng khi phù hợp; nếu fail sẽ fall back về PostgreSQL thay vì làm chết listing: `product_queries.go:L52-L70`
- Listing chuẩn của catalog đi theo cursor pagination, không phải offset/page: `product_handler.go:L186-L221`
- Search assist có synonym expansion trước khi query repo: `product_search_assist.go:L32-L41`, `L54-L91`
- Search click/filter analytics được ghi best-effort, không làm fail shopper flow: `product_search_assist.go:L102-L160`
- Review service có cache, transaction manager, observer và benchmark riêng; đây là cụm source rất tốt để học refactor backend sạch: `product_review_service.go:L75-L136`

**Configuration**

- Search integration: `pkg/config/config.go:L136-L146`, defaults ở `L302-L310`
- Object storage: `pkg/config/config.go:L148-L155`, defaults ở `L293-L298`
- Review cache: `pkg/config/config.go:L192-L195`, defaults ở `L255-L256`

**Related tests**

- `services/product-service/internal/handler/product_handler_test.go`
- `services/product-service/internal/handler/storefront_handler_test.go`
- `services/product-service/internal/service/product_service_test.go`
- `services/product-service/internal/service/product_review_service_test.go`
- `services/product-service/internal/service/product_review_service_benchmark_test.go`

### 3. Cart, Checkout, Order, Returns, Payment

**Purpose**

- Giỏ hàng Redis.
- Preview order, create order, reserve stock, apply coupon, cancel order.
- Return request, return evidence, refund queue.
- Process payment, webhook MoMo, refund, payment history.

**Code locations**

- Cart service:
  - `services/cart-service/internal/service/cart_service.go`
  - `GetCart` ở `L70-L72`
  - `ClearCart` ở `L92-L94`
  - `services/cart-service/internal/service/cart_mutations.go`
  - `MergeCart` ở `L13-L45`
  - `AddItem` ở `L69-L98`
  - `UpdateItem` ở `L121-L139`
  - `RemoveItem` ở `L161-L181`
- Order gateway mirror:
  - `api-gateway/internal/handler/order_handler.go`
  - `RegisterRoutes` ở `L20-L70`
- Order HTTP boundary:
  - `services/order-service/internal/handler/order_handler.go`
  - `RegisterRoutes` ở `L29-L79`
  - `CreateOrder` ở `L89-L116`
  - `PreviewOrder` ở `L118-L133`
  - `GetReturnEligibility` ở `L149-L172`
  - `CreateReturn` ở `L174-L190`
  - `ListUserReturns` ở `L219-L242`
- Order lifecycle:
  - `services/order-service/internal/service/order_lifecycle.go`
  - `CreateOrder` ở `L42-L159`
  - `CancelOrder` ở `L241-L254`
  - `CancelOrderAsAdmin` ở `L277-L294`
  - `cancelOrderWithActor` bắt đầu ở `L318`
- Returns:
  - `services/order-service/internal/service/order_returns.go`
  - `CreateReturn` ở `L16-L78`
  - `ListUserReturns` ở `L104-L118`
  - `GetReturnQueueHealth` ở `L136-L145`
  - `RequestReturnRefund` ở `L181-L219`
- Payment core:
  - `services/payment-service/internal/service/payment_processing.go`
  - `ProcessPayment` ở `L43-L60`
  - `processPaymentCore` ở `L62-L227`
- Payment shell:
  - `services/payment-service/internal/service/payment_service.go`
  - `NewPaymentService` ở `L71-L87`

**Important behaviors to study**

- Cart luôn xin lại product snapshot authoritative từ `product-service`, không tin giá/stock cũ trong client: `cart_mutations.go:L75-L98`, `L204-L216`
- `order-service` dùng idempotency key + request hash trước khi persist order: `order_lifecycle.go:L50-L70`
- Order create flow quote trước, reserve stock, rồi mới persist + outbox; rollback stock khi persist fail: `order_lifecycle.go:L72-L149`
- Return flow là local transaction + async refund scheduling, không gọi refund gateway ngay trong API đồng bộ: `order_returns.go:L178-L219`
- `payment-service` verify order ownership bằng HTTP call sang `order-service` trước khi charge: `payment_processing.go:L83-L101`
- Payment cũng có idempotency record riêng, và MoMo được giữ `pending` cho đến webhook: `payment_processing.go:L48-L60`, `L154-L169`

**Configuration**

- Downstream service URLs: `pkg/config/config.go:L78-L87`, defaults ở `L273-L279`
- Payment gateway config: `pkg/config/config.go:L125-L128`, defaults ở `L291-L292`

**Related tests**

- `services/cart-service/internal/service/cart_service_test.go`
- `services/order-service/internal/service/order_service_test.go`
- `services/order-service/internal/service/order_return_eligibility_test.go`
- `services/order-service/internal/handler/order_handler_test.go`
- `services/payment-service/internal/service/payment_service_test.go`

### 4. Notification Inbox, Delivery Audit, Retry/Backoff, Wishlist Alerts

**Purpose**

- Consume RabbitMQ event từ order/payment/return.
- Gửi email có preference-aware delivery.
- Lưu inbox lịch sử cho user.
- Lưu audit item cho admin.
- Retry với backoff và DLQ-safe classification.
- Poll wishlist alerts định kỳ.

**Code locations**

- Notification gateway mirror:
  - `api-gateway/internal/handler/notification_handler.go`
  - `RegisterRoutes` ở `L19-L26`
- Event consumer:
  - `services/notification-service/internal/handler/event_handler.go`
  - `HandleMessage` ở `L127-L248`
  - `processMessage` ở `L250-L303`
  - `handleOrderCreated` ở `L305-L340`
  - `handlePaymentCompleted` bắt đầu ở `L342`
- Inbox + audit API:
  - `services/notification-service/internal/handler/inbox_handler.go`
  - `List` ở `L31-L55`
  - `MarkRead` ở `L57-L82`
  - `Audit` ở `L84-L104`
- Wishlist poller:
  - `services/notification-service/internal/service/wishlist_alert_worker.go`
  - `Start` ở `L63-L82`
  - `runCycle` ở `L84-L103`
  - `deliver` ở `L105-L131`
- Supporting stores and messaging:
  - `services/notification-service/internal/inbox/history_store.go`
  - `services/notification-service/internal/messaging/retry_publisher.go`
  - `services/notification-service/internal/messaging/queue_monitor.go`

**Important behaviors to study**

- Duplicate suppression và processing claim dùng Redis, không giữ state ở process memory: `event_handler.go:L139-L170`
- Retry không requeue mù quáng; phân biệt permanent failure, retry exhaustion và retry scheduling: `event_handler.go:L171-L231`
- Notification delivery audit được lưu như history item và expose ra route admin riêng: `inbox_handler.go:L84-L104`
- Wishlist alerts là poll worker có deduper, phù hợp local/dev hơn là thêm scheduler stack mới: `wishlist_alert_worker.go:L63-L131`

**Configuration**

- Notification worker config: `pkg/config/config.go:L112-L123`, defaults ở `L281-L290`

**Related tests**

- `services/notification-service/internal/handler/event_handler_test.go`
- `services/notification-service/internal/service/wishlist_alert_worker_test.go`

### 5. Gateway, Shared Middleware, Config, Observability

**Purpose**

- Giữ HTTP entrypoint thống nhất.
- Áp auth, rate limit, tracing, logging, response envelope, config loading.

**Code locations**

- Gateway boot:
  - `api-gateway/cmd/main.go`
  - config/load ở `L24-L30`
  - proxy wiring ở `L59-L75`
  - middleware stack ở `L76-L105`
- Reverse proxy core:
  - `api-gateway/internal/proxy/service_proxy.go`
  - `NewServiceProxy` ở `L44-L70`
  - `normalizeBaseURL` ở `L72-L80`
- Shared JWT auth:
  - `pkg/middleware/auth.go`
  - `JWTAuth` ở `L43-L87`
  - `RequireRole` ở `L98-L123`
- Config loader:
  - `pkg/config/config.go`
  - config struct ở `L20-L40`
  - `Load` bắt đầu ở `L236`
  - default service URLs ở `L273-L279`
  - frontend/payment defaults ở `L280-L292`
- Tracing:
  - `pkg/observability/tracing.go`
  - `SetupTracing` ở `L25-L64`
  - `EchoMiddleware` ở `L66-L118`
- Response envelope:
  - `pkg/response/response.go`
  - `Response` ở `L20-L27`
  - `Success` ở `L39-L45`
  - `SuccessWithMeta` ở `L48-L55`
  - `Error` ở `L58-L64`
- Logger:
  - `pkg/logger/logger.go`
  - `New` ở `L24-L59`

**Important behaviors to study**

- Gateway giữ contract `/api/v1/...` giống downstream service để proxy không phải rewrite path: `api-gateway/cmd/main.go:L96-L105`
- Proxy có `CheckRedirect` để OAuth redirect còn nguyên cho browser: `service_proxy.go:L48-L57`
- Tracing middleware attach request context và request id xuyên service boundary: `tracing.go:L72-L139`
- Response envelope được chuẩn hóa trong `pkg/response`, nên handler không tự bịa JSON shape riêng

## Skill Development Insights & Learning Opportunities

### Architectural patterns worth studying

- Thin gateway: `api-gateway` chỉ mount route và forward, không ôm domain logic.
- Consumer-side interfaces: `productCatalog`, `orderLookup`, `paymentHistorySource`, `notificationPreferenceReader` đều được đặt ở nơi dùng dependency, không đặt interface vô nghĩa ở mọi package.
- Source-of-truth discipline:
  - cart/order hỏi `product-service` cho giá và stock thật
  - payment hỏi `order-service` cho order thật
  - notification chỉ consume event, không tự suy diễn business state
- Transaction + outbox:
  - order create/cancel và return refund scheduling đều ghép write state với outbox trong cùng repo transaction
- Inbox + retry pattern:
  - notification xử lý duplicate/retry/backoff/DLQ theo hướng đủ production mà vẫn đơn giản
- Graceful degradation:
  - `product-service` có thể chạy không cần search backend hoặc object storage mà flow chính vẫn sống

### Code quality indicators to emulate

- Service comments khá tốt: nhiều hàm service đã mô tả inputs, returns, edge cases, side effects, performance. Đây là kiểu comment hữu ích vì giải thích intent và tradeoff.
- Domain naming rõ: `CreateOrder`, `RequestReturnRefund`, `ExchangeOAuthTicket`, `RecordSearchEvent`.
- Observability được cài vào đường chính, không phải phụ kiện thêm sau:
  - tracing ở `pkg/observability/tracing.go`
  - structured logging ở `pkg/logger/logger.go`
  - request logging/rate limit ở middleware dùng chung
- Test coverage bám business flow:
  - auth/login/password/OAuth
  - cart mutation
  - order idempotency/returns/refund queue
  - payment idempotency/webhook
  - notification retry/duplicate handling
- Benchmark đã xuất hiện ở `product_review_service_benchmark_test.go`; đây là tín hiệu tốt để học tối ưu dựa trên số liệu thay vì cảm giác.

### Repo-specific pitfalls to avoid

1. Đừng nhét business logic vào gateway.
   - `api-gateway/cmd/main.go:L96-L105` và các `internal/handler/*` cho thấy gateway chỉ nên mirror route và forward.

2. Đừng assume `config.Load(serviceName)` tự namespace env vars theo service.
   - `pkg/config/config.go:L225-L333` có ghi rõ `serviceName` hiện chỉ chủ yếu dùng cho default như `database.dbname`; không có `SetEnvPrefix`.

3. Đừng thêm feature shopper mới vào `frontend/`.
   - Runtime ownership của repo đã chốt: `client/` là storefront/account; `frontend/` là admin/workbook. Nếu tiếp tục làm shopper ở cả hai nơi, effort sẽ bị nhân đôi.

4. Đừng bỏ qua optional dependency failure mode.
   - `product_queries.go:L52-L70` cho thấy search backend có thể fail và phải rơi về PostgreSQL sạch sẽ.

5. Đừng quên áp idempotency cho write flow có side effect.
   - `order_lifecycle.go:L50-L70` và `payment_processing.go:L48-L60` là pattern nên tái dùng khi thêm webhook hay write API mới.

6. Đừng coi `COUNT(*) + OFFSET/LIMIT` là miễn phí.
   - `services/order-service/internal/repository/order_repository.go:L413-L425` và `L678-L686` cho thấy admin listing vẫn đang đi theo hướng này; khi dữ liệu tăng, đây là điểm cần refactor.

## Future Development & Enhancement Suggestions

### High-impact, low-effort

1. Thêm filter cho notification delivery audit.
   - Where: `services/notification-service/internal/handler/inbox_handler.go`, `history_store.go`, admin API trong `frontend`.
   - Why: support sẽ cần lọc theo `routing_key`, `delivery_status`, `date range`.
   - Learning value: query design cho operational tooling.

2. Thêm search funnel analytics nhẹ.
   - Where: mở rộng `product_search_event_metrics` để theo dõi `query -> click -> add_to_cart -> order`.
   - Why: dữ liệu hiện tại mới dừng ở query/filter/click.
   - Learning value: event modeling, aggregation bằng PostgreSQL, báo cáo product decisions.

3. Chuẩn hóa guide đọc code theo flow ở root README.
   - Where: link tài liệu này từ `README.md`.
   - Why: người mới thường mở nhầm doc cũ hoặc nhảy thẳng vào file service lớn.

### Medium-effort, strategic

1. Chuyển admin order listing sang keyset/cursor pagination.
   - Where: `services/order-service/internal/repository/order_repository.go`
   - Why: giảm chi phí `COUNT(*) + OFFSET` khi dữ liệu lớn.
   - Learning value: pagination design, index strategy, API compatibility.

2. Mở rộng outbox/inbox nhất quán hơn cho các publish path còn lại.
   - Where: order/payment/notification boundary.
   - Why: repo đã có pattern tốt, nên nhân rộng thay vì thêm workaround cục bộ.
   - Learning value: reliable messaging, retry semantics, operational debugging.

3. Tách nhỏ các file handler/page đang phình to.
   - Where:
     - `services/order-service/internal/handler/order_handler.go`
     - `client/src/components/catalog-page.tsx`
   - Why: file lớn vẫn đọc được nhưng sẽ khó tiếp tục mở rộng nếu không chia helper theo intent.
   - Learning value: refactor không đổi behavior.

### Long-term, high-value for backend career growth

1. Product import flow chính thức trong `product-service`.
   - Dùng `artifacts/import-templates/` làm input thật, thay vì để workbook là công cụ bán-thủ-công.
   - Đây là feature tốt để học file ingestion, validation, upsert, transaction và observability.

2. Notification delivery ops đầy đủ hơn.
   - Thêm audit theo template/channel, retry histogram, manual replay tool cho support.
   - Đây là nơi tốt để học worker operations mà không cần tạo service mới.

3. Search relevance tuning bằng dữ liệu thật.
   - Dùng analytics hiện có để cải thiện synonym map, zero-result handling và merchandising.
   - Đây là bài toán backend rất tốt vì đòi hỏi query design, measurement và controlled rollout.

## How To Use This Guide

1. Khi onboarding:
   - đọc `README.md`
   - đọc `docs/deep-dive/system-overview.md`
   - đọc tài liệu này

2. Khi debug một flow:
   - bắt đầu từ route trong `api-gateway/internal/handler/*`
   - nhảy sang `services/<service>/internal/handler/*`
   - theo function chính trong `internal/service/*`
   - kết thúc ở `internal/repository/*` hoặc client/gRPC call

3. Khi thêm feature:
   - tìm service source of truth
   - kiểm tra config trong `pkg/config/config.go`
   - xem test hiện có gần nhất
   - chỉ sau đó mới sửa UI

4. Khi học để phát triển nghề backend Go:
   - học cụm auth trong `user-service` để hiểu boundary/authz
   - học cụm product review/search để hiểu performance và optional dependency
   - học cụm order/payment để hiểu idempotency, transaction, outbox
   - học cụm notification để hiểu inbox, retry, backoff, DLQ

5. Khi review code:
   - tự hỏi service nào là source of truth
   - flow có transaction/idempotency chưa
   - dependency lỗi thì degrade thế nào
   - test có bám business rule chính chưa

## Recommended Reading Order After This Guide

1. [03-source-reading-roadmap.md](./03-source-reading-roadmap.md)
2. [06-testing-and-verification.md](./06-testing-and-verification.md)
3. [09-how-to-add-new-feature.md](./09-how-to-add-new-feature.md)
4. [11-senior-source-code-review-guide.md](./11-senior-source-code-review-guide.md)
5. [17-performance-feature-parity-roadmap.md](./17-performance-feature-parity-roadmap.md)

Nếu mục tiêu của bạn là phát triển theo hướng backend Golang, cụm đáng đọc kỹ nhất sau tài liệu này là:

- `services/user-service/internal/service/`
- `services/product-service/internal/service/`
- `services/order-service/internal/service/`
- `services/payment-service/internal/service/`
- `services/notification-service/internal/handler/`
