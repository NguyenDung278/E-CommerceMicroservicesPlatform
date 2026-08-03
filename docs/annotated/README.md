# Backend Annotated Source Map

Tài liệu này là bản đồ source code backend theo đúng runtime hiện tại của repo. Mục tiêu không chỉ là biết “file nào nằm ở đâu”, mà còn trả lời các câu hỏi thực tế hơn:

- request đi vào từ đâu
- service nào giữ source of truth nào
- function nào là entrypoint thật
- business invariant nằm ở tầng nào
- repository nào đang giữ transaction, outbox, inbox, pagination hay retry lease
- integration nào là bắt buộc, integration nào là optional và degrade được

File này thiên về **source map chi tiết**. Nếu muốn hiểu sâu hơn về chất lượng code, failure mode và đề xuất cải thiện, đọc thêm [docs/deep-dive/README.md](/Users/nguyendung/FPT/projects/ecommerce-platform/docs/deep-dive/README.md). Nếu muốn học repo theo lộ trình, đọc [docs/learning/README.md](/Users/nguyendung/FPT/projects/ecommerce-platform/docs/learning/README.md).

---

## 1. Toàn Cảnh Backend

### 1.1. Runtime topology

```text
Browser / Mobile Client
        |
        v
   api-gateway
        |
        +--> user-service
        +--> product-service
        +--> cart-service
        +--> order-service
        +--> payment-service
        +--> notification-service
```

### 1.2. Hạ tầng dùng chung

| Thành phần | Vai trò |
| --- | --- |
| PostgreSQL | Source of truth chính cho `user-service`, `product-service`, `order-service`, `payment-service` |
| Redis | Cart state, rate limit, review cache, notification inbox/history/dedupe |
| RabbitMQ | Event bus cho order/payment/notification |
| gRPC | Internal RPC chủ yếu giữa cart/order với product và user với consumer nội bộ |
| Elasticsearch | Search backend optional của `product-service` |
| MinIO / object storage | Upload ảnh product và return evidence |
| Prometheus + Grafana + Jaeger | Metrics, dashboard, tracing |

### 1.3. Data ownership thật

| Domain | Service sở hữu | Ghi chú |
| --- | --- | --- |
| User, auth, profile, address | `user-service` | Source of truth cho identity và profile |
| Product, stock, review, storefront | `product-service` | Source of truth cho catalog |
| Cart | `cart-service` | Stored trên Redis, nhưng không sở hữu product truth |
| Order, coupon, return | `order-service` | Source of truth cho order lifecycle |
| Payment, refund, webhook state | `payment-service` | Source of truth cho payment lifecycle |
| Notification delivery state | `notification-service` | Không sở hữu domain order/payment; chỉ sở hữu delivery/inbox history |

---

## 2. Nền Backend Dùng Chung

### 2.1. `api-gateway`

`api-gateway` là HTTP ingress của toàn hệ thống. Nó không giữ business data và không nên chứa domain rule.

#### File và function quan trọng

| File / Function | Vai trò |
| --- | --- |
| `api-gateway/cmd/main.go` `main` | Boot gateway, load config, tạo proxy cho từng service, mount middleware và route mirror |
| `api-gateway/internal/proxy/service_proxy.go` `NewServiceProxy` | Tạo reverse proxy client có timeout, HTTP tracing, retry, circuit breaker |
| `api-gateway/internal/proxy/service_proxy_request.go` `Do` | Entry point forward request xuống backend service |
| `service_proxy_request.go` `newBackendRequest` | Clone path, raw query, body, headers và thêm `X-Forwarded-*` |
| `service_proxy_request.go` `executeWithResilience` | Chạy request qua retry + circuit breaker |
| `service_proxy_request.go` `shouldRetry` | Chỉ retry cho `GET`, `HEAD`, `OPTIONS` để tránh replay side effect |

#### Gateway đang làm gì

- expose cùng `/api/v1/...` contract như backend service
- áp middleware CORS, secure headers, tracing, rate limit, logging
- forward request nguyên nghĩa transport xuống backend
- giữ redirect intact cho OAuth flow bằng `CheckRedirect: http.ErrUseLastResponse`

#### Gateway không làm gì

- không parse business DTO của downstream service
- không quyết định order có được cancel hay không
- không kiểm stock, không tính giá, không verify coupon

#### Walkthrough gateway thật sự hoạt động ra sao

1. `api-gateway/cmd/main.go`
   - `config.Load("api-gateway")`
   - `logger.New("api-gateway")`
   - `SetupTracing`
   - dựng `ServiceProxy` cho `user`, `product`, `cart`, `order`, `payment`, `notification`
   - mount Echo middleware theo thứ tự:
     - `Recover`
     - `FrontendCORS`
     - `Secure`
     - `EchoMiddleware`
     - `NewRedisBackedRateLimiter`
     - `RequestLogger`
     - Prometheus middleware
   - mount health + metrics
   - register route mirror cho từng service
2. `api-gateway/internal/handler/*_handler.go`
   - Mỗi handler không chứa domain logic.
   - Nó chỉ mirror đúng route contract của downstream service và gọi chung một helper `forwardWithProxy`.
   - Ý nghĩa: gateway route surface được explicit hóa bằng code, không phải wildcard proxy mù.
3. `api-gateway/internal/handler/proxy_handler.go` `forwardWithProxy`
   - gọi `p.Do(ctx, req)`
   - sau đó `p.ForwardResponse(...)`
   - nếu downstream lỗi, trả lỗi gateway-level đơn giản
4. `service_proxy_request.go` `newBackendRequest`
   - clone method, path, raw query, body, headers
   - preserve `Authorization`, `Content-Type`, `X-Request-ID`, trace headers
   - thêm `X-Forwarded-Host`, `X-Forwarded-Proto`
5. `service_proxy_request.go` `executeWithResilience`
   - retry tối đa `maxRetries + 1`
   - chỉ retry cho `GET`, `HEAD`, `OPTIONS`
   - retry dùng request clone để không reuse body sai cách
   - circuit breaker bọc quanh HTTP client call
6. `service_proxy_response.go` `ForwardResponse`
   - copy toàn bộ header values
   - write status code
   - stream body qua `io.Copy`
   - không buffer full response vào memory

#### Điều dễ bị bỏ qua ở gateway

- route mirror trong `api-gateway/internal/handler/*` là source of truth cho public ingress surface của repo
- gateway preserve redirect thay vì auto-follow, điều này cực quan trọng cho OAuth
- gateway đang trust khá rộng inbound header set; nếu sau này có privileged internal header thì trust boundary phải siết lại
- `RequestLogger` ở gateway log được cả `request_id`, `trace_id`, `span_id`, `user_id` nếu có claims

### 2.2. `pkg/config`

`pkg/config/config.go` là config contract dùng chung.

#### Ý nghĩa

- gom config cho server, DB, Redis, RabbitMQ, JWT, gRPC, SMTP, OAuth, tracing, search, object storage, Telegram, email verification
- dùng defaults phù hợp cho local/dev
- đọc env/file qua Viper
- trả các helper như `DatabaseConfig.DSN()`, `RedisConfig.Addr()`, `RabbitMQConfig.URL()`

#### Tác động thực tế

- mọi `cmd/main.go` đều đi qua `config.Load(serviceName)`
- cấu hình cross-service dependency đều được điền ở `ServicesConfig`
- production-critical settings như `JWT.Secret`, `PaymentGateway.WebhookSecret`, OAuth client secret, SMTP credentials đều đi qua đây

#### Walkthrough `config.Load`

1. set default cho gần như toàn bộ runtime:
   - `server.*`
   - `database.*`
   - `redis.*`
   - `rabbitmq.*`
   - `jwt.*`
   - `grpc.port`
   - `smtp.*`
   - `oauth.google.*`
   - `services.*`
   - `frontend.base_url`
   - `notification.*`
   - `payment_gateway.*`
   - `object_storage.*`
   - `tracing.*`
   - `search.*`
   - `telegram.*`
   - `email_verification.*`
2. load file config từ các path local/dev phổ biến
3. bật `AutomaticEnv` và replacer để env var map sang key dạng nested
4. unmarshal toàn bộ sang `Config`

#### Helper nhỏ nhưng rất quan trọng

| Helper | Ý nghĩa |
| --- | --- |
| `DatabaseConfig.DSN()` | Chuẩn hóa PostgreSQL connection string |
| `RedisConfig.Addr()` | Chuẩn hóa Redis address |
| `RabbitMQConfig.URL()` | Chuẩn hóa AMQP URL |
| `SMTPConfig.Addr()` | Chuẩn hóa host:port cho mail sender |

#### Điều dễ bị bỏ qua

- `serviceName` hiện không thực sự prefix env vars; nó chủ yếu được reuse cho default `database.dbname`
- defaults của `pkg/config` rất tiện cho local nhưng không được xem là production-safe
- `Config` hiện là contract runtime của gần như toàn backend; đổi field ở đây có tác động xuyên repo

### 2.3. `pkg/database`

| Function | Vai trò |
| --- | --- |
| `NewPostgresDB` | Mở PostgreSQL connection dùng chung |
| `RunPostgresMigrations` | Chạy migration lúc startup service |

Pattern của repo là: service nào dùng PostgreSQL thì migration được chạy ngay trong `cmd/main.go`, không có migration runner riêng tách rời.

#### Walkthrough database helper

1. `NewPostgresDB`
   - `sql.Open("postgres", cfg.DSN())`
   - set pool:
     - `MaxOpenConns = 25`
     - `MaxIdleConns = 5`
     - `ConnMaxLifetime = 5m`
   - `Ping()` để fail fast nếu DB không lên
2. `RunPostgresMigrations`
   - create postgres migrate driver
   - create `iofs` source từ embedded migration FS
   - `migrator.Up()`
   - bỏ qua `migrate.ErrNoChange`

#### Ý nghĩa thực tế

- repo ưu tiên `database/sql` + raw SQL thay vì ORM
- mỗi service tự sở hữu migration của mình và tự chạy lúc boot
- startup của service fail sớm nếu DB/migration không ổn, không chạy nửa sống nửa chết

### 2.4. `pkg/middleware`

| File / Function | Vai trò |
| --- | --- |
| `auth.go` `JWTAuth`, `RequireRole` | Parse JWT và guard role |
| `rate_limit.go` `NewRedisBackedRateLimiter` | Shared rate limiter có Redis-backed mode và fallback in-memory |
| `logging.go` `RequestLogger` | Structured request logging |
| `cors.go` `FrontendCORS` | CORS policy cho frontend |

Điểm đáng chú ý ở `NewRedisBackedRateLimiter`:

- nếu Redis down lúc startup, middleware degrade về in-memory limiter
- nếu Redis fail ở request path, request vẫn được xử lý qua fallback limiter
- availability được ưu tiên hơn strict global consistency

#### Walkthrough middleware quan trọng

1. `auth.go` `JWTAuth`
   - đọc `Authorization: Bearer <token>`
   - parse JWT vào `JWTClaims`
   - verify signing method HMAC
   - attach claims vào Echo context qua key `user`
2. `auth.go` `RequireRole`
   - lấy claims từ context
   - so role theo lowercase set
   - reject `403` nếu role không nằm trong allowed set
3. `rate_limit.go` `NewRedisBackedRateLimiter`
   - cố ping Redis ngay lúc startup
   - nếu không ping được, log warning và fallback in-memory
   - ở request path, identifier ưu tiên `claims.UserID`, nếu không có thì dùng `RealIP`
   - token bucket thật nằm trong Lua script Redis
   - nếu Redis lỗi giữa chừng thì fallback sang in-memory handler
4. `logging.go` `RequestLogger`
   - đo latency
   - resolve route thực (`c.Path()`) thay vì chỉ raw path khi có thể
   - log `request_id`, `user_id`, `trace_id`, `span_id` nếu có
   - chọn `Info`/`Warn`/`Error` theo status code
5. `cors.go` `FrontendCORS`
   - allow list rõ cho các local frontend origin đang hỗ trợ
   - không phải permissive wildcard CORS

#### Helper dễ bị bỏ qua nhưng đáng đọc

- `extractRateLimitIdentifier`: cho thấy repo ưu tiên rate limit theo authenticated user trước, rồi mới fallback IP
- `limiterTTL`: giữ state Redis đủ lâu cho refill window
- `toInt64`: adapter nhỏ để parse return values từ Lua script

### 2.5. `pkg/observability`

| File / Function | Vai trò |
| --- | --- |
| `tracing.go` `SetupTracing` | Bật OpenTelemetry exporter và tracer provider |
| `tracing.go` `EchoMiddleware` | HTTP tracing cho Echo |
| `tracing.go` `WrapHTTPTransport` | Tự động truyền trace context và request id qua outbound HTTP |
| `grpc.go` `GRPCUnaryServerInterceptor` | gRPC tracing interceptor |
| `context.go` | Request ID propagation giữa middleware, logger và downstream call |

Kết quả là:

- trace đi được từ gateway sang service nếu downstream call dùng wrapped transport
- request id được forward ở cả HTTP lẫn một phần event payload/outbox
- metric và tracing được code hóa vào service thay vì gắn ngoài bằng sidecar magic

#### Walkthrough observability path

1. `tracing.go` `SetupTracing`
   - set global propagator `TraceContext + Baggage`
   - nếu tracing disabled thì trả shutdown noop
   - nếu enabled thì tạo OTLP exporter HTTP
   - set tracer provider với `ParentBased(TraceIDRatioBased(sampleRatio))`
   - attach `service.name`
2. `tracing.go` `EchoMiddleware`
   - extract trace context từ inbound header
   - nhặt request id nếu có
   - mở server span với name `METHOD route`
   - attach attrs như `http.method`, `http.route`, `http.target`, `http.client_ip`
   - set span status theo HTTP status cuối
3. `tracing.go` `WrapHTTPTransport`
   - bọc outbound transport bằng `otelhttp.NewTransport`
   - nếu context có request id mà header chưa có, tự set `X-Request-ID`
4. `grpc.go`
   - unary server interceptor extract trace/request id từ metadata
   - unary client interceptor inject trace/request id vào outgoing metadata
5. `context.go`
   - `RequestIDMiddleware` có thể tạo request id mới nếu chưa có
   - `LoggerWithContext` auto attach `request_id`, `trace_id`, `span_id` vào zap logger

