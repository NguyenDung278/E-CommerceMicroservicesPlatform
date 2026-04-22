# Backend Learning Guide

Tài liệu này dành cho người muốn **đọc hiểu toàn bộ backend thật sự**, không chỉ đọc README hay nhìn sơ qua folder tree.

Mục tiêu:

- biết bắt đầu từ đâu để không bị ngợp
- hiểu cách repo này tổ chức backend Go microservices
- biết function nào đáng đọc nhất của từng service
- hiểu pattern nào đang được áp dụng đúng, pattern nào còn nửa vời
- có bài tập cụ thể để nâng tay từ Junior lên Mid/Senior backend Go

---

## 1. Cách Học Repo Này Không Bị Lạc

### 1.1. Đừng đọc theo tên file, hãy đọc theo luồng

Sai lầm phổ biến:

- mở ngẫu nhiên `repository.go` trước
- đọc mỗi handler rồi kết luận mình đã hiểu feature
- nhìn `main.go` lướt qua mà bỏ qua startup wiring

Cách đúng:

1. mở `cmd/main.go`
2. xem route hoặc gRPC server
3. tìm service method chính
4. xuống repository khi cần hiểu persistence, transaction, outbox, inbox, pagination
5. quay lại test để xem assumption nào đã được khóa

### 1.2. Hãy phân biệt rõ 4 tầng

| Tầng | Nhiệm vụ |
| --- | --- |
| Handler | Parse request, validate boundary, map error sang HTTP/gRPC |
| Service | Business logic, orchestration, invariant |
| Repository | SQL/Redis primitive, transaction, lock, scan row |
| Integration client / worker | Giao tiếp với service ngoài, broker, storage, background runtime |

Nếu đọc code mà thấy repository “biết” HTTP status hay handler “biết” SQL, đó là tín hiệu layering đang xấu đi.

### 1.3. Hãy ưu tiên đọc theo 3 câu hỏi

1. Source of truth của dữ liệu này nằm ở service nào?
2. Function nào quyết định business invariant?
3. Nếu dependency phụ chết, flow này degrade hay fail hẳn?

---

## 2. Bản Đồ Học Toàn Backend

### 2.1. Thứ tự học tổng thể được khuyến nghị

1. `api-gateway`
2. `pkg/config`, `pkg/middleware`, `pkg/observability`, `pkg/response`
3. `product-service`
4. `cart-service`
5. `user-service`
6. `order-service`
7. `payment-service`
8. `notification-service`

### 2.2. Vì sao theo thứ tự này

- `api-gateway` cho bạn thấy request đi vào thế nào
- `pkg/*` cho bạn thấy backend platform layer của repo
- `product-service` khá rõ ràng, giúp học CRUD + search + cache + gRPC
- `cart-service` nhỏ, giúp nhìn separation handler/service/repository rất sạch
- `user-service` rộng, nhưng khi đã hiểu foundation thì đọc sẽ đỡ bị ngợp
- `order-service` và `payment-service` là phần orchestration khó nhất
- `notification-service` là phần reliability/async nâng cao nhất

---

## 3. Phần Nền Bắt Buộc Phải Đọc Trước

## 3.1. `api-gateway`

### Nên đọc file nào

1. `api-gateway/cmd/main.go`
2. `api-gateway/internal/proxy/service_proxy.go`
3. `api-gateway/internal/proxy/service_proxy_request.go`

### Học được gì

- gateway mỏng nên được viết ra sao
- retry/circuit breaker nên đặt ở transport layer
- cách preserve redirect cho OAuth
- cách forward trace/request-id xuống downstream service

### Function đáng học

| Function | Bài học |
| --- | --- |
| `NewServiceProxy` | Proxy không cần framework nặng, chỉ cần HTTP client + circuit breaker |
| `Do` | Entry point rõ ràng cho request forwarding |
| `newBackendRequest` | Clone request đúng cách |
| `executeWithResilience` | Retry chỉ cho method idempotent |

### Cách đọc `api-gateway` cho đúng

1. Mở `api-gateway/cmd/main.go`
   - Đừng đọc lướt.
   - Ghi ra theo đúng thứ tự:
     - config
     - logger
     - tracing
     - create proxies
     - create handlers
     - register middleware
     - register routes
     - start server
   - Đây là nơi bạn hiểu gateway là một runtime process thực sự, không phải chỉ là “chỗ forward request”.
2. Mở `internal/handler/*_handler.go`
   - Đọc `RegisterRoutes` của `user`, `product`, `order`, `payment`, `notification`.
   - Mục tiêu là nhìn public ingress surface của toàn hệ thống.
   - Đây là source map của API layer ở edge.
3. Mở `internal/handler/proxy_handler.go`
   - Đọc `forwardWithProxy`.
   - Đây là helper làm gateway handler không bị lặp request forwarding code.
4. Mở `internal/proxy/service_proxy_request.go`
   - Đọc theo block:
     - `Do`
     - `newBackendRequest`
     - `executeWithResilience`
     - `cloneRetryableRequest`
     - `shouldRetry`
   - Bạn phải nhìn ra rõ:
     - path/query/body/header được clone ra sao
     - method nào mới được retry
     - vì sao redirect phải được preserve
5. Mở `internal/proxy/service_proxy_response.go`
   - Đọc `ForwardResponse` và `copyHeaders`.
   - Đây là nơi khẳng định gateway stream response nguyên trạng thay vì decode/encode lại.

### Dấu Hiệu Bạn Đã Hiểu `api-gateway` Đúng Cách

1. Bạn giải thích được vì sao gateway route mirror explicit tốt hơn wildcard proxy mù.
2. Bạn giải thích được vì sao retry chỉ cho `GET/HEAD/OPTIONS`.
3. Bạn giải thích được vì sao preserve redirect quan trọng cho OAuth.
4. Bạn nhìn ra gateway là transport boundary, không phải domain layer.

## 3.2. `pkg/config`

### Nên đọc file nào

- `pkg/config/config.go`

### Học được gì

- một config contract chung cho nhiều service
- defaults cho local/dev
- nơi nào chứa env contract của toàn hệ thống

### Điều nên chú ý

- `Config` hiện gom gần như mọi cấu hình backend
- `ServicesConfig` cho biết service nào gọi service nào
- nếu thêm config mới, phải giữ đồng bộ với runtime config trong docker deployment

### Walkthrough Khi Đọc `pkg/config`

1. Mở `Config` struct trước
   - Đừng lao ngay xuống `Load`.
   - Mục tiêu là hiểu config contract của toàn backend gồm những nhóm nào:
     - server
     - database
     - redis
     - rabbitmq
     - jwt
     - grpc
     - smtp
     - oauth
     - services
     - frontend
     - notification
     - payment gateway
     - object storage
     - tracing
     - search
     - bootstrap
     - telegram
     - email verification
2. Đọc các helper nhỏ:
   - `DatabaseConfig.DSN()`
   - `RedisConfig.Addr()`
   - `RabbitMQConfig.URL()`
   - `SMTPConfig.Addr()`
   - Những helper này tưởng nhỏ nhưng giúp phần còn lại của repo không phải format connection string lặp lại.
3. Sau đó mới đọc `Load`
   - Ghi lại thứ tự:
     - set default
     - load config file nếu có
     - env override
     - unmarshal
   - Điểm cần nhớ là `serviceName` hiện chủ yếu ảnh hưởng default `database.dbname`, chứ chưa prefix env namespace thật sự.

## 3.3. `pkg/database`

### Nên đọc file nào

- `pkg/database/postgres.go`

### Học được gì

- vì sao repo dùng `database/sql` thay vì ORM
- connection pool cơ bản nên set thế nào
- migration embedded nên được chạy ở đâu

### Walkthrough Khi Đọc `pkg/database`

1. Đọc comment đầu file trước
   - Nó nói rất thẳng triết lý của repo: raw SQL, dễ profile, ít magic.