#### Ý nghĩa thực tế

- observability của repo không phải chỉ “bật tracing”, mà là propagation thật qua HTTP, gRPC và một phần async payload
- code service nào dùng `appobs.LoggerWithContext` thì log tự mang đủ correlation fields

### 2.6. `pkg/response` và `pkg/validation`

- `pkg/response` giữ response envelope nhất quán cho toàn bộ HTTP service
- `pkg/validation` gắn Echo validator với DTO struct tag validation

Nhờ đó handler ở các service giữ được shape tương đối đồng nhất:

1. `Bind`
2. `Validate`
3. gọi service
4. map domain error sang HTTP response

#### Walkthrough response/validation/logger

1. `pkg/response/response.go`
   - `Success`, `SuccessWithMeta`, `Error` giữ envelope HTTP nhất quán
   - `Meta` hỗ trợ cả `page/limit/total` lẫn `next_cursor/has_next`
2. `pkg/validation/validator.go`
   - adapter `go-playground/validator` sang Echo
   - ưu tiên tên field theo JSON tag thay vì tên struct field Go
   - `Message(err)` extract thông điệp validation thân thiện cho client
3. `pkg/logger/logger.go`
   - dev dùng console encoder, production dùng JSON encoder
   - `service` field được attach vào mọi log entry
   - stacktrace chỉ ở level error trở lên

#### Điều dễ bị bỏ qua

- `pkg/response` là lý do client side có thể parse response khá nhất quán giữa mọi service
- `pkg/validation` giúp error message nói theo tên field API, không theo tên Go struct
- `pkg/logger` không thần kỳ, nhưng là contract quan trọng để log format không drift giữa các service

### 2.7. Client Và Helper Pattern Dùng Chung

Các service không chỉ giao tiếp qua DB/broker; rất nhiều invariant thực tế đi qua các client nhỏ ở `internal/client` và `internal/grpc_client`.

#### HTTP client pattern

| File / Function | Vai trò |
| --- | --- |
| `payment-service/internal/client/order_client.go` `GetOrder` | Payment lookup order truth bằng auth header gốc |
| `order-service/internal/client/payment_client.go` `ListPaymentHistory` | Order-service đọc payment history của chính user |
| `order-service/internal/client/payment_client.go` `RefundPayment` | Order-service yêu cầu payment-service tạo refund |
| `notification-service/internal/client/user_client.go` `PreferenceMap` | Notification đọc preference của user cụ thể |
| `notification-service/internal/client/user_client.go` `ListDispatchableWishlistAlerts` | Notification poll wishlist alerts từ user-service |
| `user-service/internal/client/product_client.go` `ListProductsByIDs` | User-service batch hydrate product snapshot cho wishlist |

#### gRPC client pattern

| File / Function | Vai trò |
| --- | --- |
| `cart-service/internal/grpc_client/product_client.go` `GetProduct` | Cart lookup product truth |
| `order-service/internal/grpc_client/product_client.go` `GetProduct` | Order quote item |
| `order-service/internal/grpc_client/product_client.go` `DecreaseStock`, `RestoreStock` | Inventory reservation/compensation |

#### Điều đáng học ở các client này

1. hầu hết HTTP client đều dùng `appobs.WrapHTTPTransport(http.DefaultTransport)`
2. mỗi client đều có envelope struct riêng để decode response từ downstream service
3. `normalizeBaseURL` xuất hiện lặp lại có chủ đích để client chịu được env config thiếu scheme
4. `attachServiceAuthorization` và `UserClient.signToken`
   - cho thấy repo dùng internal JWT ngắn hạn để gọi protected admin/staff route giữa các service
   - thực dụng, dễ vận hành local, nhưng cần quản lý secret chặt
5. gRPC client đều gắn `GRPCUnaryClientInterceptor` để trace/request-id đi xuyên service boundary

### 2.8. Helper Family Và Repository Pattern Dễ Bị Bỏ Qua

Đây là nhóm function nhỏ nhưng cực kỳ quan trọng khi muốn hiểu repo sâu.

#### Helper family đáng đọc

| Family | Ví dụ | Ý nghĩa |
| --- | --- | --- |
| `normalize*` | `normalizeBaseURL`, `normalizePaymentMethod`, `normalizeShippingMethod`, `normalizeListProductsQuery` | Chuẩn hóa input trước khi vào invariant |
| `resolve*` | `resolveOAuthCallbackURL`, `resolveOptionalPhone`, `resolvePrimaryImage` | Quyết định semantics từ input mơ hồ |
| `build*` | `buildCreatedOrderOutbox`, `buildPaymentOutboxMessage`, `buildHistoryItem` | Materialize event/read model payload |
| `scan*` | `scanOrder`, `scanPayment`, `scanProductReviewRow` | Giữ repository code bớt lặp và rõ scan contract |
| `encode/decode*Cursor` | product/order list cursor helpers | Giữ pagination state ổn định, không phơi SQL internals ra API |

#### Repository pattern đáng học

1. transaction core thường nằm ở repo:
   - `createOrderTx`
   - payment `CreateWithIdempotency`
   - `ApplyWebhookResult`
   - `ProfileTxManager.RunInTx`
2. queue/lease pattern dùng SQL thật:
   - `ClaimPendingOutbox`
   - `ClaimPendingReturnRefunds`
3. DB-as-durable-queue pattern xuất hiện ở outbox/refund queue
4. repository không biết HTTP status code; handler/service mới map domain error sang transport error

---

## 3. cart-service

### 3.1. Vai trò runtime

`cart-service` giữ cart state của user trên Redis. Service này không sở hữu product truth; nó chỉ lưu snapshot `name`, `price`, `quantity` để phục vụ UX.

### 3.2. Startup wiring

Trình tự trong `services/cart-service/cmd/main.go`:

1. `config.Load("cart-service")`
2. init logger + tracing
3. kết nối Redis
4. tạo gRPC client tới `product-service`
5. tạo `CartRepository -> CartService -> CartHandler`
6. mount middleware và route

### 3.3. Public contract

| Route | Method | Handler | Ý nghĩa |
| --- | --- | --- | --- |
| `/api/v1/cart` | `GET` | `GetCart` | Lấy cart hiện tại |
| `/api/v1/cart/merge` | `POST` | `MergeCart` | Merge guest cart vào user cart |
| `/api/v1/cart/items` | `POST` | `AddItem` | Thêm item hoặc tăng quantity |
| `/api/v1/cart/items/:productId` | `PUT` | `UpdateItem` | Ghi đè quantity |
| `/api/v1/cart/items/:productId` | `DELETE` | `RemoveItem` | Xóa item |
| `/api/v1/cart` | `DELETE` | `ClearCart` | Xóa toàn bộ cart |

Tất cả route đều yêu cầu JWT.

### 3.4. Storage và integration

| Thành phần | Cách dùng |
| --- | --- |
| Redis | Lưu JSON blob tại key `cart:{userID}` với TTL 7 ngày |
| gRPC `product-service` | Lấy product truth để validate stock và cập nhật price/name mới nhất |

### 3.5. Function map theo tầng

#### Handler layer

| Function | Vai trò |
| --- | --- |
| `RegisterRoutes` | Khai báo toàn bộ contract HTTP của cart |
| `GetCart` | Read-only cart fetch |
| `MergeCart` | Parse `MergeCartRequest`, validate, map product/stock error |
| `AddItem` | Parse `AddToCartRequest`, validate và trả cart mới |
| `UpdateItem` | Update quantity cho item cụ thể |
| `RemoveItem` | Remove item khỏi cart |
| `ClearCart` | Xóa cart sau checkout hoặc theo user action |

#### Service layer

| Function | Vai trò |
| --- | --- |
| `GetCart` | Trả cart aggregate hiện tại |
| `MergeCart` | Merge nhiều item guest vào cart server-side trong một write |
| `AddItem` | Thêm hoặc tăng quantity một item |
| `UpdateItem` | Ghi đè quantity một item đã có |
| `RemoveItem` | Xóa một item |
| `ClearCart` | Delete cart key khỏi Redis |
| `loadCart` | Normalize nil cart thành cart rỗng |
| `saveCart` | Save cart và normalize `nil` slice |
| `getProductForCart` | Gọi gRPC product client và map lỗi |
| `mergeCartItem` | Update item bằng quantity delta và refresh price/name |
| `newCartItem` | Tạo cart line mới từ product snapshot |
| `ensureProductStock` | Guard stock constraint |

#### Repository layer

| Function | Vai trò |
| --- | --- |
| `Get` | Read và unmarshal cart từ Redis |
| `Save` | Marshal cart sang JSON và set TTL |
| `Delete` | Xóa cart key |

### 3.6. Điều đáng lưu ý khi đọc code

- `AddItem` và `MergeCart` luôn reload product truth
- `UpdateItem` hiện chưa reload product truth
- cart persistence là whole-cart overwrite chứ không phải per-item mutation

### 3.7. Walkthrough Theo File Và Theo Block Code

#### `internal/handler/cart/cart_handler.go`

1. `RegisterRoutes`
   - Toàn bộ cart route đều bắt buộc JWT.
   - Điều này nói rõ cart là state gắn với user đã xác thực.
2. `GetCart`
   - Handler rất mỏng: lấy `claims.UserID`, gọi service, trả response.
   - Đây là shape chuẩn cho read endpoint.
3. `MergeCart` và `AddItem`
   - Cùng pattern `Bind` -> `Validate` -> gọi service -> map domain error.
   - `ErrProductNotFound` map sang `404`, `ErrProductUnavailable` sang `400`, `ErrInsufficientStock` sang `409`.
4. `UpdateItem`
   - Chỉ map `ErrItemNotFound`.
   - Tín hiệu này rất quan trọng: write path này không reload product truth như `AddItem`.
5. `ClearCart`
   - Wrapper rất thẳng cho use case hậu checkout hoặc user tự xóa giỏ.

#### `internal/service/cart/cart_mutations.go`

1. `MergeCart`
   - Load cart hiện tại.
   - Loop qua từng guest item.
   - Với mỗi item, gọi `getProductForCart` để lấy snapshot authoritative.
   - Nếu item đã tồn tại thì `mergeCartItem`.
   - Nếu item chưa có thì `newCartItem`.
   - Kết thúc mới `saveCart` đúng một lần.
2. `AddItem`
   - Flow giống `MergeCart` nhưng cho một item.
   - `findCartItemIndex` quyết định update line cũ hay append line mới.
   - `cart.Total` được update theo delta, không cần rescan toàn bộ cart.
3. `UpdateItem`
   - Load cart, tìm item, nếu quantity không đổi thì return sớm.
   - Nếu đổi thì chỉ sửa quantity và subtotal delta rồi save.
   - Hàm này không gọi `getProductForCart`, nên không refresh giá/tồn kho mới nhất.
4. `RemoveItem`
   - Remove bằng `copy` + slice truncate.
   - `cart.Total` giảm theo item bị xóa.
5. `mergeCartItem`
   - Cộng `quantityDelta`, check stock với product snapshot mới, overwrite `Name` và `Price`.
   - Đây là lý do `AddItem`/`MergeCart` giúp sửa stale price ở write path.
6. `newCartItem`
   - Chuyển product snapshot thành `CartItem`.
   - Quantity vẫn được check lại ở service.

#### `internal/service/cart/cart_helpers.go`

1. `loadCart`
   - Wrap repo `Get`.
   - Normalize nil cart thành cart rỗng.
   - Normalize `nil` items thành slice rỗng để caller không phải check nil.
2. `saveCart`
   - Normalize `nil` items trước khi persist.
3. `getProductForCart`
   - Gọi gRPC `product-service`.
   - Map `codes.NotFound` thành `ErrProductNotFound`.
   - Map `codes.InvalidArgument` thành `ErrProductUnavailable`.
   - Các lỗi khác được wrap cùng `productID`.
4. `findCartItemIndex` và `itemSubtotal`
   - Helper nhỏ nhưng làm mutation flow dễ đọc hơn rất nhiều.

#### `internal/repository/cart/cart/cart_repository.go`

1. `Get`
   - Đọc key `cart:{userID}`.
   - Nếu `redis.Nil`, trả empty cart thay vì not-found.
   - Unmarshal JSON.
   - Refresh TTL sau mỗi lần read thành công bằng `Expire`.
2. `Save`
   - Marshal whole cart sang JSON.
   - `SET` với TTL 7 ngày.
3. `Delete`
   - `DEL` key Redis.
4. Trade-off của implementation
   - Rất dễ debug và vận hành.
   - Nhưng concurrent write có risk lost update vì là whole-cart overwrite, chưa có version check/WATCH.

---

## 4. notification-service

### 4.1. Vai trò runtime

`notification-service` là async consumer, không phải CRUD service thông thường. Nó consume event RabbitMQ, gửi email, dedupe delivery, lưu inbox history và chạy worker poll wishlist alert.

### 4.2. Startup wiring

Trình tự trong `services/notification-service/cmd/main.go`:

1. load config + tracing
2. kết nối Redis cho inbox/history/deduper
3. kết nối RabbitMQ, declare queue
4. tạo `UserClient`, `ProductClient`, `RetryPublisher`, `EventHandler`
5. start `QueueMonitor`
6. start `WishlistAlertWorker`
7. start `LowStockAlertWorker`
8. spawn N consumer worker cho message queue
9. expose HTTP API cho inbox/audit/health

### 4.3. Public contract

| Route | Method | Handler | Ý nghĩa |
| --- | --- | --- | --- |
| `/api/v1/notifications/inbox` | `GET` | `NotificationInboxHandler.List` | User lấy inbox history |
| `/api/v1/notifications/inbox/read` | `PUT` | `MarkRead` | Mark all inbox item as read |
| `/api/v1/notifications/audit` | `GET` | `Audit` | Admin/staff lấy audit feed |

### 4.4. Messaging contract

Consumer chính xử lý các routing key:

- `order.created`
- `order.cancelled`
- `payment.completed`
- `payment.failed`
- `payment.refunded`
- `return.requested`
- `return.approved`
- `return.rejected`
- `return.refund_pending`
- `return.refunded`

### 4.5. Storage và integration

| Thành phần | Cách dùng |
| --- | --- |
| Redis inbox store | Dedupe delivery qua key `processed` và `processing` |
| Redis history store | User inbox feed và audit feed |
| RabbitMQ | Consume main queue, publish retry queue, observe DLQ |
| SMTP | Gửi email notification |
| `user-service` HTTP client | Load notification preference và wishlist alerts dispatchable |

### 4.6. Function map theo tầng

#### HTTP handler

| Function | Vai trò |
| --- | --- |
| `NotificationInboxHandler.List` | Trả inbox history cho user |
| `MarkRead` | Mark all read |
| `Audit` | Trả audit feed cho admin/staff |

#### Consumer / worker layer

| Function | Vai trò |
| --- | --- |
| `startWorker` | Worker loop đọc từ RabbitMQ |
| `EventHandler.HandleMessage` | Entry point xử lý một delivery |
| `processMessage` | Dispatch theo routing key |
| `handleOrderCreated` | Tạo notification cho order mới |
| `handlePaymentCompleted` | Tạo notification cho payment thành công |
| `handlePaymentFailed` | Tạo notification cho payment thất bại |
| `handlePaymentRefunded` | Tạo notification cho refund |
| `handleOrderCancelled` | Tạo notification cho cancel |
| `handleReturnEvent` | Tạo notification cho return lifecycle |
| `shouldDeliverTopic` | Kiểm tra user preference |
| `appendHistoryBestEffort` | Ghi inbox history nhưng không fail luồng chính |

#### Reliability layer

| Function | Vai trò |
| --- | --- |
| `inbox.Store.Claim` | Chống duplicate giữa nhiều replica |
| `MarkProcessed` | Mark message processed |
| `Release` | Thả claim khi xử lý lỗi |
| `RetryPublisher.Publish` | Requeue message với delay/backoff |
| `QueueMonitor.Start` | Poll queue metrics |

#### Wishlist worker

| Function | Vai trò |
| --- | --- |
| `WishlistAlertWorker.Start` | Background ticker |
| `runCycle` | Poll batch alerts từ `user-service` |
| `deliver` | Deduplicate rồi gửi email |
| `wishlistAlertEmail` | Build subject/body cho wishlist alert |

#### Low stock worker

| Function | Vai trò |
| --- | --- |
| `LowStockAlertWorker.Start` | Background ticker; không chạy nếu chưa cấu hình người nhận |
| `runCycle` | Poll `product-service`, claim từng entry, gửi một digest |
| `releaseClaims` | Nhả claim khi gửi hỏng để chu kỳ sau báo lại |
| `lowStockDigestEmail` | Tách "đã hết" khỏi "sắp hết" trong cùng một email |

### 4.7. Điều đáng lưu ý khi đọc code

- reliability của service này nằm ở Redis + RabbitMQ semantics, không nằm ở HTTP API
- Redis down không giết service, nhưng dedupe/history degrade mạnh
- retry logic được bounded và poison message có đường ra DLQ

### 4.8. Walkthrough Theo File Và Theo Block Code

#### `internal/handler/event_handler.go`

Package handler được tách theo trách nhiệm: pipeline `HandleMessage`/`processMessage` ở `event_handler.go`; handler theo từng event + nội dung email ở `event_handler_events.go`; builder history item ở `event_handler_history.go`; phân loại lỗi permanent/transient ở `delivery_error.go`.

1. `HandleMessage`
   - Build delivery metadata trước khi làm gì khác.
   - Nếu có `inboxStore`, service cố `Claim` message trước khi xử lý.
   - Có ba nhánh rõ:
     - `AlreadyProcessed`: ack và bỏ qua duplicate.
     - `AlreadyClaimed`: nack requeue vì replica khác đang giữ claim.
     - `Claimed`: tiếp tục xử lý thật.
2. Nhánh lỗi trong `HandleMessage`
   - Release claim trước.
   - Permanent error -> append audit item -> reject DLQ.
   - Retry exhausted -> append audit item -> reject DLQ.
   - Transient error còn quota -> `retryPublisher.Publish` -> append audit item `retry_scheduled` -> ack message cũ.
3. Nhánh thành công
   - `appendHistoryBestEffort`.
   - `MarkProcessed`.
   - Ack RabbitMQ delivery.
4. `processMessage`
   - Dispatch theo routing key.
   - `return.*` được gom vào một branch chung.
   - Unsupported routing key bị coi là permanent failure.
5. `shouldDeliverTopic`
   - Không có preference reader thì default deliver.
   - Load preference lỗi thì coi là transient error.
   - Topic disabled thì skip send nhưng vẫn có thể ghi history.

#### `internal/inbox/redis_store.go`

1. `Claim`
   - Chạy Lua script trên hai key `processed` và `processing`.
   - Nếu processed đã tồn tại -> duplicate thật.
   - Nếu set được processing lock bằng `NX PX` -> current worker giữ claim.
   - Nếu không set được -> worker khác đang xử lý.
2. `MarkProcessed`
   - Set processed marker có TTL.
   - Xóa processing key.
3. `Release`
   - Xóa processing key khi xử lý fail sớm.
4. Ý nghĩa
   - Đây là dedupe thực dụng cho at-least-once delivery, không phải exactly-once thần kỳ.

#### `internal/inbox/history_store.go`

1. `Append`
   - Marshal `HistoryItem`.
   - Nếu visible cho user thì thêm vào sorted set theo user.
   - Luôn thêm vào audit feed chung.
   - Ghi payload item theo key riêng.
   - Tất cả qua Redis pipeline.
2. `ListByUser`
   - Lấy ID bằng `ZRevRange`.
   - Sau đó `listByIDs` để load payload.
3. `ListRecent`
   - Đọc audit feed với cùng pattern.
4. `MarkAllRead`
   - Load IDs của user.
   - Rewrite những item chưa có `ReadAt`.
   - Giữ lại TTL cũ nếu đọc được.

#### `internal/messaging/retry_publisher.go`

1. `Publish`
   - Clone headers gốc.
   - Set `retry_count`, `first_seen`, `next_retry_at`.
   - Tính delay bằng `delayForRetry`.
   - Publish sang retry queue với TTL bằng đúng delay.
2. `delayForRetry`
   - Exponential backoff bounded bởi `maxDelay`.
3. Ý nghĩa
   - Retry state nằm ngay trên message headers, không cần DB state riêng.

#### `internal/service/wishlist_alert_worker.go`

1. `Start`
   - Nếu thiếu `source` hoặc `sender`, worker không chạy.
   - Chạy `runCycle` ngay một lần trước khi vào ticker loop.
2. `runCycle`
   - Poll batch alerts từ `user-service` với timeout 30 giây.
   - Loop từng delivery và gọi `deliver`.
3. `deliver`
   - Claim qua deduper trước.
   - Validate email.
   - Build subject/body bằng `wishlistAlertEmail`.
   - Gửi email.
4. Điều cần nhớ
   - Notification service có ba async path: queue-driven consumer, polling-driven
     wishlist worker và polling-driven low stock worker.

#### `internal/service/low_stock_alert_worker.go`

1. `Start`
   - Danh sách người nhận rỗng thì worker dừng hẳn, không poll.
   - Chạy `runCycle` ngay một lần trước khi vào ticker loop.
2. `runCycle`
   - Poll `GET /api/v1/products/low-stock` với timeout 30 giây.
   - Claim từng entry qua deduper, gom các entry claim được thành **một** digest.
   - Gửi hỏng thì `releaseClaims` nhả toàn bộ claim của chu kỳ.
3. Deduper (`low_stock_alert_deduper.go`)
   - Khoá mang mức khẩn cấp `low`/`out` chứ không mang số tồn kho, TTL 24 giờ.
4. Điều cần nhớ
   - Đây là đường pull, không phải event: `product-service` không có hạ tầng
     messaging, và tồn kho thấp là trạng thái kéo dài chứ không phải sự kiện.

#### `internal/handler/inbox_handler.go`

1. `List`
   - Lấy `claims.UserID`, parse `limit`, gọi `HistoryStore.ListByUser`.
2. `MarkRead`
   - Chỉ chấp nhận `mark_all = true`, rồi gọi `MarkAllRead`.
3. `Audit`
   - Dùng cùng history store nhưng đọc audit feed chung.
4. Ý nghĩa
   - REST API của service rất mỏng.
   - Giá trị thật của service nằm ở reliability layer, không nằm ở CRUD surface.

---

## 5. order-service

### 5.1. Vai trò runtime

`order-service` sở hữu order aggregate, coupon, return, return refund queue, outbox và inbox transition cho payment event. Đây là service giữ nhiều invariant nhất trong repo.

### 5.2. Startup wiring

Trong `services/order-service/cmd/main.go`:

1. load config + tracing
2. mở PostgreSQL và chạy migration
3. mở RabbitMQ channel cho outbox relay và consumer
4. mở gRPC client tới `product-service`
5. tạo HTTP client tới `payment-service`
6. tạo `OrderRepository -> OrderService -> OrderHandler`
7. optional: attach object storage cho return evidence
8. start `StartOutboxRelay`
9. start `StartReturnRefundWorker`
10. start `StartReturnRefundQueueMonitor`
11. start payment event consumer

### 5.3. Public contract

#### User-facing routes

| Route | Method | Ý nghĩa |
| --- | --- | --- |
| `/api/v1/orders/preview` | `POST` | Quote order trước khi create |
| `/api/v1/orders` | `POST` | Tạo order |
| `/api/v1/orders/summary` | `GET` | Trả order + payment summary |
| `/api/v1/orders` | `GET` | List order của user |
| `/api/v1/orders/:id` | `GET` | Lấy chi tiết order |
| `/api/v1/orders/:id/events` | `GET` | Timeline của order |
| `/api/v1/orders/:id/cancel` | `PUT` | Hủy order |
| `/api/v1/orders/:id/return-eligibility` | `GET` | Snapshot item nào còn return được |
| `/api/v1/orders/:id/returns` | `POST` | Tạo return |
| `/api/v1/orders/:id/returns` | `GET` | List returns của order |
| `/api/v1/returns` | `GET` | List returns của user |
| `/api/v1/returns/:id` | `GET` | Lấy chi tiết return |
| `/api/v1/returns/:id/evidence` | `POST` | Upload return evidence |

#### Admin/staff routes

| Route | Method | Ý nghĩa |
| --- | --- | --- |
| `/api/v1/admin/orders` | `GET` | List admin orders, hỗ trợ cursor hoặc page/limit |
| `/api/v1/admin/orders/:id` | `GET` | Order detail |
| `/api/v1/admin/orders/:id/events` | `GET` | Order timeline |
| `/api/v1/admin/orders/:id/status` | `PUT` | Update order status |
| `/api/v1/admin/orders/:id/cancel` | `PUT` | Cancel order as admin |
| `/api/v1/admin/orders/report` | `GET` | Admin report |
| `/api/v1/admin/returns` | `GET` | List admin returns |
| `/api/v1/admin/returns/:id/status` | `PUT` | Update return status |
| `/api/v1/admin/returns/:id/refund` | `POST` | Queue refund cho return |
| `/api/v1/admin/returns/health` | `GET` | Refund queue health |
| `/api/v1/admin/coupons` | `POST`, `GET` | Create và list coupon |

### 5.4. Storage và integration

| Thành phần | Cách dùng |
| --- | --- |
| PostgreSQL | `orders`, `order_items`, `returns`, `return_items`, `return_evidence`, `order_events`, `coupons`, `outbox`, `inbox`, idempotency keys |
| gRPC `product-service` | Quote product, decrease stock, restore stock |
| HTTP `payment-service` | Payment summary, refund API |
| RabbitMQ | Publish order/return event, consume payment event |
| Object storage | Upload return evidence |

### 5.5. Function map theo tầng

#### Handler layer

| Function | Vai trò |
| --- | --- |
| `CreateOrder` | Bind + validate + read idempotency key + create order |
| `PreviewOrder` | Quote order |
| `GetOrder`, `GetUserOrders`, `GetUserOrderSummary` | User read model |
| `CancelOrder` | User cancel |
| `GetReturnEligibility` | Return eligibility snapshot |
| `CreateReturn`, `ListOrderReturns`, `GetReturn`, `ListUserReturns` | Return user flow |
| `UploadReturnEvidence` | Upload file evidence |
| `ListAdminOrders`, `GetAdminOrder`, `UpdateOrderStatus`, `CancelOrderAsAdmin` | Admin order flow |
| `ListAdminReturns`, `UpdateReturnStatus`, `RequestReturnRefund`, `GetReturnQueueHealth` | Admin return/refund flow |
| `CreateCoupon`, `ListCoupons`, `GetAdminReport`, `ListPopularProducts` | Admin/report helper flow |

#### Service layer

| Function | Vai trò |
| --- | --- |
| `PreviewOrder` | Quote nhưng chưa persist |
| `quoteOrder` | Canonical pricing logic |
| `quoteOrderItem` | Lấy product truth và validate stock |
| `CreateOrder` | Idempotent order create flow |
| `reserveCreatedOrderStock` | Reserve stock ở `product-service` |
| `persistCreatedOrder` | Persist order + outbox + idempotency record |
| `CancelOrder`, `CancelOrderAsAdmin`, `cancelOrderWithActor` | Cancel flows |
| `GetReturnEligibility` | Snapshot returnable quantity |
| `CreateReturn` | Tạo return request |
| `UpdateReturnStatus` | Chuyển trạng thái return |
| `RequestReturnRefund` | Queue refund bất đồng bộ |
| `StartReturnRefundWorker` | Worker xử lý refund_pending |
| `StartReturnRefundQueueMonitor` | Metric health cho queue |
| `buildCreatedOrderOutbox`, `buildCancelledOrderOutbox`, `buildReturnOutboxMessage` | Materialize outbox payload |
| `StartOutboxRelay` | Drain outbox lên RabbitMQ |

#### Repository layer

| Function | Vai trò |
| --- | --- |
| `Create`, `CreateWithIdempotency`, `createOrderTx` | Persist order transactionally |
| `GetByID`, `GetByUserID` | Read order aggregate |
| `GetIdempotencyKey` | Lookup idempotency record |
| `CreateReturn`, `GetReturnByID`, `ListReturnsByOrderID`, `ListReturns` | Return persistence |
| `AddReturnEvidence` | Persist return evidence + event |
| `ListAll`, `ListAllByCursor` | Admin order listing |
| `UpdateStatus`, `UpdateReturnStatus`, `ScheduleReturnRefund`, `CompleteReturnRefund` | Order/return state transition persistence |
| `ClaimPendingReturnRefunds`, `MarkReturnRefundAttemptFailed` | Refund worker lease + retry |
| `ClaimPendingOutbox`, `MarkOutboxPublished`, `MarkOutboxFailed` | Outbox relay state |
| `ApplyInboxStatusTransition` | Payment event dedupe + order status transition |