2. Đọc `NewPostgresDB`
   - `sql.Open`
   - set pool
   - `Ping`
   - Đây là pattern fail-fast chuẩn.
3. Đọc `RunPostgresMigrations`
   - driver postgres
   - `iofs` source
   - `migrator.Up()`
   - ignore `ErrNoChange`
4. Điều cần rút ra
   - service nào sở hữu PostgreSQL thì tự chạy migration lúc boot
   - repo không có migration runner tách riêng làm source of complexity mới

## 3.4. `pkg/middleware`

### Nên đọc file nào

1. `pkg/middleware/auth.go`
2. `pkg/middleware/rate_limit.go`
3. `pkg/middleware/logging.go`

### Học được gì

- JWT guard ở Echo
- Redis-backed rate limit có fallback in-memory
- structured logging cho HTTP request

### Walkthrough Khi Đọc `pkg/middleware`

1. `auth.go`
   - Đọc `JWTClaims` trước để biết downstream handler sẽ nhận được gì.
   - Sau đó đọc `JWTAuth`:
     - extract bearer token
     - parse claims
     - verify HMAC signing method
     - attach claims vào context
   - Cuối cùng đọc `RequireRole`.
2. `rate_limit.go`
   - Đọc `NewRateLimiter` trước để hiểu baseline in-memory.
   - Sau đó đọc `NewRedisBackedRateLimiter`:
     - ping Redis lúc startup
     - fallback in-memory nếu Redis unavailable
     - ở request path, Redis fail thì vẫn fallback local
   - Cuối cùng đọc Lua token bucket script.
3. `logging.go`
   - Đọc field list trong `RequestLogger`.
   - Học cách repo log `request_id`, `user_id`, `trace_id`, `span_id` cùng request metadata.
4. `cors.go`
   - Đây là file rất ngắn nhưng là nơi trust browser origin được định nghĩa explicit.

### Dấu Hiệu Bạn Đã Hiểu `pkg/middleware` Đúng Cách

1. Bạn giải thích được vì sao rate limiter của gateway ưu tiên availability hơn strict global consistency.
2. Bạn giải thích được vì sao role check phải đứng sau JWT parse.
3. Bạn giải thích được vì sao request logger cần log route thực chứ không chỉ raw path.

## 3.5. `pkg/observability`

### Nên đọc file nào

1. `pkg/observability/tracing.go`
2. `pkg/observability/context.go`
3. `pkg/observability/grpc.go`

### Học được gì

- trace context propagation
- request ID propagation
- instrument outbound HTTP transport

### Walkthrough Khi Đọc `pkg/observability`

1. `tracing.go`
   - Đọc `SetupTracing`:
     - propagator
     - exporter
     - tracer provider
     - sampler
   - Sau đó đọc `EchoMiddleware`.
   - Sau đó đọc `WrapHTTPTransport`.
2. `context.go`
   - Đọc `RequestIDMiddleware`, `WithRequestID`, `RequestIDFromContext`, `LoggerWithContext`.
   - Đây là chỗ nối request id với logger.
3. `grpc.go`
   - Đọc `GRPCUnaryServerInterceptor` và `GRPCUnaryClientInterceptor`.
   - Mục tiêu là thấy trace/request-id không chỉ đi qua HTTP mà còn qua gRPC metadata.

### Dấu Hiệu Bạn Đã Hiểu `pkg/observability` Đúng Cách

1. Bạn giải thích được đường đi của request id từ header -> context -> outbound client -> log.
2. Bạn giải thích được vì sao `WrapHTTPTransport` quan trọng hơn chỉ “bật tracing ở server”.
3. Bạn giải thích được vì sao service code nên dùng `LoggerWithContext`.

## 3.6. `pkg/response`, `pkg/validation`, `pkg/logger`

### Nên đọc file nào

1. `pkg/response/response.go`
2. `pkg/validation/validator.go`
3. `pkg/logger/logger.go`

### Học được gì

- vì sao response envelope nhất quán giúp API dễ tiêu thụ hơn
- cách Echo validation được chuẩn hóa
- cách log format được giữ thống nhất giữa các service

### Walkthrough Khi Đọc

1. `pkg/response`
   - Đọc `Response`, `Meta`, `Success`, `SuccessWithMeta`, `Error`.
   - Học cách repo cùng lúc hỗ trợ pagination kiểu page/limit và cursor.
2. `pkg/validation`
   - Đọc `New()` để hiểu vì sao JSON tag được ưu tiên trong error message.
   - Đọc `Validate()` và `formatValidationErrors()`.
   - Đây là lý do validation error của repo khá dễ đọc ở phía client.
3. `pkg/logger`
   - Đọc `New(serviceName)`.
   - Nhìn cách repo chọn dev console encoder vs production JSON encoder.
   - Nhìn `zap.Fields(zap.String("service", serviceName))` để thấy service field được attach một lần từ root.

## 3.7. Client Và Downstream Call Pattern

### Nên đọc file nào

1. `services/payment-service/internal/client/order_client.go`
2. `services/order-service/internal/client/payment_client.go`
3. `services/order-service/internal/grpc_client/product_client.go`
4. `services/notification-service/internal/client/user_client.go`
5. `services/user-service/internal/client/product_client.go`
6. `services/cart-service/internal/grpc_client/product_client.go`

### Học được gì

- cách service gọi service khác mà vẫn giữ observability
- envelope decode explicit thay vì generic helper quá thông minh
- internal JWT ngắn hạn được dùng ra sao cho protected inter-service route
- gRPC client interceptor giúp trace/request-id đi xuyên boundary thế nào

### Walkthrough Khi Đọc

1. So sánh `payment-service/internal/client/order_client.go` với `order-service/internal/client/payment_client.go`
   - một bên forward auth header gốc của user
   - một bên tự ký service token để gọi admin/staff route
2. Đọc `notification-service/internal/client/user_client.go`
   - `PreferenceMap` ký token user-scoped để gọi preference route
   - `ListDispatchableWishlistAlerts` ký token admin-scoped để gọi admin alert route
   - Đây là file rất đáng học vì nó cho thấy inter-service auth hiện tại của repo vận hành ra sao
3. Đọc gRPC client của `cart-service` và `order-service`
   - Nhìn `GRPCUnaryClientInterceptor`
   - Nhìn cách error raw từ gRPC được service layer map lại thành domain error

## 3.8. Family Helper Dễ Bị Bỏ Qua Nhưng Rất Đáng Học

### Family nên nhận diện

1. `normalize*`
   - ví dụ: `normalizeBaseURL`, `normalizePaymentMethod`, `normalizeShippingMethod`, `normalizeListProductsQuery`
2. `resolve*`
   - ví dụ: `resolveOptionalPhone`, `resolvePrimaryImage`, `resolveOAuthCallbackURL`
3. `build*`
   - ví dụ: `buildCreatedOrderOutbox`, `buildPaymentOutboxMessage`, `buildHistoryItem`
4. `scan*`
   - ví dụ: `scanOrder`, `scanPayment`, `scanProductReviewRow`
5. `encode/decode*Cursor`
   - product/order list cursor helper

### Vì sao nên học nhóm này

- Junior thường chỉ đọc hàm “to” như `CreateOrder`, `ProcessPayment`, `UpdateProfile`
- Nhưng invariant thật của repo lại thường được giữ bằng các helper nhỏ đúng tên và đúng intent
- Nếu đọc được các family này, bạn sẽ bắt đầu nhìn code như một Senior hơn là chỉ đọc flow tuyến tính

---

## 4. Học Theo Từng Service

## 4.1. product-service

### Mục đích chính

Học catalog source of truth, optional search backend, stock mutation, storefront batching, review cache/observer, và gRPC contract nội bộ.

### Thứ tự đọc