### 5.6. Điều đáng lưu ý khi đọc code

- pricing logic dùng chung cho preview và create
- stock reservation nằm ngoài DB transaction nên compensation rất quan trọng
- admin list hiện có cả path offset và path cursor
- outbox và inbox đều có thật, không phải chỉ là ý tưởng kiến trúc

### 5.7. Walkthrough Theo File Và Theo Block Code

#### `internal/handler/order/order_handler.go`

Khi mở file này, nên đọc theo đúng thứ tự sau:

1. `RegisterRoutes`
   - Đây là nơi service khai báo toàn bộ public boundary.
   - Nhìn vào đây sẽ thấy rõ repo đang tách `user routes`, `returns routes`, `admin orders`, `admin returns`, `admin coupons`.
   - Đây cũng là nơi cho thấy authz thực sự nằm ở middleware JWT + role, không nằm trong service.
2. `CreateOrder`
   - Block đầu chỉ làm đúng ba việc: lấy claims, `Bind`, `Validate`.
   - Block tiếp theo chuyển thẳng `Idempotency-Key` header xuống service. Chi tiết này rất quan trọng vì idempotency của order không tự sinh trong service; nó phụ thuộc vào caller gửi key hay không.
   - Block cuối map domain error như `ErrInvalidIdempotencyKey`, `ErrIdempotencyKeyConflict`, còn các lỗi pricing/product/coupon được gom vào `writePricingError`.
3. `PreviewOrder`
   - Hàm này chứng minh preview và create dùng chung validation boundary.
   - Handler không tính tiền; handler chỉ chuyển raw request xuống `PreviewOrder`.
4. `CreateReturn` và `RequestReturnRefund`
   - Hai hàm này thể hiện rõ khác biệt giữa synchronous write và async side effect.
   - `CreateReturn` trả `201` vì local transaction đã hoàn thành.
   - `RequestReturnRefund` trả `202 Accepted` vì chỉ mới queue `refund_pending`, refund thật diễn ra ở worker.

#### `internal/service/order/order_pricing.go`

Đây là file nên đọc đầu tiên nếu muốn hiểu order aggregate được tính ra như thế nào.

1. `PreviewOrder`
   - Chỉ là wrapper mỏng gọi `quoteOrder`.
   - Ý nghĩa kiến trúc là mọi tính toán canonical phải dồn về một chỗ, không được copy sang preview và create.
2. `quoteOrder`
   - Block `validateOrderRequest` loại bỏ request rỗng, normalize shipping method, và bắt buộc shipping address nếu không phải pickup.
   - Block khởi tạo `pricedOrderQuote` dựng quote ở dạng trung gian chứ chưa vội dựng `model.Order`. Cách này giữ rõ ranh giới giữa “đang tính giá” và “chuẩn bị persist”.
   - Vòng lặp qua `req.Items` gọi `quoteOrderItem` cho từng item nhưng tái sử dụng `productQuoteCache`, nghĩa là duplicate product ID trong cùng request không cần gọi catalog nhiều lần.
   - Block coupon chỉ chạy nếu `CouponCode` không rỗng; subtotal, shipping fee, total ban đầu luôn được tính trước khi apply coupon.
3. `validateOrderRequest`
   - Đây là chốt invariant đầu tiên của create order.
   - Hàm này cố tình fail sớm trước mọi remote call.
4. `quoteOrderItem`
   - Đây là chốt “source of truth là product-service”.
   - Hàm không tin giá hoặc tên từ frontend; nó gọi gRPC để lấy `pb.Product`.
   - Mỗi gRPC status code được map lại thành domain error của order như `ErrProductNotFound`, `ErrProductUnavailable`, `ErrInsufficientStock`.
5. `newProductQuoteCache` và `getOrLoad`
   - Hai helper nhỏ này đáng đọc vì cho thấy repo không tối ưu bằng cache toàn cục, mà chỉ dùng request-scoped cache đơn giản, an toàn, dễ hiểu.

#### `internal/service/order/order_lifecycle.go`

Đây là file orchestration quan trọng nhất của service.

1. Phần đầu `CreateOrder`
   - Bắt đầu bằng observability wrapper: lấy `startedAt`, `outcome`, `requestLog`, rồi `defer` metric latency.
   - Điều này cho thấy service layer mới là nơi ghi metric nghiệp vụ, không phải handler.
2. Block idempotency
   - `normalizeOrderIdempotencyKey` đảm bảo key ổn định trước khi dùng.
   - `hashCreateOrderRequest` dựng request hash để phân biệt “same key, same payload” và “same key, different payload”.
   - `findIdempotentOrder` cho phép request replay an toàn nếu record cũ còn hợp lệ.
3. Block pricing
   - `CreateOrder` không tự tính tổng tiền, mà lại gọi `quoteOrder`.
   - Đây là điểm giữ cho preview và create không drift.
4. Block build aggregate
   - `newOrderFromQuote` materialize `model.Order`.
   - `buildCreatedOrderOutbox` build message trước khi persist để DB transaction có đủ dữ liệu outbox ngay từ đầu.
   - Idempotency record chỉ được tạo khi caller có key và order có `ReservationExpiresAt`.
5. Block reserve stock
   - `reserveCreatedOrderStock` chạy trước local persistence.
   - Đây là chỗ trade-off rõ nhất: consistency cross-service đổi lấy compensation complexity.
6. Block persist + compensation
   - `persistCreatedOrder` ghi order, items, order event, outbox, idempotency record trong một transaction.
   - Nếu fail sau khi reserve stock, `restoreOrderItemsStock` được gọi để hoàn tác bên product-service.
   - Nếu lỗi là unique violation trên idempotency, service cố replay lại order cũ thay vì trả lỗi thô.
7. Block log thành công
   - Chỉ khi toàn bộ flow hoàn tất mới log `order created`.
   - Structured fields gồm `order_id`, `item_count`, `subtotal_price`, `total_price`, `shipping_method`.

#### `internal/service/order/order_returns.go`

File này cho thấy return là một state machine riêng sống trong order-service.

1. `CreateReturn`
   - Đầu tiên load order và check ownership.
   - Chỉ `delivered` mới return được, nên order status là invariant lớn nhất ở entry point.
   - `ListReturnsByOrderID` được gọi để biết số lượng item nào đã từng được return trước đó.
   - `buildReturnItems` là lõi của rule “không thể return quá số lượng đã mua”.
   - Sau đó mới build `ReturnRequest`, `ReturnEvent`, `ReturnOutbox`, rồi persist transactionally.
2. `ListUserReturns` và `ListAdminReturns`
   - Hai hàm này đáng đọc cạnh nhau vì chúng chỉ khác ở scoping và limit cap.
   - Đây là pattern tốt: reuse repository query nhưng enforce policy ở service.
3. `UpdateReturnStatus`
   - Validate status hợp lệ.
   - Load return hiện tại.
   - Dùng `canTransitionReturnStatus` để kiểm soát graph chuyển trạng thái.
   - Build outbox từ trạng thái mới rồi mới persist.
4. `RequestReturnRefund`
   - Hàm này không refund ngay.
   - Nó load return hiện tại, check xem đã `refunded`, đang `refund_pending`, hay chưa đủ điều kiện.
   - `prepareReturnRefund` tìm charge có thể refund và tính `RefundAmount`.
   - Sau đó repo chỉ đổi trạng thái sang `refund_pending` và ghi outbox/event.
5. `buildReturnItems`
   - Đây là helper nên đọc chậm.
   - Nó dựng map `orderItemsByID`, aggregate các quantity đã trả từ các return cũ, reject duplicate item trong cùng request, rồi kiểm tra `availableQuantity`.
   - Rule nghiệp vụ quan trọng nhất của return nằm ở đây, không nằm ở handler.

#### `internal/service/order/order_events.go`

File này là phần reliability backbone của service.

1. `buildCreatedOrderOutbox`, `buildCancelledOrderOutbox`, `buildReturnOutboxMessage`
   - Các hàm này materialize payload sự kiện dưới dạng row DB chứ chưa publish ngay.
   - `RequestID` từ context được copy vào payload và AMQP headers để trace xuyên service.
2. `StartOutboxRelay`
   - Đây là worker nền polling outbox.
   - Nếu `amqpCh` nil, service degrade bằng cách disable relay và log warning.
3. `flushOutboxBatch`
   - Claim một batch, publish từng message với timeout ngắn.
   - Nếu publish lỗi thì `MarkOutboxFailed` và đẩy `available_at` ra tương lai bằng backoff.
   - Nếu publish thành công thì `MarkOutboxPublished`.
4. `publishOutboxMessage`
   - Hàm này map outbox row sang AMQP publishing.
   - Delivery mode là persistent, có `MessageId`, `x-event-id`, `x-request-id`.
   - Đây là chốt để event publish có thể được dedupe hoặc trace downstream.

#### `internal/repository/order_repository.go`

File này dài nhưng có thể chia thành vài vùng logic rõ ràng:

1. `createOrderTx`
   - Mở transaction.
   - Nếu có coupon thì `lockAndConsumeCoupon`.
   - Insert `orders`.
   - Insert `order_items`.
   - Insert `order_events`.
   - Insert `outbox_events`.
   - Insert `order_idempotency_keys`.
   - Commit.
   - Đây là transaction giữ invariant “order persisted thì event và idempotency record cũng phải cùng tồn tại”.
2. `ListAll` và `ListAllByCursor`
   - Hai hàm này nên đọc cạnh nhau để thấy repo đang ở giai đoạn chuyển tiếp.
   - `ListAll` dùng `COUNT(*) + OFFSET/LIMIT`, phù hợp dashboard nhỏ nhưng sẽ đau khi dữ liệu lớn.
   - `ListAllByCursor` dùng `(created_at, id)` để tạo cursor ổn định hơn cho list lớn.
3. `ClaimPendingReturnRefunds`
   - Dùng `FOR UPDATE SKIP LOCKED` để claim job refund_pending.
   - Đây là pattern lease-based worker tốt cho multi-replica.
4. `CompleteReturnRefund` và `MarkReturnRefundAttemptFailed`
   - Một hàm finalize thành `refunded`, hàm kia reset `refund_processing_started_at` và đặt `next_retry_at`.
   - Cặp hàm này chính là transaction boundary giữa worker loop và retry semantics.
5. `ClaimPendingOutbox`, `MarkOutboxPublished`, `MarkOutboxFailed`
   - Đây là bộ ba helper tạo nên outbox relay.
   - `ClaimPendingOutbox` không cần in-memory queue; DB đã là durable queue.
6. `ApplyInboxStatusTransition`
   - Đây là phần inbox khi order-service consume payment event.
   - Flow là: insert inbox row -> lock order row -> kiểm tra status hiện tại -> nếu hợp lệ thì update order status + event -> commit.
   - Nhờ đó webhook/payment event replay không làm state transition chạy lặp.

---

## 6. payment-service

### 6.1. Vai trò runtime

`payment-service` sở hữu payment lifecycle: charge, refund, webhook state, outbox event và enriched payment history theo order.

### 6.2. Startup wiring

Trong `services/payment-service/cmd/main.go`:

1. load config + tracing
2. mở PostgreSQL + migration
3. optional: mở RabbitMQ
4. tạo order HTTP client
5. tạo `PaymentRepository -> PaymentService -> PaymentHandler`
6. start `StartOutboxRelay`

### 6.3. Public contract

#### User routes

| Route | Method | Ý nghĩa |
| --- | --- | --- |
| `/api/v1/payments` | `POST` | Tạo charge/payment |
| `/api/v1/payments/history` | `GET` | List payment history của user |
| `/api/v1/payments/:id` | `GET` | Lấy payment detail |
| `/api/v1/payments/order/:orderId` | `GET` | Lấy payment gần nhất theo order |
| `/api/v1/payments/order/:orderId/history` | `GET` | List toàn bộ payment theo order |

#### Admin routes

| Route | Method | Ý nghĩa |
| --- | --- | --- |
| `/api/v1/admin/payments/history` | `GET` | Batch list payments theo nhiều order |
| `/api/v1/admin/payments/order/:orderId/history` | `GET` | List payments của order bất kỳ |
| `/api/v1/admin/payments/:id/refunds` | `POST` | Tạo refund |

#### Webhook route

| Route | Method | Ý nghĩa |
| --- | --- | --- |
| `/api/v1/payments/webhooks/momo` | `POST` | Apply webhook MoMo |

### 6.4. Storage và integration

| Thành phần | Cách dùng |
| --- | --- |
| PostgreSQL | `payments`, idempotency keys, audit entries, outbox, inbox |
| HTTP `order-service` | Lookup authoritative order state |
| RabbitMQ | Publish `payment.completed`, `payment.failed`, `payment.refunded` |

### 6.5. Function map theo tầng

#### Handler layer

| Function | Vai trò |
| --- | --- |
| `ProcessPayment` | Charge request |
| `GetPayment`, `GetPaymentByOrder`, `ListPaymentsByOrder`, `ListPaymentHistory` | User read model |
| `RefundPayment` | Admin refund |
| `ListPaymentsByOrderAdmin`, `ListPaymentsByOrderIDsAdmin` | Admin read model |
| `HandleMomoWebhook` | Gateway webhook |

#### Service layer

| Function | Vai trò |
| --- | --- |
| `ProcessPayment` | Normalize idempotency rồi delegate core flow |
| `processPaymentCore` | Lookup order, validate outstanding, persist charge |
| `RefundPayment` | Persist refund against charge |
| `HandleMomoWebhook` | Verify signature, replay-safe apply webhook |
| `GetPayment`, `GetPaymentByOrder`, `ListPaymentsByOrder`, `ListPaymentHistory` | Payment read API |
| `enrichPayments`, `enrichPayment` | Tính derived fields theo order |
| `buildPaymentOutboxMessage` | Materialize payment event payload |
| `StartOutboxRelay` | Drain payment outbox |

#### Repository layer

| Function | Vai trò |
| --- | --- |
| `Create`, `CreateWithIdempotency` | Persist charge/refund và outbox |
| `GetByID`, `GetByOrderID`, `GetByGatewayOrderID` | Read payment state |
| `GetIdempotencyKey` | Lookup idempotency record |
| `ListByOrderID`, `ListByOrderIDs`, `ListByUserID` | Query payment history |
| `Update` | Update payment state |
| `ApplyWebhookResult` | Apply webhook transactionally cùng inbox/outbox |
| `ClaimPendingOutbox`, `MarkOutboxPublished`, `MarkOutboxFailed` | Outbox relay |

### 6.6. Điều đáng lưu ý khi đọc code

- `payment-service` không tin frontend về order total
- webhook path đã có signature verification và replay-safe behavior
- read path luôn enrich raw payment row thành business snapshot dễ dùng hơn

### 6.7. Walkthrough Theo File Và Theo Block Code

#### `internal/handler/payment/payment_handler.go`

1. `RegisterRoutes`
   - Tách rõ user routes, admin routes và webhook route.
   - Webhook không đi qua JWT, đây là boundary đặc biệt.
2. `ProcessPayment`
   - Lấy `claims.UserID`, `claims.Email`, `Authorization`, `Idempotency-Key`.
   - Forward xuống service.
   - Map rất rõ các business error như `ErrOrderNotPayable`, `ErrPaymentAlreadySettled`, `ErrInvalidPaymentAmount`, `ErrIdempotencyKeyConflict`.
3. `RefundPayment`
   - Chỉ admin/staff gọi được.
   - Không dùng email của actor làm customer recipient.
4. `HandleMomoWebhook`
   - Chỉ bind request rồi giao toàn bộ verification/signature/state cho service.

#### `internal/service/payment/payment_processing.go`

1. `ProcessPayment`
   - Normalize idempotency key.
   - Hash request payload.
   - `findIdempotentPayment` trước khi vào core flow.
2. `processPaymentCore`
   - Bắt đầu bằng observability wrapper và contextual logger.
   - Gọi `orderClient.GetOrder` với auth header gốc để lấy authoritative order.
   - Reject nếu order không thuộc user.
   - Reject nếu order status không payable.
   - Load payment history của order để tính `netPaid` và `outstanding`.
   - Nếu amount <= 0 thì default sang outstanding.
   - Normalize payment method.
   - Materialize `model.Payment`.
   - Nếu gateway là MoMo thì set `pending`, `GatewayOrderID`, `CheckoutURL`.
   - Nếu completed ngay thì build outbox event.
   - Persist bằng `CreateWithIdempotency` hoặc `Create`.
   - Nếu unique violation trên idempotency thì thử replay payment cũ.
3. Điểm đáng học
   - Service không tin client về order total hay outstanding balance.
   - Payment state được suy ra từ order truth + sibling payments local.

#### `internal/service/payment/payment_refunds.go`

1. `RefundPayment`
   - Normalize key và hash refund request.
   - Load target payment.
   - Chỉ completed charge mới refund được.
   - Load sibling payments để tính `refundableAmountForCharge`.
   - Amount <= 0 thì default full refundable balance.
   - Materialize refund row.
   - Build outbox `payment.refunded`.
   - Persist transactionally, kèm idempotency record nếu có.
   - Best-effort ghi audit entry.
2. `HandleMomoWebhook`
   - Resolve payment theo `payment_id` hoặc `gateway_order_id`.
   - Verify provider thực sự là `momo`.
   - Verify signature.
   - Nếu payment không còn pending thì coi là replay an toàn.
   - Nếu còn pending thì verify amount, đổi state thành `completed` hoặc `failed`.
   - Build outbox từ state mới.
   - Gọi repo `ApplyWebhookResult` để commit inbox + payment update + outbox trong cùng transaction.

#### `internal/service/payment/payment_enrichment.go`

1. `enrichPayments`
   - Precompute summary theo từng order.
   - Clone từng payment rồi attach `NetPaidAmount`, `OutstandingAmount`.
2. `enrichPayment`
   - Phiên bản one-off cho một payment với sibling history.
3. `refundableAmountForCharge`
   - Trừ các refund thành công reference vào charge đó.
4. Ý nghĩa
   - API trả read model thân thiện hơn raw row persistence.

#### `internal/service/payment/payment_events.go`

1. `buildPaymentOutboxMessage`
   - Materialize durable event payload từ payment enriched state.
2. `StartOutboxRelay`
   - Pattern giống order-service: ticker -> flush batch -> mark published/failed.
3. `publishOutboxMessage`
   - Gắn `x-event-id`, `x-request-id`, persistent delivery mode.
4. Ý nghĩa
   - Request path không publish trực tiếp; DB outbox mới là source cho async event.

#### `internal/repository/payment/payment_repository.go`

1. `Create`
   - Transaction gồm `insertPaymentTx` + `insertOutboxMessageTx`.
2. `CreateWithIdempotency`
   - Thêm `insertIdempotencyRecordTx` vào cùng transaction.
3. `ApplyWebhookResult`
   - Insert inbox row trước để dedupe webhook.
   - Update payment chỉ khi current status còn `pending`.
   - Insert outbox.
   - Commit.
   - Nếu inbox row đã tồn tại thì coi là duplicate.
4. `ClaimPendingOutbox`
   - Dùng `FOR UPDATE SKIP LOCKED`, replica-safe như order-service.

---

## 7. product-service

### 7.1. Vai trò runtime

`product-service` là source of truth cho catalog, stock, review và storefront content. Đây là service có cả HTTP lẫn gRPC contract.

### 7.2. Startup wiring

Trong `services/product-service/cmd/main.go`:

1. load config + tracing
2. mở PostgreSQL + migration
3. tạo product repo + search analytics repo
4. optional: object storage
5. optional: Elasticsearch
6. tạo `ProductService`
7. tạo storefront repo/service
8. tạo review repo/service với optional Redis cache và observer chain
9. optional: sync search index on startup
10. start low stock monitor
11. mount HTTP routes và gRPC server

### 7.3. Public contract

#### Public HTTP routes

| Route | Method | Ý nghĩa |
| --- | --- | --- |
| `/api/v1/products` | `GET` | List products với cursor/filter/sort |
| `/api/v1/products/batch` | `GET` | Batch list by IDs |
| `/api/v1/products/search/assist` | `GET` | Search assist |
| `/api/v1/products/:id` | `GET` | Product detail |
| `/api/v1/products/:id/reviews` | `GET` | Product review list |
| `/api/v1/storefront/home` | `GET` | Storefront home data |
| `/api/v1/storefront/categories` | `GET` | List storefront categories |
| `/api/v1/storefront/categories/:identifier` | `GET` | Category page |

#### Protected HTTP routes

| Route | Method | Ý nghĩa |
| --- | --- | --- |
| `/api/v1/products` | `POST` | Create product |
| `/api/v1/products/uploads` | `POST` | Upload product images |
| `/api/v1/products/:id` | `PUT`, `DELETE` | Update / delete product |
| `/api/v1/products/analytics/search` | `GET` | Search analytics |
| `/api/v1/products/analytics/search/events` | `POST` | Record search event |
| `/api/v1/products/:id/reviews/me` | `GET`, `PUT`, `DELETE` | User review riêng |
| `/api/v1/products/:id/reviews` | `POST` | Create review |

#### gRPC routes

| RPC | Ý nghĩa |
| --- | --- |
| `GetProductByID` | Internal product lookup |
| `UpdateProduct` | Internal stock update / product update path |

### 7.4. Storage và integration

| Thành phần | Cách dùng |
| --- | --- |
| PostgreSQL | Product, variants, categories, storefront, reviews, analytics |
| Elasticsearch | Optional search index |
| Redis | Optional review cache |
| Object storage | Product image upload |

### 7.5. Function map theo tầng

#### Handler layer

| Function | Vai trò |
| --- | --- |
| `Create`, `GetByID`, `ListByIDs`, `Update`, `Delete`, `List` | Catalog CRUD/list |
| `SearchAssist`, `GetSearchAnalytics`, `RecordSearchEvent` | Search UX + analytics |
| `CreateReview`, `GetMyReview`, `UpdateMyReview`, `DeleteMyReview`, `ListReviews` | Review API |
| `StorefrontHandler.GetHome`, `ListCategories`, `GetCategoryPage` | Storefront data API |

#### Service layer

| Function | Vai trò |
| --- | --- |
| `Create`, `Update`, `Delete`, `GetByID`, `ListByIDs` | Core catalog CRUD |
| `List` | Search-aware catalog listing |
| `CheckStock`, `ListLowStock`, `ListLowStockEntries`, `RestoreStock`, `DecreaseStock` | Inventory API — `ListLowStockEntries` làm phẳng cảnh báo tới từng variant cho notification-service |
| `SyncSearchIndex` | Rebuild optional search index |
| `GetSearchAssist`, `RecordSearchEvent`, `recordSearchAnalyticsBestEffort` | Search assist + analytics |
| `StorefrontService.ListCategories`, `GetHome`, `GetCategoryPage` | Storefront read orchestration |
| `ProductReviewService.ListReviews`, `CreateReview`, `UpdateReview`, `DeleteReview` | Review domain |
| `notifyBestEffort` | Observer chain cho metrics/cache invalidation |
| `EnsureMediaStore`, `UploadImages` | Media upload flow |

#### Repository layer

| Function | Vai trò |
| --- | --- |
| Product repository | CRUD product, list by cursor, search assist, stock mutation |
| Storefront repository | Read category/editorial/featured product |
| Product review repository | Review persistence + summary delta |
| Search analytics repository | Query + event analytics |
| Product review cache | Redis cache cho summary và first page |

### 7.6. Điều đáng lưu ý khi đọc code

- PostgreSQL vẫn là source of truth, search/cache chỉ là optional accelerator
- review flow là ví dụ hay của tx manager + observer + cache invalidation
- storefront service tránh N+1 bằng batch repository methods

### 7.7. Walkthrough Theo File Và Theo Block Code

#### `internal/handler/product/product_handler.go`

1. `RegisterRoutes`
   - Chia boundary thành public catalog/search/review list, admin catalog CRUD/upload/analytics, và authenticated user review routes.
   - Đây là bản đồ route tốt nhất của service.
2. `List`
   - Parse filter, cursor, sort, price range.
   - Delegate sang `ProductService.List`.
   - Chỉ map `ErrInvalidCursor`, còn search/fallback hoàn toàn ở service.
3. `Create` và `Update`
   - Admin-only write path.
   - Handler chỉ validate rồi giao việc cho service.
4. `SearchAssist`, `GetSearchAnalytics`, `RecordSearchEvent`
   - Cho thấy product-service còn sở hữu search UX support chứ không chỉ CRUD.

#### `internal/handler/product/storefront_handler.go`

1. `GetHome`
   - Parse `limit`.
   - Gọi `StorefrontService.GetHome`.
   - Normalize nil slices trước khi trả response.
2. `ListCategories`
   - Public read path rất mỏng.
3. `GetCategoryPage`
   - `ErrStorefrontCategoryNotFound` được map riêng sang `404`.

#### `internal/handler/product/product_review_handler.go`

1. `ListReviews`
   - Offset/page/limit style cổ điển.
   - Trả meta pagination cho UI.
2. `CreateReview`, `UpdateMyReview`, `DeleteMyReview`
   - Lấy user claims từ JWT rồi delegate sang review service.
   - `ErrProductReviewAlreadyExists` map sang `409`.

#### `internal/service/product_queries.go`

1. `List`
   - Normalize query một lần.
   - Nếu có search backend và query phù hợp, service thử search trước.
   - Search trả IDs thì service `ListByIDs` từ PostgreSQL để hydrate full row.
   - Search fail thì log warning rồi fallback PostgreSQL cursor listing.
   - Dù đi path nào thì analytics vẫn record best-effort.
2. `DecreaseStock`
   - Validate quantity > 0.
   - Load product trước để phân biệt not-found với insufficient stock.
   - Gọi repo atomic decrement.
   - Reindex stock change best-effort.
3. `RestoreStock`
   - Pattern ngược của `DecreaseStock`, rồi reindex best-effort.

#### `internal/service/product_crud.go`

1. `Create`
   - `newProductFromCreateRequest` normalize status, variants, image URLs, tags, stock.
   - Persist product.
   - Index search backend best-effort.
2. `Update`
   - Load current product.
   - `applyProductUpdate` mutate patch in-place.
   - Persist rồi best-effort reindex.
3. `Delete`
   - Delete ở PostgreSQL trước.
   - Search index delete chạy best-effort sau.
4. Ý nghĩa
   - PostgreSQL luôn là source of truth.
   - Search/index chỉ là accelerator phụ trợ.

#### `internal/service/storefront_service.go`

1. `ListCategories`
   - Wrapper mỏng nhưng normalize nil slice.
2. `GetHome`
   - Load categories.
   - Apply `sanitizeStorefrontHomeLimit`.
   - Batch `ListEditorialSectionsByCategorySlugs`.
   - Batch `ListFeaturedProductsByCategorySlugs`.
   - Compose `StorefrontCategoryPage`.
   - Filter category không có storefront content hữu ích.
3. `GetCategoryPage`
   - Resolve category theo identifier.
   - Load sections + featured products cho đúng category.
4. Điểm đáng học
   - Service chủ động tránh category + N query waterfall.

#### `internal/service/product_review_service.go`

1. `CreateReview`
   - Verify product tồn tại trước.
   - Dùng factory tạo review aggregate.
   - `runInTx` để `CreateReview` và `ApplyReviewSummaryDelta` cùng commit.
   - Sau commit mới `notifyBestEffort`.
2. `UpdateReview`
   - Load review cũ trong transaction.
   - Clone previous review để tính delta.
   - Update row và apply summary delta.
   - Notify observer sau commit.
3. `DeleteReview`
   - Delete review row trong transaction.
   - Apply negative summary delta.
   - Notify observer sau commit.
4. Điểm đáng học
   - Observer chain tách cache invalidation/metrics khỏi transaction core.

#### `internal/repository/product/*`

1. `product_repository.go`
   - `List` là cursor pagination thật.
   - `ListByIDs` hydrate đúng thứ tự requested IDs.
   - `UpdateStock` là atomic decrement `WHERE stock >= $1`.
   - `RestoreStock` là atomic increment.