1. `services/product-service/cmd/main.go`
2. `internal/handler/product/product_handler.go`
3. `internal/service/product_crud.go`
4. `internal/service/product_queries.go`
5. `internal/service/storefront_service.go`
6. `internal/service/product_review_service.go`
7. `internal/repository/product/*`
8. `internal/grpc/product_grpc.go`

### Function nên tập trung

#### `ProductService.List`
- **Chức năng:** Catalog list dùng search backend khi phù hợp và fallback PostgreSQL khi cần.
- **Điều đáng học:** Không thần thánh hóa search engine; source of truth vẫn là PostgreSQL.

#### `ProductService.Create`
- **Chức năng:** Normalize request rồi persist product.
- **Điều đáng học:** Helper `normalize*`, `resolve*`, `trim*` giúp create/update flow sạch hơn nhiều.

#### `ProductService.DecreaseStock`
- **Chức năng:** Inventory mutation cho order flow.
- **Điều đáng học:** Inventory mutation nên rõ semantics tăng/giảm, không dùng một hàm “update stock” mơ hồ.

#### `StorefrontService.GetHome`
- **Chức năng:** Ghép dữ liệu home page trong một read orchestration.
- **Điều đáng học:** Batch query tránh `N+1`.

#### `ProductReviewService.CreateReview`
- **Chức năng:** Review write path với tx + summary delta + observer.
- **Điều đáng học:** Cache invalidation không nên nhét cứng vào service core; observer chain là một cách sạch hơn.

### Điểm mạnh của implementation

- PostgreSQL vẫn là source of truth dù có search và cache.
- Review service có tracer, metrics observer, cache invalidation observer.
- Storefront service biểu diễn read orchestration rõ ràng.

### Pitfall nên ghi nhớ

- Review list vẫn offset-based.
- Search synonym đang hard-code trong code.
- Stock mutation có pre-read trước atomic update, chưa tối ưu nhất.

### Bài tập nên làm

1. Chuyển review list sang cursor pagination.
2. Tách synonym search ra config hoặc database table.
3. Bổ sung dashboard cho tỷ lệ search fallback PostgreSQL.

### Walkthrough Thực Chiến Khi Tự Đọc `product-service`

`product-service` có nhiều mặt: catalog CRUD, search-aware listing, storefront read model, review domain, inventory mutation. Nếu đọc lộn thứ tự, bạn rất dễ bị cảm giác service này “quá to” trong khi thực ra nó có các vùng khá rõ.

1. Mở `internal/handler/product/product_handler.go`
   - Chỉ nhìn `RegisterRoutes` trước.
   - Tách ngay trong đầu ba vùng:
     - public catalog/search
     - admin catalog management
     - authenticated review routes
2. Đọc `List`
   - Đây là cửa vào tốt nhất để hiểu catalog listing thật sự chạy thế nào.
   - Bạn cần thấy handler chỉ parse filter/sort/cursor rồi gọi service.
3. Mở `internal/service/product_queries.go`
   - Đọc `List` chậm theo block:
     - normalize query
     - quyết định có dùng search backend hay không
     - nếu dùng search thì search chỉ trả ID
     - hydrate full row từ PostgreSQL qua `ListByIDs`
     - nếu search fail thì fallback PostgreSQL cursor listing
     - record analytics best-effort
   - Đây là bài học rất quan trọng: search engine không thay thế database source of truth.
4. Mở `internal/repository/product/product_repository.go`
   - Tìm hàm `List`.
   - Đọc phần decode cursor, append filter clause, `ORDER BY`, `LIMIT + 1`, encode next cursor.
   - Nếu không đọc repo này, bạn sẽ không hiểu vì sao catalog pagination của repo khá ổn.
5. Quay lại `product_crud.go`
   - Đọc `Create`, `Update`, `Delete`.
   - Mục tiêu là thấy write path catalog giữ rất rõ nguyên tắc:
     - normalize trước
     - persist PostgreSQL trước
     - search index chỉ best-effort sau đó
6. Đọc `product_queries.go` tiếp với `DecreaseStock` và `RestoreStock`
   - Bạn phải nhìn ra inventory mutation không dùng hàm mơ hồ kiểu “update stock”, mà dùng semantics tăng/giảm rõ ràng.
   - Sau đó mở repo để xem atomic SQL:
     - decrement với `WHERE stock >= $1`
     - increment đơn giản cho restore
7. Mở `internal/handler/product/storefront_handler.go`
   - Đọc `GetHome`, `ListCategories`, `GetCategoryPage`.
   - Rồi mở `internal/service/storefront_service.go`.
   - Đây là nơi bạn học batching storefront thay vì N+1.
8. Mở `internal/service/product_review_service.go`
   - Đọc `CreateReview`, `UpdateReview`, `DeleteReview`.
   - Tập trung vào pattern:
     - verify product tồn tại
     - `runInTx`
     - update review summary bằng delta
     - observer notify sau commit
9. Mở `internal/repository/product/product_review_repository.go`
   - Đọc `CreateReview`, `DeleteReviewByProductAndUser`, `ApplyReviewSummaryDelta`.
   - Đây là chỗ repo cho thấy review domain không chỉ “insert comment”, mà còn cập nhật summary table đúng cách.

### Dấu Hiệu Bạn Đã Hiểu `product-service` Đúng Cách

1. Bạn giải thích được vì sao search path vẫn phải hydrate product từ PostgreSQL.
2. Bạn giải thích được vì sao storefront service cần batch repository method thay vì loop từng category.
3. Bạn giải thích được vì sao review observer nên chạy sau transaction core.
4. Bạn giải thích được vì sao `DecreaseStock` và `RestoreStock` tốt hơn một hàm `UpdateStock` mơ hồ.

## 4.2. cart-service

### Mục đích chính

Học một service nhỏ nhưng chuẩn: Redis persistence, gRPC lookup, handler mỏng, service rõ invariant.

### Thứ tự đọc

1. `services/cart-service/cmd/main.go`
2. `internal/handler/cart/cart_handler.go`
3. `internal/service/cart/cart_service.go`
4. `internal/service/cart/cart_mutations.go`
5. `internal/service/cart/cart_helpers.go`
6. `internal/repository/cart/cart_repository.go`

### Function nên tập trung

#### `CartService.AddItem`
- **Điều đáng học:** Product truth luôn phải reload từ `product-service`, không tin snapshot cũ.

#### `CartService.MergeCart`
- **Điều đáng học:** Guest cart merge là một use case nhỏ nhưng rất thực tế; cách repo làm khá sạch.

#### `getProductForCart`
- **Điều đáng học:** Adapter giữa gRPC error và domain error.

### Điểm mạnh

- Code ít abstraction thừa.
- Cart save là one-shot overwrite, dễ hiểu.
- TTL 7 ngày ở repository rất hợp lý cho cart.

### Pitfall

- `UpdateItem` chưa refresh product truth.
- Concurrent write có risk lost update.

### Bài tập nên làm

1. Sửa `UpdateItem` để re-check stock và refresh price.
2. Thêm batch product lookup cho `MergeCart`.
3. Thêm `ValidateCartForCheckout`.

### Walkthrough Thực Chiến Khi Tự Đọc `cart-service`

`cart-service` nhỏ nhưng là ví dụ rất tốt cho một microservice focused, ít abstraction thừa, rule rõ.

1. Mở `internal/handler/cart/cart_handler.go`
   - Đọc `RegisterRoutes` để thấy service chỉ có đúng 6 route.
   - Sau đó đọc `AddItem` và `MergeCart`.
   - Mục tiêu là thấy handler không tự đụng Redis hay gRPC.
2. Đọc `AddItem`
   - Tự hỏi:
     - user identity lấy từ đâu
     - boundary validation nằm ở đâu
     - business error nào được map riêng
   - Bạn sẽ thấy pattern của repo rất nhất quán.