2. `storefront_repository.go`
   - `ListEditorialSectionsByCategorySlugs` và `ListFeaturedProductsByCategorySlugs` là backbone của batching storefront.
3. `product_review_repository.go`
   - `CreateReview` map unique violation sang `ErrProductReviewAlreadyExists`.
   - `DeleteReviewByProductAndUser` dùng `DELETE ... RETURNING`.
   - `ApplyReviewSummaryDelta` update summary table bằng delta, không recount toàn bảng.

---

## 8. user-service

### 8.1. Vai trò runtime

`user-service` sở hữu auth, profile, avatar, address, OTP, OAuth, wishlist và notification preference. Đây là service có bề mặt chức năng rộng nhất repo.

### 8.2. Startup wiring

Trong `services/user-service/cmd/main.go`:

1. load config + tracing
2. mở PostgreSQL + migration
3. optional: bootstrap dev account
4. tạo repository cho user, OAuth account, OTP challenge, avatar, address, wishlist, notification preference
5. tạo product client cho wishlist baseline
6. tạo `AddressService`, `NotificationPreferenceService`, `WishlistService`, `UserService`
7. mount HTTP handler cho auth/profile/address/wishlist/preference
8. mount gRPC server

### 8.3. Public contract

#### Auth routes

| Route | Method | Ý nghĩa |
| --- | --- | --- |
| `/api/v1/auth/register` | `POST` | Register email/password |
| `/api/v1/auth/register/email/send-otp` | `POST` | Start email signup OTP |
| `/api/v1/auth/register/email/verify-otp` | `POST` | Verify email signup OTP |
| `/api/v1/auth/register/email/resend-otp` | `POST` | Resend email signup OTP |
| `/api/v1/auth/register/phone/send-otp` | `POST` | Start phone signup OTP |
| `/api/v1/auth/register/phone/verify-otp` | `POST` | Verify phone signup OTP |
| `/api/v1/auth/register/phone/resend-otp` | `POST` | Resend phone signup OTP |
| `/api/v1/auth/login` | `POST` | Login |
| `/api/v1/auth/refresh` | `POST` | Refresh token |
| `/api/v1/auth/verify-email` | `POST` | Verify email bằng token-link cũ |
| `/api/v1/auth/forgot-password` | `POST` | Start password recovery |
| `/api/v1/auth/reset-password` | `POST` | Reset password |
| `/api/v1/auth/oauth/google/start` | `GET` | Start Google OAuth |
| `/api/v1/auth/oauth/google/callback` | `GET` | OAuth callback |
| `/api/v1/auth/oauth/exchange` | `POST` | Exchange OAuth ticket |

#### User profile routes

| Route | Method | Ý nghĩa |
| --- | --- | --- |
| `/api/v1/users/profile` | `GET`, `PUT` | Get/update profile |
| `/api/v1/users/avatar` | `POST` | Upload avatar |
| `/api/v1/users/password` | `PUT` | Change password |
| `/api/v1/users/verify-email/resend` | `POST` | Resend verification email kiểu cũ |

#### OTP verify routes cho user đã đăng nhập

| Route | Method | Ý nghĩa |
| --- | --- | --- |
| `/api/v1/users/profile/phone-verification` | `GET` | Phone verification status |
| `/api/v1/users/profile/phone-verification/send-otp` | `POST` | Send phone OTP |
| `/api/v1/users/profile/phone-verification/verify-otp` | `POST` | Verify phone OTP |
| `/api/v1/users/profile/phone-verification/resend-otp` | `POST` | Resend phone OTP |
| `/api/v1/users/verify-email/status` | `GET` | Email verification status |
| `/api/v1/users/verify-email/send-otp` | `POST` | Send email OTP |
| `/api/v1/users/verify-email/verify-otp` | `POST` | Verify email OTP |
| `/api/v1/users/verify-email/resend-otp` | `POST` | Resend email OTP |

#### Address, wishlist, preference routes

| Route | Method | Ý nghĩa |
| --- | --- | --- |
| `/api/v1/users/addresses` | `POST`, `GET` | Create/list addresses |
| `/api/v1/users/addresses/:id` | `PUT`, `DELETE` | Update/delete address |
| `/api/v1/users/addresses/:id/default` | `PUT` | Set default address |
| `/api/v1/users/wishlist` | `GET`, `POST` | List/add wishlist item |
| `/api/v1/users/wishlist/sync` | `POST` | Sync wishlist batch |
| `/api/v1/users/wishlist/:productId` | `DELETE` | Remove wishlist item |
| `/api/v1/users/wishlist/alerts` | `GET` | Wishlist alerts |
| `/api/v1/users/notification-preferences` | `GET`, `PUT` | Notification preference |
| `/api/v1/admin/wishlist-alerts` | `GET` | Dispatchable alert feed cho worker |

#### Admin routes

| Route | Method | Ý nghĩa |
| --- | --- | --- |
| `/api/v1/admin/users` | `GET` | List users |
| `/api/v1/admin/users/:id/role` | `PUT` | Update user role |

#### gRPC routes

| RPC | Ý nghĩa |
| --- | --- |
| `Register`, `Login` | Internal auth path |
| `GetProfile`, `UpdateProfile` | Internal profile path |
| `GetUserByID` | Internal user lookup |

### 8.4. Storage và integration

| Thành phần | Cách dùng |
| --- | --- |
| PostgreSQL | users, oauth_accounts, avatar, address, OTP/signup challenge, wishlist, notification preference |
| SMTP | Email verification, password reset, OTP email |
| Telegram | Phone OTP |
| HTTP `product-service` | Wishlist baseline/snapshot |
| gRPC | Internal user APIs |

### 8.5. Function map theo tầng

#### Handler layer

| Function | Vai trò |
| --- | --- |
| `Register`, `Login`, `RefreshToken` | Auth contract |
| `VerifyEmail`, `ForgotPassword`, `ResetPassword`, `ChangePassword` | Recovery/password flow |
| `GetProfile`, `UpdateProfile`, `UploadAvatar` | Profile API |
| `StartEmailSignup`, `VerifyEmailSignupOTP`, `ResendEmailSignupOTP` | Email signup OTP |
| `StartPhoneSignup`, `VerifyPhoneSignupOTP`, `ResendPhoneSignupOTP` | Phone signup OTP |
| `GetEmailVerificationStatus`, `SendEmailVerificationOTP`, `VerifyEmailOTP`, `ResendEmailVerificationOTP` | Logged-in email verify flow |
| `GetPhoneVerificationStatus`, `SendPhoneOTP`, `VerifyPhoneOTP`, `ResendPhoneOTP` | Logged-in phone verify flow |
| `StartGoogleOAuth`, `GoogleOAuthCallback`, `ExchangeOAuthTicket` | OAuth flow |
| `ListUsers`, `UpdateUserRole` | Admin user management |
| `AddressHandler.*` | Address CRUD |
| `WishlistHandler.*` | Wishlist CRUD + alert feed |
| `NotificationPreferenceHandler.*` | Notification preference read/update |

#### Service layer: account domain

| Function | Vai trò |
| --- | --- |
| `Register`, `Login`, `ChangePassword` | Core auth |
| `RefreshToken`, `generateTokenPair` | JWT lifecycle |
| `VerifyEmail`, `ResendVerificationEmail`, `ForgotPassword`, `ResetPassword` | Recovery flow |
| `GetProfile`, `UpdateProfile` | Profile lifecycle |
| `applyVerifiedPhoneChange` | Guard verified phone invariant |
| `UploadAvatar`, `attachAvatarURL` | Avatar persistence + profile enrichment |
| `StartEmailSignup`, `VerifyEmailSignupOTP`, `ResendEmailSignupOTP` | Email signup challenge |
| `StartPhoneSignup`, `VerifyPhoneSignupOTP`, `ResendPhoneSignupOTP` | Phone signup challenge |
| `StartEmailVerificationOTP`, `VerifyEmailOTP`, `ResendEmailVerificationOTP` | Email verify challenge |
| `StartPhoneVerification`, `VerifyPhoneOTP`, `ResendPhoneOTP` | Phone verify challenge |
| `BeginOAuth`, `CompleteOAuthCallback`, `ExchangeOAuthTicket` | OAuth lifecycle |

#### Service layer: engagement domain

| Function | Vai trò |
| --- | --- |
| `AddressService.CreateAddress`, `UpdateAddress`, `DeleteAddress`, `SetDefault` | Address book logic |
| `NotificationPreferenceService.ListPreferences`, `UpdatePreferences`, `PreferenceMap` | Preference logic |
| `WishlistService.ListWishlist`, `AddToWishlist`, `SyncWishlist`, `RemoveFromWishlist` | Wishlist CRUD |
| `WishlistService.ListAlerts` | Detect price drop / back in stock |
| `WishlistService.ListDispatchableAlerts` | Feed cho notification worker |

#### Repository layer

| Function | Vai trò |
| --- | --- |
| `UserRepository.Create`, `GetByEmail`, `GetByPhone`, `Update`, `List` | Core user persistence |
| `OAuthAccountRepository.*` | OAuth account link persistence |
| `AddressRepository.*` | Address persistence |
| OTP challenge repositories | Signup/verify challenge persistence |
| `WishlistRepository.*` | Wishlist persistence |
| `NotificationPreferenceRepository.*` | Preference persistence |
| `ProfileTxManager.RunInTx` | Transaction manager cho user + address + phone verification |

### 8.6. Điều đáng lưu ý khi đọc code

- `user-service` thực chất là nhiều subdomain sống chung: auth, profile, OTP, OAuth, engagement
- profile update đã có tx manager cho multi-repo invariant
- login brute-force protection hiện ở handler level qua `LoginAttemptProtector`
- wishlist alert generation phụ thuộc snapshot product hiện tại từ `product-service`

### 8.7. Walkthrough Theo File Và Theo Block Code

#### `internal/handler/user/auth_handlers.go`

Đây là file boundary quan trọng nhất của auth.

1. `Register`
   - Block đầu là `Bind` + `Validate`, hoàn toàn không có business logic.
   - `h.userService.Register` trả `AuthResponse` nếu tạo user thành công.
   - Sau khi register xong, handler kiểm tra `result.User` và nếu email chưa verify thì best-effort gọi `StartEmailVerificationOTP`.
   - Điểm này rất đáng học: registration thành công không bị rollback chỉ vì email dispatch lỗi.
2. `Login`
   - Trước khi vào service, handler tự kiểm tra identifier và áp `LoginAttemptProtector`.
   - `attemptKeys` được tạo từ identifier + IP, nghĩa là lock scope không chỉ theo email mà còn theo nguồn request.
   - Nếu service trả `ErrInvalidCredentials`, handler mới `RecordFailure`; nếu thành công thì `RecordSuccess`.
   - Như vậy password verification vẫn ở service, nhưng lock policy nằm ở boundary.
3. `RefreshToken`, `ForgotPassword`, `ResetPassword`, `ChangePassword`
   - Nhóm hàm này đáng đọc để thấy error mapping khá ổn định: invalid token -> `401`, not found -> `404`, còn internal giữ ở `500`.

#### `internal/handler/user/profile_handlers.go`

1. `GetProfile`
   - Chỉ lấy user claims rồi gọi service.
   - Điều này giữ handler mỏng và không buộc handler biết avatar storage hay address semantics.
2. `UpdateProfile`
   - Đây là entry point tốt để học mapping domain error phong phú.
   - Handler phân biệt rõ `ErrInvalidPhoneNumber`, `ErrInvalidProfileName`, `ErrInvalidProfileAddress`, `ErrPhoneVerificationRequired`, `ErrPhoneVerificationAlreadyUsed`.
   - Vì service trả domain error sạch nên handler map được rất rõ sang status/message.
3. `UploadAvatar`
   - Có validation file size, MIME detection và fallback `http.DetectContentType`.
   - Đây là ví dụ tốt của validation boundary cho upload.

#### `internal/service/account/user_auth.go`

1. `Register`
   - Normalize email, phone, tên.
   - Nếu người dùng không nhập tên, service tự generate display name tạm.
   - Lookup uniqueness theo email trước, phone sau.
   - Hash password bằng bcrypt cost `12`.
   - Tạo `model.User`, đồng thời phát sinh email verification token hash và expiry.
   - Persist user rồi build auth response.
2. `Login`
   - `normalizeIdentifier` chọn `Identifier` mới hoặc fallback field `Email` cũ.
   - `findUserByIdentifier` tách lookup email và phone thành helper riêng.
   - `bcrypt.CompareHashAndPassword` là chốt xác thực duy nhất; handler không đụng vào hash.
3. `buildAuthResponse`
   - Trước khi ký token, service enrich user bằng avatar URL.
   - Sau đó mới `generateTokenPair`.
   - Đây là lý do response auth đã ở dạng “frontend dùng được ngay”, không cần call profile lần nữa.

#### `internal/service/account/user_profile.go`

Đây là file nên đọc chậm vì nó giữ nhiều invariant tinh vi.

1. `UpdateProfile`
   - Nếu `profileTxManager` nil thì chạy flow trực tiếp.
   - Nếu có `profileTxManager`, service wrap toàn bộ logic trong transaction và thay dependency bằng repo dùng `tx`.
   - Cách viết này giúp cùng một business flow chạy được cả transactional mode lẫn unit test mode.
2. `updateProfileWithDependencies`
   - Load user hiện tại.
   - Resolve từng field optional như first name, last name.
   - Resolve phone patch và xác định `phoneChanged`.
   - Nếu đổi phone thì gọi `applyVerifiedPhoneChange`; không có verified challenge thì fail.
   - Với default address, service chỉ fetch address khi patch thực sự có ý nghĩa, tránh query thừa.
   - Nếu không có thay đổi gì thì return sớm.
   - Nếu có address patch thì `UpsertDefaultAddress`.
   - Nếu có user patch thì `userRepo.Update`.
   - Cuối cùng mới consume verified phone challenge.
3. `applyVerifiedPhoneChange`
   - Validate format số điện thoại.
   - Check uniqueness phone.
   - Load verification challenge theo ID.
   - Đảm bảo challenge thuộc đúng user, chưa consumed, đúng số phone yêu cầu, đã verified.
   - Chỉ sau khi mọi điều kiện đúng mới mutate `user.Phone` trong memory.
   - Challenge chưa bị consume ngay ở đây; việc consume chỉ diễn ra sau khi profile update commit xong.

#### `internal/service/account/email_verification.go`

File này là ví dụ OTP flow khá production-oriented.

1. `StartEmailVerificationOTP`
   - Check repository đã được config chưa.
   - Load user và short-circuit nếu đã `EmailVerified`.
   - Cleanup expired challenge theo kiểu opportunistic.
   - Lấy active challenge gần nhất để quyết định reuse hay expire cái cũ.
   - Generate OTP code, hash OTP kèm normalized email.
   - Rate limit theo ba chiều: user, email, IP.
   - Tạo challenge mới hoặc refresh challenge cũ.
   - Dispatch email ở cuối.
2. `VerifyEmailOTP`
   - Load challenge theo `VerificationID`.
   - Reject nếu sai chủ sở hữu, consumed, locked, expired.
   - Compare hash bằng `subtle.ConstantTimeCompare`.
   - Sai OTP thì tăng `AttemptCount`, có thể chuyển sang `Locked`.
   - Đúng OTP thì update challenge sang `Verified`, sau đó update `user.EmailVerified = true`.
3. `ResendEmailVerificationOTP`
   - Re-check ownership, locked state, cooldown, daily/hourly limit.
   - Generate OTP mới và reset challenge state.
   - Đây là chỗ cho thấy resend không phải chỉ “gửi lại cùng mã cũ”, mà có thể rotate code mới.

#### `internal/service/account/oauth_service.go`

Đây là file đáng đọc nhất nếu muốn hiểu vì sao OAuth flow của repo chặt chẽ hơn demo thông thường.

1. `BeginOAuth`
   - Normalize provider.
   - Resolve callback URL theo origin.
   - Issue raw nonce + nonce hash + expiry.
   - Sign `oauth_state` chứa provider, nonce hash, next path, frontend origin, redirect URL.
   - Dùng state đã ký để build provider authorization URL.
2. `CompleteOAuthCallback`
   - Parse signed state.
   - Verify provider khớp và `hashToken(cookieNonce) == stateClaims.NonceHash`.
   - Exchange authorization code với provider.
   - `resolveOAuthUser` sẽ link hoặc create user local.
   - Ký short-lived `oauth login ticket`.
   - Build redirect URL về frontend với ticket thay vì JWT hệ thống.
3. `ExchangeOAuthTicket`
   - Parse JWT ticket với purpose-specific claims.
   - Reload user từ DB.
   - Trả `AuthResponse` chuẩn của hệ thống.
4. `resolveOAuthUser`
   - Nếu đã có `oauth_account` theo `provider_user_id`, sync account và lấy user hiện có.
   - Nếu chưa có account, thử match theo email.
   - Nếu email verified từ provider hợp lệ thì link hoặc create local user rồi persist OAuth account.
   - Đây là nơi quyết định conflict handling và auto-link semantics.

#### `internal/handler/user/login_protection.go`

File này nhỏ nhưng nói lên policy chống brute-force của repo.

1. `Check`
   - Đọc trạng thái hiện có theo từng key và trả `retryAfter` dài nhất.
2. `RecordFailure`
   - Tăng `failures`, set `lockedUntil` khi vượt ngưỡng.
3. `RecordSuccess`
   - Xóa toàn bộ state theo các key liên quan.
4. `loginAttemptKeys`
   - Gộp key theo identifier và IP.
   - Điều này giúp chặn vừa theo account vừa theo nguồn request.
5. Điểm cần nhớ
   - Đây là in-memory state với `sync.Mutex`, nên đúng cho single instance hoặc local dev, nhưng chưa phải distributed rate limiter.

#### `internal/repository/profile_tx_manager.go`

1. `RunInTx`
   - Mở transaction PostgreSQL.
   - Dựng `ProfileTxRepositories` với executor là `tx`, không phải `db`.
   - Chạy callback business function.
   - Nếu callback lỗi thì rollback.
   - Nếu thành công thì commit.
2. Ý nghĩa thiết kế
   - Service không phải tự biết chi tiết SQL transaction.
   - Các repo con vẫn tái sử dụng cùng implementation, chỉ thay executor.
   - Đây là pattern thực dụng hơn nhiều so với tạo abstraction transaction quá lớn.

---

## 9. Nên Mở File Nào Trước Nếu Muốn Hiểu Nhanh

1. `api-gateway/cmd/main.go`
2. `pkg/config/config.go`
3. `pkg/middleware/rate_limit.go`
4. `pkg/observability/tracing.go`
5. `services/user-service/cmd/main.go`
6. `services/product-service/cmd/main.go`
7. `services/cart-service/internal/service/cart/cart_mutations.go`
8. `services/order-service/internal/service/order/order_lifecycle.go`
9. `services/payment-service/internal/service/payment/payment_processing.go`
10. `services/notification-service/internal/handler/event_handler.go`

Đó là đường đọc ngắn nhất để thấy:

- request ingress
- shared infrastructure
- user/auth domain
- catalog/stock domain
- cart mutation
- order/payment orchestration
- async notification reliability

---

## 10. Audit-Level Repository Và Query Hot Path

Phần này không lặp lại “service làm gì”, mà chỉ ra chính xác các file đang giữ invariant production của backend. Khi audit một bug dữ liệu, race condition, duplicate side effect hoặc slow query, đây là nơi nên mở trước.

### 10.1. `order-service`: nơi giữ nhiều invariant nhất

#### File: `services/order-service/internal/repository/order_repository.go`

##### Hot path 1: `createOrderTx`

Function này là điểm neo dữ liệu của luồng tạo đơn.

1. Transaction bắt đầu bằng `BeginTx`.
2. Nếu có coupon thì gọi `lockAndConsumeCoupon`.
3. Insert `orders`.
4. Insert toàn bộ `order_items`.
5. Insert `order_events` đầu tiên với type `created`.
6. Insert `outbox_events`.
7. Insert `order_idempotency_keys`.
8. Chỉ commit khi tất cả bước trên thành công.

Invariant thật mà function đang giữ:

- Một order mới không tồn tại mà thiếu `order_items`.
- Event `order created` không được commit nếu `orders` hoặc `order_items` fail.
- Outbox chỉ xuất hiện khi order đã được persist.
- Idempotency record không được tách khỏi order thật.

Điểm quan trọng cần nhớ:

- Coupon bị consume trong cùng transaction DB của order, nên không có trạng thái “coupon đã trừ nhưng order chưa có”.
- Stock không bị giữ trong DB này; reservation inventory đang là invariant xuyên service, không phải invariant nội bộ repo này.
- Nếu process crash trước `Commit`, cả order, outbox và idempotency record cùng rollback.

##### Hot path 2: `lockAndConsumeCoupon`

Đây là block SQL nhỏ nhưng rất quan trọng:

1. `SELECT ... FROM coupons WHERE code = $1 FOR UPDATE`
2. Validate `active`, `expires_at`, `min_order_amount`, `usage_limit`
3. `UPDATE coupons SET used_count = used_count + 1`

Lock pattern:

- Dùng row lock chuẩn PostgreSQL qua `FOR UPDATE`.
- Hai request cùng dùng một coupon giới hạn số lượt sẽ bị serialize theo row lock.
- `used_count` được tăng sau khi validate trên bản ghi đã lock, tránh lost update.

Invariant:

- `usage_limit` được enforce bằng dữ liệu mới nhất trong transaction.
- Hai checkout đồng thời không thể cùng đọc một `used_count` cũ rồi cùng increment sai.

##### Hot path 3: `ListAll` và `ListAllByCursor`

Hai hàm này cho thấy repo đang sống ở trạng thái chuyển tiếp giữa admin list cũ và list có khả năng scale tốt hơn.

`ListAll`:

- Build filter động trên `user_id`, `status`, `from`, `to`.
- Chạy `SELECT COUNT(*)`.
- Chạy query `ORDER BY created_at DESC LIMIT/OFFSET`.

Ý nghĩa audit:

- Đây là đường admin/backoffice thân thiện với UI page number.
- Chi phí tăng theo độ sâu `OFFSET`.
- `COUNT(*)` là cost cố định thêm vào mọi request.

`ListAllByCursor`:

- Decode cursor bằng `decodeOrderListCursor`.
- Cursor là `base64(timestamp|orderID)`.
- Query dùng predicate `(created_at < cursorTime OR (created_at = cursorTime AND id < cursorID))`.
- `ORDER BY created_at DESC, id DESC`.
- Fetch `limit + 1` để xác định `hasNext`.

Cursor pattern:

- `created_at` một mình không đủ ổn định khi nhiều order cùng timestamp.
- Repo dùng thêm `id` làm tiebreaker để giữ ordering deterministic.
- Cursor không chứa filter; caller phải giữ nguyên filter giữa các trang.

Điểm nên nhớ khi audit bug pagination:

- Nếu user đổi filter mà vẫn reuse cursor cũ, behavior có thể lệch.
- Nếu index không phủ `created_at DESC, id DESC`, pagination sẽ đúng logic nhưng có thể chậm.

##### Hot path 4: `ExpirePendingReservation`

Đây là nơi order tự hủy vì quá hạn giữ chỗ.

Query chính:

- `UPDATE orders ... WHERE id = $2 AND status = 'pending' AND reservation_allocated_at IS NULL AND reservation_expires_at <= NOW()`

Invariant:

- Chỉ order còn `pending` mới bị expire.
- Nếu stock đã được allocate (`reservation_allocated_at IS NOT NULL`), worker expire không được phép can thiệp.
- Update status, clear reservation fields, insert event, insert outbox trong cùng transaction.

Ý nghĩa production:

- Đây là compare-and-set bằng SQL condition, không cần `SELECT ... FOR UPDATE` riêng.
- Nếu một flow khác đã đổi status trước, `rowsAffected = 0` và function commit no-op.

##### Hot path 5: `ClaimPendingReturnRefunds`

Đây là worker lease pattern rõ nhất repo.

Pattern SQL:

1. `WITH candidates AS (...)`
2. Filter:
   - `status = 'refund_pending'`
   - chưa có `refund_payment_id`
   - `refund_next_retry_at` đã đến hoặc null
   - `refund_processing_started_at` null hoặc đã quá lease cũ
3. `ORDER BY COALESCE(refund_next_retry_at, created_at), created_at`
4. `LIMIT $1`
5. `FOR UPDATE SKIP LOCKED`
6. `UPDATE ... SET refund_attempt_count = refund_attempt_count + 1, refund_processing_started_at = NOW()`

Lock pattern:

- Nhiều worker có thể poll cùng lúc.
- `FOR UPDATE SKIP LOCKED` bảo đảm mỗi row chỉ bị một worker claim trong một thời điểm.
- Lease timeout cho phép reclaim row khi worker cũ chết giữa chừng.

Retry pattern:

- `MarkReturnRefundAttemptFailed` ghi `refund_last_error`, `refund_next_retry_at`, clear `refund_processing_started_at`.
- `CompleteReturnRefund` clear retry fields và set `refund_payment_id`.
- Retry state được giữ trong cùng table domain `returns`, không cần scheduler state ngoài DB.

##### Hot path 6: `ClaimPendingOutbox`, `MarkOutboxPublished`, `MarkOutboxFailed`

Đây là outbox relay chuẩn của repo.

Pattern:

- Claim dùng `FOR UPDATE SKIP LOCKED`.
- Khi claim, `attempts` tăng ngay và `available_at` được đẩy về tương lai như một lease.
- Publisher thành công thì set `published_at`.
- Publisher fail thì ghi `last_error` và `available_at` mới.

Ý nghĩa:

- Crash sau khi claim nhưng trước publish sẽ không mất message; row sẽ quay lại khi lease hết hạn.
- Crash sau publish nhưng trước `MarkOutboxPublished` vẫn có nguy cơ publish lặp, nên downstream phải idempotent.
- Vì vậy notification và payment webhook đều có inbox/dedupe để đỡ re-delivery.

##### Hot path 7: `ApplyInboxStatusTransition`

Đây là replay-safe consumer pattern của `order-service`.

Flow:

1. Insert `inbox_messages` bằng `ON CONFLICT DO NOTHING`.
2. Nếu duplicate thì trả `Duplicate: true`.
3. `SELECT status FROM orders WHERE id = $1 FOR UPDATE`.
4. Nếu current status đã bằng `nextStatus`, commit no-op.
5. Nếu `expectedCurrent` không khớp, commit no-op.
6. Nếu hợp lệ thì update order, append `order_events`, commit.

Invariant:

- Cùng một message không được apply hai lần.
- Out-of-order event bị chặn bởi `expectedCurrent`.
- State transition luôn đi kèm event log.

Đây là chỗ cần mở đầu tiên khi debug:

- payment webhook đến lặp
- event đến muộn
- order bị stuck ở status cũ

### 10.2. `payment-service`: idempotency và webhook safety

#### File: `services/payment-service/internal/repository/payment/payment_repository.go`

##### Hot path 1: `CreateWithIdempotency`

Function này commit cùng lúc ba thứ:

1. `payments`
2. `outbox_events`
3. `payment_idempotency_keys`

Invariant:

- Một payment mới không được tạo mà thiếu outbox.
- Một idempotency key không được trỏ tới payment chưa tồn tại.
- Nếu transaction fail, client retry có thể chạy lại an toàn.

##### Hot path 2: `ApplyWebhookResult`

Đây là function quan trọng nhất của webhook path.

Pattern:

1. Begin transaction.
2. Insert `inbox_messages` với unique key `(consumer, message_id)`.
3. Nếu duplicate inbox, trả ngay `true`.
4. `UPDATE payments ... WHERE id = $14 AND status = 'pending'`.
5. Nếu `rowsAffected = 0`, commit no-op.
6. Nếu update được thì insert outbox và commit.

Điểm rất đáng học:

- Không cần lock riêng trước update.
- Status gate `WHERE status = 'pending'` biến update thành một compare-and-set.
- Webhook replay sau khi payment đã `success` hoặc `failed` sẽ không mutate lại row.

Retry semantics:

- Webhook provider có thể retry vô hạn.
- Repo chấp nhận điều đó bằng inbox dedupe + guarded update.
- Sau khi publish event, downstream vẫn phải chịu được duplicate.

##### Hot path 3: `ClaimPendingOutbox`

Pattern giống `order-service`:

- `published_at IS NULL`
- `available_at <= NOW()`
- `FOR UPDATE SKIP LOCKED`
- tăng `attempts`
- lease bằng `available_at`