3. Mở `internal/service/cart/cart_mutations.go`
   - Đọc `AddItem` theo block:
     - `loadCart`
     - `getProductForCart`
     - `findCartItemIndex`
     - `mergeCartItem` hoặc `newCartItem`
     - `saveCart`
   - Đây gần như là toàn bộ business write path của cart.
4. Đọc tiếp `MergeCart`
   - Lưu ý service loop qua guest items nhưng chỉ save một lần ở cuối.
   - Đây là chi tiết nhỏ nhưng thực tế: nhiều remote read, một local write.
5. Đọc `UpdateItem`
   - Đây là chỗ bạn phải chủ động phát hiện gap.
   - Service chỉ sửa quantity, không refresh price/stock từ `product-service`.
   - Nếu không tự nhìn ra chỗ này, bạn mới chỉ đọc code theo nghĩa “chạy qua”, chưa thật sự phân tích.
6. Mở `internal/service/cart/cart_helpers.go`
   - Đọc `loadCart`, `saveCart`, `getProductForCart`.
   - Đây là nơi hiểu rõ boundary:
     - Redis chỉ lưu cart snapshot
     - `product-service` mới là nguồn truth cho product
7. Mở `internal/repository/cart/cart/cart_repository.go`
   - Đọc `Get`, `Save`, `Delete`.
   - Bạn cần nhận ra 3 đặc điểm:
     - storage là JSON blob
     - TTL 7 ngày được refresh sau read/save
     - update model là whole-cart overwrite

### Dấu Hiệu Bạn Đã Hiểu `cart-service` Đúng Cách

1. Bạn giải thích được vì sao `AddItem`/`MergeCart` phải gọi `product-service`.
2. Bạn giải thích được vì sao whole-cart JSON ở Redis vừa đơn giản vừa có risk lost update.
3. Bạn nhìn ra ngay `UpdateItem` là write path còn yếu hơn `AddItem`.
4. Bạn giải thích được vì sao repo này chưa cần abstraction phức tạp hơn.

## 4.3. user-service

### Mục đích chính

Học auth, profile, OTP, OAuth, wishlist, notification preference trong cùng một service lớn nhưng vẫn giữ được cấu trúc tương đối rõ.

### Thứ tự đọc

1. `services/user-service/cmd/main.go`
2. `internal/handler/user/handler.go`
3. `internal/handler/user/auth_handlers.go`
4. `internal/service/account/user_auth.go`
5. `internal/service/account/user_tokens.go`
6. `internal/service/account/auth_recovery.go`
7. `internal/service/account/user_profile.go`
8. `internal/service/account/email_verification.go`
9. `internal/service/account/phone_verification.go`
10. `internal/service/account/oauth_service.go`
11. `internal/service/account/address_service.go`
12. `internal/service/engagement/wishlist_service.go`
13. `internal/service/engagement/notification_preference_service.go`
14. `internal/repository/*`

### Function nên tập trung

#### `Register`
- **Điều đáng học:** normalize input, check uniqueness, bcrypt, build auth response.

#### `Login`
- **Điều đáng học:** resolve identifier email/phone và login protector ở handler layer.

#### `UpdateProfile`
- **Điều đáng học:** multi-repo update có transaction manager riêng.

#### `StartEmailVerificationOTP` / `VerifyEmailOTP`
- **Điều đáng học:** OTP challenge đúng chuẩn cần TTL, cooldown, attempts, rate limit, constant-time compare.

#### `BeginOAuth` / `CompleteOAuthCallback` / `ExchangeOAuthTicket`
- **Điều đáng học:** OAuth tốt là flow nhiều bước chứ không phải một handler dài.

#### `WishlistService.ListAlerts`
- **Điều đáng học:** baseline snapshot và current snapshot so sánh để phát sinh domain alert.

### Điểm mạnh

- Auth domain tách tương đối rõ khỏi engagement domain.
- Có `ProfileTxManager`.
- OTP flow khá đầy đủ.
- OAuth flow cẩn thận hơn nhiều repo demo.

### Pitfall

- `LoginAttemptProtector` là in-memory, không chia sẻ state giữa replica.
- Address default invariant chưa transactional ở mọi route address.
- Wishlist dispatch source còn N+1.

### Bài tập nên làm

1. Tạo address tx manager riêng.
2. Thêm session management và refresh rotation.
3. Batch `ListDispatchableAlerts`.

### Walkthrough Thực Chiến Khi Tự Đọc `user-service`

Nếu bạn muốn đọc `user-service` theo kiểu gần như line-by-line nhưng vẫn không bị ngợp, hãy đi đúng trình tự này:

1. Mở `internal/handler/user/handler.go`
   - Chỉ nhìn `RegisterRoutes`.
   - Mục tiêu không phải hiểu logic, mà để vẽ bản đồ route và subdomain: auth, profile, OTP, OAuth, address, wishlist, preference, admin.
2. Mở `internal/handler/user/auth_handlers.go`
   - Đọc `Register` trước.
   - Tự hỏi 4 câu:
     - handler validate gì
     - handler giao việc gì cho service
     - business error nào được map riêng
     - side effect nào chỉ best-effort
   - Sau đó đọc `Login` và để ý `loginProtector` xuất hiện ở boundary chứ không ở service.
3. Mở `internal/handler/user/login_protection.go`
   - Đọc `Check`, `RecordFailure`, `RecordSuccess`.
   - Đây là nơi bạn học được một bài quan trọng: không phải mọi policy chống brute-force đều phải nhét vào Redis ngay từ đầu; repo đang dùng bản in-memory tối giản nhưng có ý thức rõ về trade-off.
4. Mở `internal/service/account/user_auth.go`
   - Đọc `Register` thành từng block:
     - normalize input
     - uniqueness check
     - bcrypt hash
     - build `model.User`
     - issue verification token hash
     - persist
     - build auth response
   - Sau đó đọc `Login` và `buildAuthResponse`.
   - Điều cần nhận ra là service mới là nơi giữ password policy và token issuance, không phải handler.
5. Mở `internal/service/account/user_profile.go`
   - Đọc `UpdateProfile` trước để thấy branching transaction/no-transaction.
   - Sau đó đọc kỹ `updateProfileWithDependencies`.
   - Đây là lõi của file. Bạn phải nhìn được vì sao repo tách logic thành một hàm có injected dependencies:
     - dễ test hơn
     - tái dùng được cả với direct repo lẫn transactional repo
     - không trộn SQL transaction vào business flow
6. Dừng lại ở `applyVerifiedPhoneChange`
   - Đây là function rất đáng học.
   - Nó cho bạn thấy một invariant nghiêm túc không thể chỉ validate ở request DTO.
   - Rule “đổi số điện thoại phải gắn với challenge đã verify đúng số đó” nằm ở đây.
7. Mở `internal/repository/profile_tx_manager.go`
   - File ngắn nhưng cực kỳ quan trọng.
   - Nếu không đọc file này, bạn sẽ không hiểu vì sao `UpdateProfile` có thể update user, address, và phone verification một cách atomic.
8. Mở `internal/service/account/email_verification.go`
   - Đọc `StartEmailVerificationOTP`, `VerifyEmailOTP`, `ResendEmailVerificationOTP`.
   - Tự đánh dấu 7 cơ chế reliability/security:
     - delete expired opportunistically
     - challenge active gần nhất
     - OTP hash
     - cooldown
     - daily/hourly limit
     - constant-time compare
     - lock sau quá số lần sai
9. Mở `internal/service/account/oauth_service.go`
   - Đọc đúng thứ tự `BeginOAuth -> CompleteOAuthCallback -> ExchangeOAuthTicket`.
   - Nếu đọc ngược hoặc nhảy vào giữa, bạn rất dễ tưởng flow này rối hơn thực tế.
   - Mục tiêu là thấy rõ repo cố tình không phát JWT hệ thống ngay trong callback URL.