Điểm audit:

- Nếu payment publish lag, mở đây trước chứ không nhìn handler.
- Nếu `attempts` tăng mà `published_at` không được set, bug ở relay/publisher hoặc broker.

##### Hot path 4: read model helpers

Các hàm `GetByOrderID`, `GetByGatewayOrderID`, `ListByOrderIDs`, `ListByUserID` đều có một điểm chung:

- Chúng không join sang order table.
- Repo giữ read model của payment độc lập.
- `ListByOrderIDs` dùng `ANY($1::varchar[])` để batch enrich order list.

Ý nghĩa:

- Read path admin/user không phải N lần HTTP call sang `payment-service`.
- Enrichment làm ở service layer nhưng batch SQL đã được chuẩn bị sẵn trong repo.

### 10.3. `product-service`: catalog cursor, stock CAS và review summary delta

#### File: `services/product-service/internal/repository/product/product_repository.go`

##### Hot path 1: `List`

Đây là public catalog query builder quan trọng nhất.

Query pattern:

- Base query `FROM products WHERE 1=1`.
- Filter động cho `category`, `brand`, `tag`, `status`, `search`, `price`, `size`, `color`.
- `tag` dùng `tags @> $n::jsonb`.
- `size` và `color` dùng `EXISTS` với `jsonb_array_elements(variants)`.
- Sort được normalize bởi `normalizeListSort`.

Cursor pattern:

- `decodeProductListCursor` đọc payload JSON từ base64.
- Cursor chứa `sort`, `id`, `created_at`, và thêm field tùy sort như `price`, `stock`, `merchandising_rank`.
- Nếu `cursor.Sort` không khớp sort hiện tại, repo reject bằng `ErrInvalidCursor`.

Điểm mạnh:

- Cursor gắn với sort order thật, tránh bug “dùng cursor old sort cho sort mới”.
- `appendCursorClause` dùng predicate khác nhau theo từng sort.
- `limit + 1` vẫn được áp dụng chuẩn.

Ý nghĩa audit:

- Nếu catalog bị duplicate/missing item giữa trang 1 và 2, mở `appendCursorClause`.
- Nếu catalog chậm khi lọc `size/color`, nhìn vào JSONB lateral/existence path và index strategy.

##### Hot path 2: `UpdateStock` và `RestoreStock`

`UpdateStock` là compare-and-set của inventory local:

- `UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1`
- Nếu `rowsAffected = 0` trả `ErrInsufficientStock`

Điều này quan trọng vì:

- Không cần read-before-write để check stock.
- Hai request giảm stock đồng thời vẫn an toàn ở cấp row.
- Invariant “stock không âm” nằm ngay trong SQL condition.

`RestoreStock`:

- tăng stock bằng atomic update
- check `rowsAffected` để phát hiện product không tồn tại

##### Hot path 3: `ListByIDs`

Function này không giữ order ở phía SQL mà làm theo hai bước:

1. Query `WHERE id = ANY($1)`
2. Build `map[id]*Product`
3. Reconstruct slice theo thứ tự input ban đầu

Ý nghĩa:

- Caller không bị mất ordering semantic của request.
- Batch read cho cart/order enrichment tránh N query.

##### Hot path 4: `SearchAssist`

File `product_search_assist_repository.go` là nơi query analytics/search assist được giữ bằng SQL thay vì engine ngoài.

Pattern:

- `countSearchAssistResults`
- `listSearchSuggestions`
- `listSearchFacets`
- `queryVariantFacet` dùng `JOIN LATERAL jsonb_array_elements`

Điểm đáng chú ý:

- Search assist đang compute nhiều facet trực tiếp từ PostgreSQL.
- Đây là pattern tốt khi muốn graceful degradation không phụ thuộc Elasticsearch.
- Giá phải trả là query có thể nặng khi product table lớn và variant JSON phình to.

#### File: `services/product-service/internal/repository/product/product_review_repository.go`

##### Hot path 5: review write path

`CreateReview`:

- insert trực tiếp
- map `pq.Error{Code:23505}` sang `ErrProductReviewAlreadyExists`

`GetReviewByProductAndUserForUpdate`:

- thêm `FOR UPDATE`
- dùng khi service cần mutate summary trong transaction an toàn

`DeleteReviewByProductAndUser`:

- `DELETE ... RETURNING`
- lấy lại bản ghi cũ để tính delta summary mà không cần query lại

`ApplyReviewSummaryDelta`:

- nếu delta tăng review count thì `INSERT ... ON CONFLICT DO UPDATE`
- nếu delta âm thì `UPDATE` summary row hiện có

Invariant:

- Summary aggregate được cập nhật bằng delta, không phải recount toàn bảng mỗi lần.
- Khi write path nằm trong transaction manager, review row và summary row cùng commit.

#### File: `services/product-service/internal/repository/product/product_review_tx_manager.go`

`RunInTx` cho review là mẫu transaction manager rất sạch:

- service truyền callback business logic
- repo được dựng lại trên executor là `tx`
- commit/rollback tập trung ở một chỗ

#### File: `services/product-service/internal/repository/product/storefront_repository.go`

Storefront read path chọn batching rõ ràng:

- `ListEditorialSectionsByCategorySlugs`
- `ListFeaturedProductsByCategorySlugs`

Query pattern:

- normalize slug trước
- `WHERE category_slug = ANY($1)`
- hydrate map `slug -> items`

Ý nghĩa:

- Homepage/category page không bị N query theo từng section/category.
- Đây là read optimization thực dụng hơn nhiều so với thêm cache phức tạp quá sớm.

### 10.4. `user-service`: uniqueness, bulk upsert và transaction ghép profile

#### File: `services/user-service/internal/repository/userrepo/user_repository.go`

##### Hot path 1: `Create` và `Update`

Hai hàm này giữ invariant uniqueness ở tầng DB, không tin vào pre-check ở service.

Pattern:

- Insert/update raw columns.
- Nếu DB trả `23505`, helper `isUniqueViolation` map lỗi sang:
  - `ErrUserEmailAlreadyExists`
  - `ErrUserPhoneAlreadyExists`

Ý nghĩa:

- Pre-check ở service chỉ để UX tốt hơn.
- Source of truth cho uniqueness vẫn là unique index và SQL error.
- Đây là pattern đúng cho race condition giữa hai request đăng ký song song.

##### Hot path 2: scan helper family

`scanUser` dùng `sql.NullTime` và `COALESCE(..., '')` cho các field optional.

Audit significance:

- Repo chủ động chuẩn hóa boundary model thay vì đẩy null handling lên service.
- Khi đọc bug “field nil/string rỗng”, mở scan helper trước chứ không nhìn handler.

#### File: `services/user-service/internal/repository/profile_tx_manager.go`

`RunInTx` ghép nhiều repo con:

- `Users`
- `Addresses`
- `PhoneVerifications`

Ý nghĩa:

- Profile update có thể mutate user row, default address và phone verification consume trong cùng transaction.
- Service không cần tự quản lý `*sql.Tx`.
- Đây là nơi giữ invariant “profile commit xong mới consume verified challenge”.

#### File: `services/user-service/internal/repository/addressrepo/repository.go`

##### Hot path 3: default address

Repo có:

- `ClearDefault(userID)`
- `Create`
- `Update`
- `CountByUserID`

Điều quan trọng:

- `ClearDefault` chỉ là một update SQL, chưa tự khóa toàn bộ invariant “mỗi user chỉ có một default”.
- Invariant thật chỉ an toàn khi caller bao bọc `ClearDefault` và `Create/Update` trong cùng transaction.

Đây là điểm audit cần nhớ:

- Nếu endpoint nào thao tác default address mà không đi qua transaction manager, invariant có thể lệch dưới concurrent requests.

#### File: `services/user-service/internal/repository/notificationpreferencerepo/repository.go`

`UpsertMany` dùng pattern bulk write:

- nhận mảng topic + enabled
- `unnest($2::text[], $3::boolean[])`
- `ON CONFLICT (user_id, topic) DO UPDATE`

Ý nghĩa:

- Viết nhiều preference trong một round-trip.
- Dễ idempotent hơn loop từng row.

#### File: `services/user-service/internal/repository/wishlistrepo/repository.go`

Hot path chính:

- `ListByUserID`
- `ListUserIDs`
- `Upsert`
- `UpsertMany`

Pattern:

- `UpsertMany` cũng dùng `unnest(...) + ON CONFLICT`
- `ListUserIDs` group theo `user_id` rồi `ORDER BY MAX(updated_at) DESC`

Điểm đáng chú ý:

- Dispatch source cho wishlist alert hiện dựa trên sweep user có wishlist thay đổi gần đây.
- Đây là pattern polling hợp lý, nhưng query `GROUP BY + MAX(updated_at)` sẽ cần index tốt khi bảng wishlist lớn.

#### File: `services/user-service/internal/repository/authrepo/email_verification_repository.go`

Hot path OTP:

- `GetLatestActiveByUserID` lấy challenge mới nhất có status `pending` hoặc `verified`
- `Update` mutate attempt count, resend window, verified/consumed state
- `DeleteExpired` cleanup opportunistic

Invariant:

- Challenge lifecycle được materialize thành row state machine, không giữ state tạm trong memory.
- Rate limit semantic ở service, còn status persistence ở repo.

#### File: `services/user-service/internal/repository/oauthrepo/repository.go`

Pattern đáng học:

- `Create` map duplicate provider identity sang `ErrOAuthAccountAlreadyExists`
- `Update` check `rowsAffected`
- `GetByProviderUserID` và `GetByUserIDAndProvider` tách rõ 2 loại lookup

Ý nghĩa:

- OAuth link semantics được bảo vệ bởi unique constraint thật trong DB.
- Service có thể race-safe khi nhiều callback/provider event đến gần nhau.

### 10.5. `notification-service`: dedupe và retry dựa trên Redis/RabbitMQ

#### File: `services/notification-service/internal/inbox/redis_store.go`

Đây là inbox khác với order/payment:

- Không dùng Postgres table.
- Dùng Redis Lua script để điều phối consumer nhiều replica.

`Claim`:

1. Check `processed` key.
2. Nếu chưa processed thì `SET processing NX PX`.
3. Trả về `Claimed`, `AlreadyProcessed` hoặc `AlreadyClaimed`.

`MarkProcessed`:

- set `processed` key có TTL
- xóa `processing` key

`Release`:

- xóa `processing` key khi fail để worker khác có thể claim lại

Ý nghĩa:

- Đây là lease-based dedupe ngoài DB.
- Rẻ hơn inbox table khi traffic event lớn.
- Đổi lại, Redis là dependency bắt buộc cho reliability path này.

#### File: `services/notification-service/internal/inbox/history_store.go`

History store dùng 3 lớp key:

- `prefix:user:{userID}` là sorted set cho feed người dùng
- `prefix:audit` là sorted set cho audit feed tổng
- `prefix:item:{id}` là payload JSON

Pattern:

- `Append` dùng pipeline để ghi index + payload + TTL
- `ListByUser` và `ListRecent` load ID trước, rồi batch `GET` payload
- `MarkAllRead` đọc toàn bộ item user, rewrite payload nào chưa có `ReadAt`

Audit significance:

- Đây là read model eventual consistency, không phải source of truth chính.
- `MarkAllRead` là rewrite payload hàng loạt; đơn giản nhưng chi phí tăng theo số item.

#### File: `services/notification-service/internal/messaging/retry_publisher.go`

Retry queue pattern:

- clone headers
- tăng `HeaderRetryCount`
- giữ `HeaderFirstSeen`
- set `HeaderNextRetryAt`
- publish sang retry queue với `Expiration = delay`

`delayForRetry`:

- exponential backoff
- cap ở `maxDelay`

Điểm cần nhớ:

- Retry state nằm trong AMQP header, không cần DB.
- Nếu broker restart và queue chính sách thay đổi, logic retry có thể bị ảnh hưởng mạnh hơn outbox DB-based.

### 10.6. `cart-service`: Redis JSON blob, TTL và lost update trade-off

#### File: `services/cart-service/internal/repository/cart/cart_repository.go`

Hot path cực đơn giản nhưng phải hiểu đúng trade-off:

`Get`:

- `GET cart:{userID}`
- nếu `redis.Nil` thì trả cart rỗng
- unmarshal JSON
- refresh TTL bằng `Expire`

`Save`:

- marshal cả cart thành JSON
- `SET` nguyên blob với TTL 7 ngày

`Delete`:

- `DEL cart:{userID}`

Invariant thật:

- Cart là transient state, không cần ACID mạnh như order/payment.
- TTL refresh khi đọc/ghi giúp cart sống theo mức độ hoạt động.

Rủi ro thật:

- Concurrent write dễ last-write-wins vì không có versioning/CAS.
- Whole-document rewrite khiến mutation nhỏ vẫn ghi lại toàn blob.

### 10.7. Những pattern nên xem như chuẩn audit của repo

Khi mở source, có thể gom các hot path backend này vào 7 pattern cốt lõi:

1. Transaction bundle:
   - `createOrderTx`
   - `CreateWithIdempotency`
   - `ProfileTxManager.RunInTx`
2. SQL compare-and-set:
   - `UpdateStock`
   - `ExpirePendingReservation`
   - `ApplyWebhookResult`
3. Row lock:
   - `lockAndConsumeCoupon`
   - `GetReviewByProductAndUserForUpdate`
   - `SELECT status ... FOR UPDATE` trong `ApplyInboxStatusTransition`
4. Cursor pagination:
   - `ListAllByCursor`
   - `List`
   - `encode/decode*Cursor`
5. Lease claim:
   - `ClaimPendingOutbox`
   - `ClaimPendingReturnRefunds`
   - `redisStore.Claim`
6. Bulk upsert:
   - `UpsertMany` ở wishlist/preferences
   - `ApplyReviewSummaryDelta`
7. Retry-safe async:
   - `MarkOutboxFailed`
   - `RetryPublisher.Publish`
   - inbox dedupe ở order/payment/notification

Nếu muốn audit backend này ở mức production thật, thay vì đọc từng service từ trên xuống, hãy bắt đầu từ đúng các function trên. Chúng là nơi hệ thống quyết định “một side effect có được commit không”, “một message có được xử lý lặp không”, và “một query có còn đứng vững khi dữ liệu lớn lên không”.