10. Cuối cùng mới đọc `internal/service/engagement/wishlist_service.go`
   - Sau khi hiểu auth/profile rồi, bạn sẽ thấy engagement domain chỉ là subdomain bổ sung, không phải lõi identity.
   - Nhờ vậy bạn không bị lẫn “user-service là auth service” với “user-service còn chứa hành vi người dùng”.

### Dấu Hiệu Bạn Đã Hiểu `user-service` Đúng Cách

1. Bạn giải thích được vì sao login protection nằm ở handler nhưng password compare nằm ở service.
2. Bạn giải thích được vì sao `UpdateProfile` cần `ProfileTxManager`.
3. Bạn giải thích được vì sao OAuth flow tách thành 3 bước thay vì callback phát JWT luôn.
4. Bạn nhìn ra `user-service` thực chất là nhiều subdomain sống chung chứ không phải một service thuần auth.

## 4.4. order-service

### Mục đích chính

Học orchestration lớn: pricing, idempotency, coupon, stock reservation, return, refund queue, outbox/inbox.

### Thứ tự đọc

1. `services/order-service/cmd/main.go`
2. `internal/handler/order/order_handler.go`
3. `internal/service/order/order_pricing.go`
4. `internal/service/order/order_lifecycle.go`
5. `internal/service/order/order_returns.go`
6. `internal/service/order/order_return_eligibility.go`
7. `internal/service/order/order_events.go`
8. `internal/repository/order_repository.go`
9. `internal/client/payment_client.go`
10. `internal/grpc_client/product_client.go`

### Function nên tập trung

#### `quoteOrder`
- **Điều đáng học:** canonical pricing logic nên dùng chung cho preview và create.

#### `CreateOrder`
- **Điều đáng học:** idempotent write API thực chiến.

#### `persistCreatedOrder`
- **Điều đáng học:** DB transaction cho order + order items + outbox + idempotency record.

#### `CreateReturn`
- **Điều đáng học:** item-level return invariant.

#### `RequestReturnRefund`
- **Điều đáng học:** external side effect nên được queue hóa khi request path quá dài/rủi ro.

#### `StartOutboxRelay`
- **Điều đáng học:** transactional outbox relay với claim lease.

### Điểm mạnh

- Đây là service có nhiều invariant thật nhất repo.
- Outbox/inbox, idempotency, return worker đều là pattern production-grade.

### Pitfall

- Stock reserve trước local DB commit tạo compensation complexity.
- Admin list offset path còn tồn tại.
- Service rất rộng, cần đọc theo luồng chứ không thể mở ngẫu nhiên.

### Bài tập nên làm

1. Cursor-first cho admin list.
2. Metric riêng cho compensation fail.
3. Rà lại role constant thay vì string literal.

### Walkthrough Thực Chiến Khi Tự Đọc `order-service`

`order-service` là chỗ dễ làm người đọc bị choáng nhất. Cách đọc hiệu quả là đi từ “canonical pricing” sang “create order” rồi mới qua return/refund/outbox.

1. Mở `internal/handler/order/order_handler.go`
   - Chỉ nhìn `RegisterRoutes` trước.
   - Ghi ra 4 nhóm route:
     - user order
     - user returns
     - admin orders
     - admin returns/coupons/report
   - Nếu không làm bước này, bạn sẽ luôn bị lẫn đâu là user-facing flow, đâu là operator flow.
2. Đọc `PreviewOrder`
   - Đây là cửa vào đơn giản nhất của domain.
   - Nó cho bạn thấy order total được tính ở đâu mà chưa cần nghĩ tới idempotency hay stock reservation.
3. Mở `internal/service/order/order_pricing.go`
   - Đọc `PreviewOrder`, sau đó đọc chậm `quoteOrder`.
   - Tự chia `quoteOrder` thành các block:
     - validate request
     - khởi tạo quote
     - lặp item và resolve product truth
     - tính subtotal
     - tính shipping fee
     - validate/apply coupon
   - Đừng bỏ qua `quoteOrderItem`; đây là nơi service từ chối tin giá và tồn kho từ frontend.
4. Quay lại `order_handler.go` và đọc `CreateOrder`
   - Chỉ có 3 việc:
     - bind/validate
     - lấy claims + `Idempotency-Key`
     - map lỗi
   - Nếu bạn thấy handler “quá mỏng”, đó là dấu hiệu kiến trúc đang đúng.
5. Mở `internal/service/order/order_lifecycle.go`
   - Đọc `CreateOrder` theo 6 block:
     - observability wrapper
     - normalize key + hash request
     - idempotency replay lookup
     - quote order
     - build aggregate + outbox + idempotency record
     - reserve stock
     - persist + compensation nếu fail
   - Đây là function bạn phải hiểu sâu nhất trong toàn repo.
6. Mở `internal/repository/order_repository.go` và tìm `createOrderTx`
   - Đây là nơi invariant thực sự được giữ.
   - Bạn cần nhìn rõ transaction ghi những gì:
     - `orders`
     - `order_items`
     - `order_events`
     - `outbox_events`
     - `order_idempotency_keys`
   - Nếu không đọc transaction này, bạn sẽ chỉ hiểu flow ở mức “service gọi repo”.
7. Sau đó mới quay lại đọc return flow trong `internal/service/order/order_returns.go`
   - Bắt đầu từ `CreateReturn`.
   - Sau đó đọc `buildReturnItems`.
   - Đây là lõi rule “không được return quá số lượng còn lại”.
8. Tiếp tục với `RequestReturnRefund`
   - Điều quan trọng nhất cần hiểu: API này không refund ngay.
   - Nó chỉ schedule `refund_pending`.
   - Refund thật được đẩy cho worker.
9. Mở repository và tìm:
   - `ClaimPendingReturnRefunds`
   - `CompleteReturnRefund`
   - `MarkReturnRefundAttemptFailed`
   - Ba hàm này giúp bạn hiểu refund worker lease, completion, retry semantics.
10. Cuối cùng mở `internal/service/order/order_events.go`
   - Đọc `buildCreatedOrderOutbox` trước.
   - Sau đó `StartOutboxRelay`, `flushOutboxBatch`, `publishOutboxMessage`.
   - Khi hiểu file này, bạn mới thực sự thấy repo đang dùng transactional outbox thật chứ không phải nói suông.
11. Quay lại repository đọc `ClaimPendingOutbox` và `ApplyInboxStatusTransition`
   - `ClaimPendingOutbox` cho biết vì sao nhiều replica vẫn relay an toàn.
   - `ApplyInboxStatusTransition` cho thấy payment event replay không làm order status đổi lặp.

### Dấu Hiệu Bạn Đã Hiểu `order-service` Đúng Cách

1. Bạn giải thích được vì sao preview và create phải dùng chung `quoteOrder`.
2. Bạn giải thích được vì sao stock reserve trước DB commit là trade-off khó nhưng có chủ đích.
3. Bạn giải thích được vì sao outbox và inbox đều cần tồn tại cùng lúc trong service này.
4. Bạn giải thích được vì sao `RequestReturnRefund` trả `202 Accepted` là hợp lý hơn cố refund trong request path.

## 4.5. payment-service

### Mục đích chính

Học charge/refund idempotency, webhook apply, payment read-model enrichment, và gateway callback safety.

### Thứ tự đọc

1. `services/payment-service/cmd/main.go`
2. `internal/handler/payment/payment_handler.go`
3. `internal/service/payment/payment_processing.go`
4. `internal/service/payment/payment_refunds.go`
5. `internal/service/payment/payment_queries.go`
6. `internal/service/payment/payment_enrichment.go`
7. `internal/service/payment/payment_events.go`
8. `internal/repository/payment/payment_repository.go`

### Function nên tập trung

#### `processPaymentCore`
- **Điều đáng học:** service không tin frontend, mà lookup order truth.

#### `RefundPayment`
- **Điều đáng học:** refund phải tính refundable balance theo sibling payments.

#### `HandleMomoWebhook`
- **Điều đáng học:** webhook cần verify signature và replay-safe behavior.

#### `enrichPayments`
- **Điều đáng học:** API read model nhiều khi nên enrich dữ liệu thay vì chỉ trả raw row.

### Điểm mạnh

- Charge/refund đều retry-safe.
- Webhook path có protection tương đối tốt.
- Outbox tiếp tục đảm bảo event publish không lệch DB.

### Pitfall

- Logic còn khá xoay quanh MoMo.
- Một số dependency với order-service đi qua auth header nên hơi “đời thường” nhưng thực dụng.

### Bài tập nên làm

1. Tách gateway strategy per provider.
2. Thêm reconciliation job payment vs order.
3. Thêm payment intent expiration.

### Walkthrough Thực Chiến Khi Tự Đọc `payment-service`

`payment-service` nhìn qua có vẻ đơn giản hơn `order-service`, nhưng thực tế nó là service rất đáng học về idempotency, webhook safety và read-model enrichment.

1. Mở `internal/handler/payment/payment_handler.go`
   - Đọc `RegisterRoutes` để tách rõ:
     - user charge/read
     - admin refund/read
     - webhook endpoint
   - Sau đó đọc `ProcessPayment`.
2. Ở `ProcessPayment`, chú ý 3 input rất quan trọng:
   - `claims.UserID`
   - `Authorization` header gốc
   - `Idempotency-Key`
   - Chỉ riêng điều này đã cho bạn biết service cần downstream order truth và cần request replay-safe.
3. Mở `internal/service/payment/payment_processing.go`
   - Đọc `ProcessPayment`, rồi tập trung vào `processPaymentCore`.
   - Chia nó thành block:
     - normalize idempotency + request hash
     - lookup order từ `order-service`
     - verify ownership và payable status
     - load sibling payments để tính outstanding
     - normalize amount/method
     - materialize payment
     - MoMo => pending
     - immediate method => completed
     - persist + outbox + idempotency record
4. Mở `internal/repository/payment/payment_repository.go`
   - Đọc `Create` và `CreateWithIdempotency`.
   - Bạn phải thấy rõ payment row, outbox row, idempotency record được commit cùng transaction.
5. Quay lại `internal/service/payment/payment_refunds.go`
   - Đọc `RefundPayment`.
   - Điều quan trọng nhất là refundable amount không lấy từ client mà tính từ sibling payments cùng order.
6. Đọc tiếp `HandleMomoWebhook`
   - Đây là file rất đáng học.
   - Tập trung vào:
     - resolve payment theo `payment_id` hoặc `gateway_order_id`
     - verify provider
     - verify signature
     - replay-safe shortcut nếu payment đã final
     - apply state transition
     - gọi repo `ApplyWebhookResult`
7. Quay lại repository và đọc `ApplyWebhookResult`
   - Đây là transaction core của webhook:
     - insert inbox row để dedupe
     - update payment nếu current status còn pending
     - insert outbox
     - commit
8. Cuối cùng mở `internal/service/payment/payment_enrichment.go`
   - Đọc `enrichPayments`, `enrichPayment`, `refundableAmountForCharge`.
   - Đây là nơi read model được nâng từ raw row lên business snapshot dễ dùng hơn.
9. Mở `internal/service/payment/payment_events.go`
   - Đọc `buildPaymentOutboxMessage`, `StartOutboxRelay`, `flushOutboxBatch`.
   - Nó gần như là bản song song của order outbox relay, rất đáng so sánh.

### Dấu Hiệu Bạn Đã Hiểu `payment-service` Đúng Cách

1. Bạn giải thích được vì sao payment-service phải hỏi order-service thay vì tin frontend.
2. Bạn giải thích được vì sao MoMo charge được persist ở trạng thái `pending`.
3. Bạn giải thích được vì sao webhook cần inbox/dedupe state thật.
4. Bạn giải thích được vì sao read path của payment phải enrich outstanding/net-paid thay vì trả raw row.

## 4.6. notification-service

### Mục đích chính

Học async reliability: dedupe, retry, DLQ, inbox history, worker lifecycle.

### Thứ tự đọc

1. `services/notification-service/cmd/main.go`
2. `internal/handler/event_handler.go`
3. `internal/inbox/redis_store.go`
4. `internal/inbox/history_store.go`
5. `internal/messaging/retry_publisher.go`
6. `internal/service/wishlist_alert_worker.go`
7. `internal/handler/inbox_handler.go`

### Function nên tập trung

#### `EventHandler.HandleMessage`
- **Điều đáng học:** xử lý một delivery với dedupe, retry, DLQ.

#### `processMessage`
- **Điều đáng học:** dispatch theo routing key sạch hơn nhiều `if/else` dài.

#### `Claim` / `MarkProcessed`
- **Điều đáng học:** at-least-once delivery cần inbox/dedupe state thật.

#### `WishlistAlertWorker.runCycle`
- **Điều đáng học:** polling worker tách biệt với queue consumer.

### Điểm mạnh

- Async reliability rõ nét nhất repo.
- Có history/audit, không phải “send rồi thôi”.

### Pitfall

- Redis down làm reliability degrade mạnh.
- Preference lookup sync có thể kéo throughput xuống.

### Bài tập nên làm

1. Thêm degraded-mode metric rõ ràng.
2. Cache preference ngắn hạn.
3. Admin replay DLQ.

### Walkthrough Thực Chiến Khi Tự Đọc `notification-service`

`notification-service` không nên đọc như CRUD service. Hãy đọc nó như một runtime reliability worker có thêm một lớp HTTP mỏng để soi inbox/audit.

1. Mở `internal/handler/event_handler.go`
   - Đọc `HandleMessage` trước, đừng nhảy ngay vào `handleOrderCreated`.
   - Đây là hàm quan trọng nhất của service.
2. Chia `HandleMessage` thành các block:
   - build metadata từ RabbitMQ headers
   - `inboxStore.Claim`
   - nếu duplicate thì ack và bỏ qua
   - nếu claim đang bận thì nack requeue
   - nếu claim mới thì `processMessage`
   - nếu lỗi permanent thì reject DLQ
   - nếu lỗi transient thì publish retry
   - nếu thành công thì append history + `MarkProcessed` + ack
3. Sau đó mới đọc `processMessage`
   - Mục tiêu là thấy dispatch theo routing key sạch thế nào.
   - `return.*` được gom chung rất gọn.
4. Mở `internal/inbox/redis_store.go`
   - Đọc `Claim`, `MarkProcessed`, `Release`.
   - Đây là chỗ giữ duplicate suppression giữa nhiều replica.
   - Nếu không đọc file này, bạn sẽ không hiểu service “chống duplicate” bằng cách nào.
5. Mở `internal/messaging/retry_publisher.go`
   - Đọc `Publish` và `delayForRetry`.
   - Học cách repo dùng message headers + TTL queue để làm bounded retry mà không cần bảng retry riêng.
6. Mở `internal/inbox/history_store.go`
   - Đọc `Append`, `ListByUser`, `ListRecent`, `MarkAllRead`.
   - Đây là nơi inbox feed và audit feed thật sự được materialize trong Redis.
7. Mở `internal/handler/inbox_handler.go`
   - Sau khi hiểu history store rồi mới đọc `List`, `MarkRead`, `Audit`.
   - Lúc này bạn sẽ thấy HTTP layer mỏng tới mức nào.
8. Cuối cùng mở `internal/service/wishlist_alert_worker.go`
   - Đây là async path thứ hai của service, tách biệt với queue consumer.
   - Đọc theo thứ tự:
     - `Start`
     - `runCycle`
     - `deliver`
     - `wishlistAlertEmail`
   - Mục tiêu là thấy repo không ép mọi background flow phải đi qua RabbitMQ; polling worker vẫn là lựa chọn hợp lý trong một số boundary.

### Dấu Hiệu Bạn Đã Hiểu `notification-service` Đúng Cách

1. Bạn giải thích được vì sao duplicate suppression nằm ở Redis chứ không ở process memory.
2. Bạn giải thích được khác biệt giữa permanent error, transient error, retry exhausted.
3. Bạn giải thích được vì sao history/audit feed vẫn có giá trị dù email send chỉ là side effect cuối.
4. Bạn nhìn ra service này có hai runtime path khác nhau: RabbitMQ consumer và wishlist polling worker.

---

## 5. Những Family Function Quan Trọng Của Repo

## 5.1. `RegisterRoutes`

Ý nghĩa:

- tuyên bố contract public thật của service
- là chỗ nhanh nhất để hiểu route surface

Đọc ở:

- `cart-service/internal/handler/cart/cart_handler.go`
- `order-service/internal/handler/order/order_handler.go`
- `payment-service/internal/handler/payment/payment_handler.go`
- `product-service/internal/handler/product/product_handler.go`
- `user-service/internal/handler/user/handler.go`

## 5.2. `normalize*`, `resolve*`, `validate*`

Ý nghĩa:

- repo này dùng helper family khá đúng kiểu Go thực dụng
- invariant không phải lúc nào cũng nằm trong “big service method”; nhiều cái nằm ở helper nhỏ nhưng đúng ý nghĩa

Ví dụ:

- `normalizeListProductsQuery`
- `normalizePaymentMethod`
- `normalizeShippingMethod`
- `resolveOAuthCallbackURL`
- `resolveOptionalPhone`
- `validateOrderRequest`

## 5.3. `build*`

Ý nghĩa:

- thường là materialize DTO, outbox payload, summary, history item

Ví dụ:

- `buildCreatedOrderOutbox`
- `buildPaymentOutboxMessage`
- `buildReturnOutboxMessage`
- `buildHistoryItem`

## 5.4. `Claim*`, `Mark*`, `RunInTx`

Ý nghĩa:

- đây là những function “mùi production” nhất repo

Ví dụ:

- `ClaimPendingOutbox`
- `ClaimPendingReturnRefunds`
- `MarkOutboxPublished`
- `MarkProcessed`
- `ProfileTxManager.RunInTx`

---

## 6. Bài Học Kiến Trúc Rút Ra Từ Repo

### 6.1. Microservice không có nghĩa là service nào cũng phải phức tạp

`cart-service` và `notification-service` cho thấy:

- có service nhỏ, focused
- có service thiên về runtime worker

Không phải tất cả đều cần domain model lớn như order/user.

### 6.2. Source of truth phải được tôn trọng

Repo này làm khá đúng chỗ này:

- cart không tự giữ product truth
- payment không tin frontend về order total
- search không thay PostgreSQL làm truth

### 6.3. Async tốt phải đi kèm dedupe và replay-safe

`order-service`, `payment-service`, `notification-service` đều dạy bài học này.

### 6.4. Graceful degradation là chủ đích, không phải nuốt lỗi

Ví dụ:

- search fail -> fallback PostgreSQL
- Redis rate limiter fail -> fallback in-memory
- notification history fail -> không fail email delivery path

Nhưng code vẫn log và vẫn giữ observability.

---

## 7. 12 Bài Tập Nâng Tay Từ Repo Này

1. Thêm `RepriceCart` trước checkout.
2. Sửa `cart-service UpdateItem` để refresh product truth.
3. Chuyển review list sang cursor pagination.
4. Tách search synonym thành config.
5. Viết address tx manager để `SetDefault` atomic.
6. Chuyển login protection sang Redis-backed state.
7. Tối ưu `ListDispatchableAlerts` tránh N+1.
8. Chuyển admin order list sang cursor-first.
9. Thêm outbox lag dashboard.
10. Tách payment gateway adapter cho multi-provider.
11. Thêm notification replay tool cho DLQ.
12. Viết reconciliation job giữa order/payment state.

---

## 8. Nếu Chỉ Có 2 Ngày Để Học Repo Này

### Ngày 1

1. `api-gateway`
2. `pkg/config`, `pkg/middleware`, `pkg/observability`
3. `product-service`
4. `cart-service`

### Ngày 2

1. `user-service` auth + profile + OTP
2. `order-service` create order + return
3. `payment-service` charge + webhook
4. `notification-service` event handler

Sau 2 ngày, bạn sẽ hiểu:

- request vào hệ thống thế nào
- source of truth của từng domain
- vì sao order/payment/notification là trục reliability của backend này

---

## 9. Nếu Muốn Đọc Như Một Senior Backend Engineer

Khi mở một function, đừng chỉ hỏi “nó làm gì”.

Hãy hỏi thêm:

1. Nó đang bảo vệ invariant nào?
2. Nếu dependency ngoài timeout, chuyện gì xảy ra?
3. Nếu client retry cùng request 2 lần, chuyện gì xảy ra?
4. Nếu process crash giữa chừng, dữ liệu có lệch không?
5. Nếu bảng dữ liệu lớn gấp 100 lần, function này còn ổn không?

Đó là cách từ việc “đọc code” chuyển sang “đọc hệ thống”.

---

## 10. Cách Audit Repository Và Query Hot Path Như Một Senior

Đây là phần dành cho lúc bạn đã đọc qua handler/service và muốn hiểu “nơi nào mới thực sự quyết định correctness, scalability và reliability”.

### 10.1. Quy trình audit 8 bước

Khi mở một repository hoặc client hot path, làm theo đúng thứ tự này:

1. Xác định entity thật đang được bảo vệ.
2. Xác định side effect nào phải atomic với nhau.
3. Xác định function đang dùng loại pattern nào:
   - transaction bundle
   - compare-and-set
   - row lock
   - cursor pagination
   - lease claim
   - bulk upsert
   - replay dedupe
4. Xác định state nào là source of truth:
   - PostgreSQL row
   - Redis key
   - RabbitMQ header
   - in-memory state
5. Đọc điều kiện `WHERE`, `FOR UPDATE`, `ON CONFLICT`, `LIMIT/OFFSET`, `ORDER BY`, `available_at`, `status`.
6. Hỏi xem retry, crash giữa chừng và concurrent request sẽ tạo trạng thái gì.
7. Hỏi query này có còn đứng vững khi dữ liệu lớn hơn 10 lần không.
8. Chỉ sau cùng mới quay lên service để xem orchestration có tôn trọng invariant tầng repo hay không.

### 10.2. 7 pattern phải nhận ra ngay khi đọc repo này

#### 1. Transaction bundle

Dấu hiệu:

- `BeginTx`
- nhiều `ExecContext` liên tiếp
- `tx.Commit()` ở cuối

File nên mở:

- `services/order-service/internal/repository/order_repository.go`
- `services/payment-service/internal/repository/payment/payment_repository.go`
- `services/user-service/internal/repository/profile_tx_manager.go`
- `services/product-service/internal/repository/product/product_review_tx_manager.go`

Câu hỏi phải hỏi:

- Nếu một bước fail, step trước có rollback không?
- Có side effect nào đáng ra phải cùng transaction nhưng đang nằm ngoài không?

#### 2. SQL compare-and-set

Dấu hiệu:

- `UPDATE ... WHERE ... AND condition`
- kiểm tra `RowsAffected`

File nên mở:

- `product_repository.UpdateStock`
- `order_repository.ExpirePendingReservation`
- `payment_repository.ApplyWebhookResult`

Câu hỏi phải hỏi:

- State cũ nào đang được bảo vệ bởi điều kiện `WHERE`?
- Nếu request đến trễ hoặc retry, function có thành no-op an toàn không?

#### 3. Row lock

Dấu hiệu:

- `FOR UPDATE`

File nên mở:

- `order_repository.lockAndConsumeCoupon`
- `order_repository.ApplyInboxStatusTransition`
- `product_review_repository.GetReviewByProductAndUserForUpdate`

Câu hỏi phải hỏi:

- Lock đang serialize điều gì?
- Có chỗ nào đáng ra phải lock mà lại chỉ read thường không?

#### 4. Cursor pagination

Dấu hiệu:

- `limit + 1`
- `encode/decode cursor`
- `ORDER BY ... , id`

File nên mở:

- `order_repository.ListAllByCursor`
- `product_repository.List`

Câu hỏi phải hỏi:

- Cursor có tie-breaker ổn định không?
- Cursor có ràng buộc sort hay filter không?
- Có chỗ nào đang dùng `OFFSET` mà đáng ra nên chuyển sang cursor không?

#### 5. Lease claim

Dấu hiệu:

- `FOR UPDATE SKIP LOCKED`
- `available_at`
- `processing_started_at`
- TTL/lease key trên Redis

File nên mở:

- `order_repository.ClaimPendingOutbox`
- `order_repository.ClaimPendingReturnRefunds`
- `payment_repository.ClaimPendingOutbox`
- `notification-service/internal/inbox/redis_store.go`

Câu hỏi phải hỏi:

- Worker chết giữa chừng thì item có được reclaim không?
- Lease hết hạn có thể làm duplicate processing không?
- Downstream đã idempotent chưa?

#### 6. Bulk upsert

Dấu hiệu:

- `unnest(...)`
- `ON CONFLICT DO UPDATE`

File nên mở:

- `wishlistrepo.UpsertMany`
- `notificationpreferencerepo.UpsertMany`
- `product_review_repository.upsertReviewSummaryDelta`

Câu hỏi phải hỏi:

- Bulk write có giữ được idempotency không?
- Thứ tự input có quan trọng không?
- Có row nào bị silently overwrite ngoài ý muốn không?

#### 7. Replay-safe async

Dấu hiệu:

- inbox table
- Redis dedupe
- outbox mark published/failed
- retry count/header

File nên mở:

- `payment_repository.ApplyWebhookResult`
- `order_repository.ApplyInboxStatusTransition`
- `notification-service/internal/messaging/retry_publisher.go`

Câu hỏi phải hỏi:

- Duplicate message bị chặn ở mức message hay mức state transition?
- Publish thành công nhưng ack thất bại thì chuyện gì xảy ra?

### 10.3. Checklist audit nhanh cho mỗi query hot path

Khi thấy một query quan trọng, check lần lượt:

1. `ORDER BY` có deterministic không?
2. `LIMIT/OFFSET` có phải choice tạm thời hay choice có chủ đích?
3. Query có kéo nhiều cột/json hơn cần thiết không?
4. Có `COUNT(*)` trên endpoint nóng không?
5. Có JSONB/LATERAL/ILIKE nào sẽ đau khi data lớn không?
6. Có `RowsAffected` check không nếu logic cần compare-and-set?
7. Có unique constraint hoặc `ON CONFLICT` backing cho idempotency/uniqueness không?
8. Query đang giữ invariant local hay invariant xuyên service?

### 10.4. Checklist audit nhanh cho mỗi worker / retry path

1. Claim bằng gì:
   - Postgres row lock
   - Redis claim key
   - broker delivery semantics
2. Lease nằm ở đâu:
   - `available_at`
   - `processing_started_at`
   - TTL key
3. Retry count nằm ở đâu:
   - DB column
   - message header
4. Failure có được quan sát không:
   - `last_error`
   - metrics
   - history item
5. Duplicate delivery có an toàn không:
   - inbox dedupe
   - guarded update
   - idempotency key

## 11. Đường Đọc Audit-Level Theo File Thực Tế

Nếu bạn muốn học repo này như một người review production incident, đọc theo thứ tự dưới đây.

### 11.1. `order-service`

Mở theo thứ tự:

1. `services/order-service/internal/repository/order_repository.go`
2. `createOrderTx`
3. `lockAndConsumeCoupon`
4. `ListAll`
5. `ListAllByCursor`
6. `ExpirePendingReservation`
7. `ClaimPendingReturnRefunds`
8. `ClaimPendingOutbox`
9. `ApplyInboxStatusTransition`

Điều phải hiểu sau khi đọc xong:

- order data bundle nào commit cùng nhau
- coupon được serialize ra sao
- vì sao refund worker không cần queue state ngoài bảng `returns`
- event duplicate được chặn ở đâu

### 11.2. `payment-service`

Mở theo thứ tự:

1. `services/payment-service/internal/repository/payment/payment_repository.go`
2. `CreateWithIdempotency`
3. `ApplyWebhookResult`
4. `ClaimPendingOutbox`
5. `services/payment-service/internal/client/order_client.go`
6. `services/order-service/internal/client/payment_client.go`

Điều phải hiểu sau khi đọc xong:

- payment idempotency là DB contract chứ không phải chỉ HTTP header trick
- webhook replay-safe nhờ inbox + guarded update
- inter-service auth có hai kiểu:
  - pass-through auth header của user
  - service-signed JWT cho admin/internal route

### 11.3. `product-service`

Mở theo thứ tự:

1. `services/product-service/internal/repository/product/product_repository.go`
2. `List`
3. `decodeProductListCursor`
4. `appendCursorClause`
5. `UpdateStock`
6. `ListByIDs`
7. `product_review_repository.go`
8. `product_review_tx_manager.go`
9. `storefront_repository.go`
10. `product_search_assist_repository.go`

Điều phải hiểu sau khi đọc xong:

- catalog cursor giữ stable ordering thế nào
- vì sao `UpdateStock` không cần mutex Go
- review summary delta là tối ưu đúng loại
- storefront batch query tránh N+1 theo category

### 11.4. `user-service`

Mở theo thứ tự:

1. `services/user-service/internal/repository/userrepo/user_repository.go`
2. `services/user-service/internal/repository/profile_tx_manager.go`
3. `services/user-service/internal/repository/addressrepo/repository.go`
4. `services/user-service/internal/repository/wishlistrepo/repository.go`
5. `services/user-service/internal/repository/notificationpreferencerepo/repository.go`
6. `services/user-service/internal/repository/authrepo/email_verification_repository.go`
7. `services/user-service/internal/repository/oauthrepo/repository.go`

Điều phải hiểu sau khi đọc xong:

- uniqueness thật nằm ở đâu
- transaction profile ghép các repo con như thế nào
- default address invariant hiện mạnh tới mức nào và còn hở ở đâu
- wishlist/preferences đang tối ưu batch write bằng cách nào

### 11.5. `notification-service` và `cart-service`

Mở theo thứ tự:

1. `services/notification-service/internal/inbox/redis_store.go`
2. `services/notification-service/internal/inbox/history_store.go`
3. `services/notification-service/internal/messaging/retry_publisher.go`
4. `services/cart-service/internal/repository/cart/cart_repository.go`

Điều phải hiểu sau khi đọc xong:

- khi nào repo dùng Redis lease thay vì Postgres inbox table
- notification history là read model chứ không phải immutable audit ledger
- retry state của notification nằm trong AMQP header, không nằm trong DB
- cart đang chấp nhận `last-write-wins` như một trade-off có chủ đích

### 11.6. Dấu hiệu bạn đã thật sự hiểu hot path của repo

Bạn có thể tự giải thích, không nhìn lại tài liệu:

1. Vì sao `ApplyWebhookResult` cần cả inbox insert lẫn `WHERE status = 'pending'`.
2. Vì sao `ListAllByCursor` phải dùng thêm `id` ngoài `created_at`.
3. Vì sao `UpdateStock` là invariant SQL, không phải invariant của service.
4. Vì sao `ClearDefault` tự nó chưa đủ để giữ đúng default address invariant.
5. Vì sao outbox claim dùng `FOR UPDATE SKIP LOCKED` nhưng vẫn cần downstream idempotency.
6. Vì sao `notification-service` chọn Redis dedupe còn `order/payment` chọn Postgres inbox.
7. Vì sao `cart-service` hiện nhanh nhưng không chống được lost update dưới concurrent write.
