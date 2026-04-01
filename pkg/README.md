# pkg

Thư mục `pkg/` là lớp hạ tầng dùng chung cho toàn bộ platform. Đây không phải nơi chứa business logic của từng domain như user, product hay order; thay vào đó nó cung cấp các khối cross-cutting để mọi service có thể khởi động, giao tiếp, quan sát, validate và trả response theo cách nhất quán.

## 1. Vai trò tổng thể của `pkg/`

Nếu xem mỗi service trong `services/*-service/` là một ứng dụng độc lập, thì `pkg/` là “toolbox” dùng chung để tránh lặp lại cùng một loại mã ở mọi service:

- load cấu hình runtime
- mở kết nối PostgreSQL và chạy migration
- tạo logger chuẩn
- ghép middleware HTTP
- propagate request id / trace id / span id
- publish metric Prometheus
- chuẩn hoá JSON response
- chuẩn hoá input validation

Điểm quan trọng: `pkg/` **không quyết định nghiệp vụ**. Nó chỉ cung cấp cơ chế. Business rule vẫn phải nằm ở `handler -> service -> repository` của từng service.

---

## 2. Bản đồ thư mục

| Package | Mục đích chính | Khi nào dùng |
|---|---|---|
| `config/` | Load config từ default + env + file | Mọi service lúc startup |
| `database/` | Kết nối PostgreSQL, chạy migration | Service có Postgres |
| `logger/` | Tạo `zap.Logger` có field `service` | Mọi service |
| `middleware/` | Auth, CORS, request log, rate limit | HTTP service dùng Echo |
| `observability/` | Request ID, tracing, gRPC interceptor, business metrics | HTTP/gRPC/internal client |
| `response/` | JSON envelope chuẩn cho HTTP | Handler HTTP |
| `validation/` | Adapter giữa Echo và `go-playground/validator` | Handler HTTP bind/validate |

Ngoài ra:

- `.cache/` không phải source nghiệp vụ; đây là cache phục vụ tool/module trong môi trường local.
- `go.mod` và `go.sum` cho thấy `pkg/` được tách thành một Go module độc lập để các service import trực tiếp.

---

## 3. Các dependency cốt lõi trong `pkg/go.mod`

Nhìn vào `pkg/go.mod`, có thể thấy định hướng của thư viện dùng chung này khá rõ:

- `github.com/spf13/viper`: load config linh hoạt
- `go.uber.org/zap`: structured logging
- `github.com/labstack/echo/v4`: HTTP stack và middleware interface
- `github.com/go-playground/validator/v10`: declarative validation
- `google.golang.org/grpc`: gRPC transport
- `go.opentelemetry.io/otel`: tracing và propagation
- `github.com/prometheus/client_golang`: metrics
- `github.com/redis/go-redis/v9`: Redis-backed rate limit
- `github.com/golang-migrate/migrate/v4`: database migration
- `github.com/lib/pq`: PostgreSQL driver

Ý nghĩa kiến trúc: repo đang ưu tiên **Go stdlib + Echo + Zap + explicit wiring**, không dùng framework “all-in-one”. Điều này giúp code dễ debug hơn, nhưng đòi hỏi mỗi service phải lắp ghép đúng thứ tự.

---

## 4. Luồng khởi động điển hình của một service

Một service HTTP/gRPC điển hình trong repo thường khởi động theo thứ tự sau:

1. Gọi `config.Load(...)` để nhận toàn bộ runtime config.
2. Gọi `logger.New(...)` để tạo logger có field `service` mặc định.
3. Dùng `database.NewPostgresDB(...)` nếu service cần PostgreSQL.
4. Dùng `observability.SetupTracing(...)` nếu tracing được bật.
5. Tạo Echo server, gắn validator và middleware từ `pkg/middleware` + `pkg/observability`.
6. Đăng ký handler HTTP.
7. Tạo gRPC server với interceptor từ `pkg/observability` nếu service có gRPC.

`pkg/` không có hàm “bootstrap everything”, vì repo này chọn explicit wiring: service main tự ghép từng dependency để người đọc biết chính xác runtime flow diễn ra thế nào.

---

## 5. Luồng request HTTP dùng chung

Một request HTTP đi qua các khối trong `pkg/` thường theo logic sau:

1. **Request ID**: `observability.RequestIDMiddleware()` gắn hoặc tái sử dụng `X-Request-ID`.
2. **Tracing**: `observability.EchoMiddleware(...)` extract trace context và mở server span.
3. **Rate limit**: `middleware.NewRedisBackedRateLimiter(...)` hoặc fallback in-memory.
4. **Auth**: route cần bảo vệ sẽ dùng `middleware.JWTAuth(...)` và có thể thêm `middleware.RequireRole(...)`.
5. **Validation**: handler `Bind` request, sau đó gọi `c.Validate(...)`, được phục vụ bởi `validation.CustomValidator`.
6. **Response**: handler trả JSON thống nhất qua `response.Success(...)`, `response.SuccessWithMeta(...)`, `response.Error(...)`.
7. **Request log**: `middleware.RequestLogger(...)` log method/path/status/latency/request_id/trace_id.

### Điều cần nhớ

- `pkg/` chỉ cung cấp middleware; **service phải mount đúng thứ tự**.
- Nếu quên gắn `RequestIDMiddleware`, logger vẫn chạy nhưng `request_id` chỉ có nếu client đã gửi sẵn header.
- `RequestLogger` log **sau khi** `next(c)` chạy xong để lấy final status và latency.

---

## 6. Luồng gRPC dùng chung

Khi service A gọi service B qua gRPC:

1. Service A tạo client từ code generated trong `proto/*_grpc.pb.go`.
2. `observability.GRPCUnaryClientInterceptor(...)` inject trace context + `X-Request-ID` vào metadata.
3. Service B nhận request qua `observability.GRPCUnaryServerInterceptor(...)`.
4. Server interceptor extract trace/request ID, mở span mới, rồi chuyển vào gRPC handler thực tế.
5. gRPC handler map `pb.Request` -> DTO/domain input.
6. Service layer xử lý nghiệp vụ.
7. gRPC handler map domain output -> `pb.Response`.
8. Interceptor record final gRPC status code vào span.

Điểm đáng chú ý: `pkg/observability` đang propagate **trace** và **request id**, nhưng **không tự propagate auth identity kiểu `userID`**. Nếu một gRPC handler muốn biết caller là ai, service đó phải tự thiết kế thêm cơ chế auth metadata riêng.

---

## 7. Phân tích chi tiết từng package

### 7.1. `config/`

File chính: `config/config.go`

#### Nhiệm vụ

Package này gom toàn bộ cấu hình runtime vào một struct cây duy nhất là `Config`.

#### Các struct quan trọng

- `Config`: root object, chứa mọi nhóm cấu hình
- `ServerConfig`: host/port/timeout cho HTTP
- `DatabaseConfig`: DSN PostgreSQL
- `RedisConfig`: địa chỉ Redis
- `RabbitMQConfig`: AMQP URL
- `JWTConfig`: secret + expiration
- `GRPCConfig`: port gRPC
- `ServicesConfig`: endpoint của các service khác
- `TracingConfig`: bật/tắt tracing, endpoint OTLP, sample ratio
- `SearchConfig`, `ObjectStorageConfig`, `TelegramConfig`, `OAuthConfig`, `SMTPConfig`, `FrontendConfig`, `PaymentGatewayConfig`, `BootstrapConfig`

#### Function/method nổi bật

- `Load(serviceName string) (*Config, error)`
  - **Input**: tên service, ví dụ `"user-service"`
  - **Output**: con trỏ tới `Config`
  - **Làm gì**:
    - set default cho local/dev
    - đọc env
    - đọc file `config.yaml` hoặc file tại `CONFIG_PATH`
    - unmarshal vào `Config`
  - **Ảnh hưởng**: gần như mọi service đều phụ thuộc vào hàm này lúc startup

- `DatabaseConfig.DSN()`
  - build DSN cho `database/sql`
  - không nên log raw DSN vì có password

- `RedisConfig.Addr()` / `RabbitMQConfig.URL()` / `SMTPConfig.Addr()`
  - helper nhỏ nhưng giúp giảm duplication trong service main

#### Điểm cần cẩn trọng

1. `serviceName` hiện **chỉ được dùng để set default database name** (`database.dbname = serviceName`). Nó **không thực sự tạo env prefix riêng cho từng service**.
2. Comment cũ trong file từng nói env var có prefix theo service, nhưng implementation hiện tại không `SetEnvPrefix(...)`.
3. Vì vậy, env lookup hiện giống kiểu `SERVER_PORT`, `DATABASE_HOST`, không phải tự động là `USER_SERVICE_SERVER_PORT`.
4. `Load(...)` chấp nhận config file không tồn tại; đây là fail-soft để local/dev chạy bằng env + default.
5. Default như `jwt.secret = change-me-in-production` hay `telegram.secret_pepper = change-me` là tiện cho local, nhưng production phải override rõ ràng.

#### Khi muốn mở rộng

Nếu thêm một config mới:

1. thêm field vào struct phù hợp trong `config.Config`
2. thêm `mapstructure` tag
3. thêm default ở `Load(...)`
4. cập nhật file cấu hình trong `deployments/docker/config/`
5. cập nhật `.env.example` nếu config đó cần override qua env

---

### 7.2. `database/`

File chính: `database/postgres.go`

#### Nhiệm vụ

Package này giải quyết hai việc rất cụ thể:

1. mở `*sql.DB` dùng PostgreSQL driver `pq`
2. chạy migration embedded bằng `golang-migrate`

#### Function nổi bật

- `NewPostgresDB(cfg config.DatabaseConfig) (*sql.DB, error)`
  - mở pool bằng `sql.Open("postgres", cfg.DSN())`
  - set pool size:
    - `MaxOpenConns = 25`
    - `MaxIdleConns = 5`
    - `ConnMaxLifetime = 5m`
  - `Ping()` để fail fast nếu DB không reachable

- `RunPostgresMigrations(db *sql.DB, migrationFS fs.FS) error`
  - dùng `iofs.New(...)` để đọc migration từ embedded filesystem
  - tạo driver PostgreSQL cho migrate
  - chạy `migrator.Up()`
  - bỏ qua `migrate.ErrNoChange`

#### Vì sao package này tồn tại

Repo chủ động dùng `database/sql` thay vì ORM. Mục tiêu là:

- query rõ ràng
- không có magic query
- dễ profile
- transaction dễ kiểm soát hơn

#### Điểm dễ gây lỗi

- `sql.Open(...)` không thật sự mở kết nối; chỉ đến `Ping()` mới xác nhận DB sống.
- Nếu sau này thay pool size mà không cân nhắc tải thật, rất dễ đụng `max_connections` của PostgreSQL.
- `RunPostgresMigrations(...)` giả định `migrationFS` đã trỏ đúng root migration directory. Nếu embed sai root, migrate sẽ fail ngay lúc boot.

#### Khi muốn mở rộng

- Nếu cần transaction helper dùng chung, đây là package hợp lý để thêm abstraction nhỏ, nhưng tránh tạo framework transaction quá nặng.
- Không nên trộn query nghiệp vụ vào `pkg/database`; query vẫn nên ở repository của từng service.

---

### 7.3. `logger/`

File chính: `logger/logger.go`

#### Nhiệm vụ

Tạo `*zap.Logger` nhất quán cho mọi binary.

#### Function nổi bật

- `New(serviceName string) *zap.Logger`
  - gắn field mặc định `service=<serviceName>`
  - chọn log level theo env `LOG_LEVEL`
  - chọn encoder theo `APP_ENV`
    - production: JSON encoder
    - non-production: console encoder có màu
  - bật `AddCaller()` và `AddStacktrace(ErrorLevel)`

#### Vì sao cần package riêng

Nếu mỗi service tự dựng logger, format và field rất dễ lệch nhau. `pkg/logger` ép tất cả service cùng một baseline:

- chung key `service`
- chung cách encode time
- chung log level policy

#### Điểm cần cẩn trọng

- `LOG_LEVEL=debug` ở production sẽ làm log volume tăng mạnh.
- `APP_ENV` là env riêng cho logger, không đi qua `config.Load(...)`, nên đây là dependency ẩn từ process env.
- Logger không tự scrub secret; người viết log vẫn phải tránh log token/password/DSN.

---

### 7.4. `middleware/`

Thư mục này gom các Echo middleware dùng chung.

#### `auth.go`

##### Thành phần chính

- `JWTClaims`
  - chứa `UserID`, `Email`, `Role` + `jwt.RegisteredClaims`
  - giúp handler downstream không phải gọi ngược User Service chỉ để biết caller là ai

- `JWTAuth(secret string)`
  - đọc header `Authorization: Bearer <token>`
  - parse JWT bằng `jwt.ParseWithClaims`
  - chỉ chấp nhận HMAC signing method
  - set claims vào `echo.Context` key `"user"`

- `GetUserClaims(c echo.Context) *JWTClaims`
  - helper tránh cast lặp lại trong handler

- `RequireRole(roles ...string)`
  - authorize theo role trong claims

##### Input/output và ảnh hưởng

- Input của middleware là HTTP request có header auth.
- Output là request đã được enrich bằng claims, hoặc 401/403 JSON.
- Mọi handler admin/staff/user route đều phụ thuộc gián tiếp vào package này.

##### Điểm cần cẩn trọng

1. Middleware hiện chỉ chấp nhận HMAC; nếu sau này chuyển sang RSA/EdDSA phải sửa code.
2. Response lỗi ở đây đang trả raw `map[string]string`, không dùng `pkg/response`, nên format lỗi auth không hoàn toàn đồng nhất với phần còn lại của HTTP API.
3. Claims được lưu dưới key string `"user"`, dễ đụng tên nếu service tự set cùng key.

#### `cors.go`

- `FrontendCORS()` trả Echo CORS middleware với allowlist khá chặt cho local runtime.
- Có comment giải thích rõ: allowlist hiện bao phủ `frontend` qua Docker/Vite, `client` Next.js qua host `3000`, và nginx edge local.

**Cẩn trọng**: khi promote thêm frontend origin mới, phải cập nhật allowlist; nếu mở quá rộng (`*`) sẽ giảm an toàn.

#### `logging.go`

- `RequestLogger(log *zap.Logger)`
  - đo latency
  - lấy status cuối cùng
  - log method/path/route/client_ip/user_agent/response_bytes
  - tự thêm `request_id`, `user_id`, `trace_id`, `span_id` nếu có
  - phân level:
    - `>=500`: `Error`
    - `>=400`: `Warn`
    - còn lại: `Info`

**Điểm mạnh**: logger này không chỉ log HTTP, mà còn tự nối context observability vào log entry.

**Điểm dễ lỗi**: nếu middleware auth/request-id/tracing không được mount trước đó, nhiều field quan trọng sẽ bị thiếu.

#### `rate_limit.go`

##### Thành phần chính

- `NewRateLimiter(...)`
  - in-memory rate limit per identifier
  - phù hợp local dev hoặc single-instance

- `NewRedisBackedRateLimiter(...)`
  - dùng Redis làm store chung
  - fallback sang in-memory nếu Redis startup fail hoặc request-time fail

- `redisRateLimiter.Allow(...)`
  - chạy Lua token bucket script ngay trong Redis để limit atomically

##### Identifier dùng để limit

`extractRateLimitIdentifier(...)` ưu tiên:

1. `claims.UserID` nếu request đã auth
2. fallback sang `c.RealIP()` nếu request anonymous

##### Vì sao cần cả Redis lẫn in-memory

- in-memory: đơn giản, không cần external dependency
- Redis: chia sẻ rate limit giữa nhiều replica/process

##### Điểm cần cẩn trọng

1. Redis fail sẽ fallback về in-memory, tức là service vẫn sống nhưng **limit trở thành per-process**, không còn global consistency.
2. `Update` logic của Lua script giữ token và `last_refill` trong hash; nếu thay đổi tham số `rate/burst`, key cũ vẫn còn hiệu lực cho đến khi TTL hết.
3. `ErrorHandler` hiện trả `403`, còn deny thực sự trả `429`; khi đọc log/metric cần phân biệt hai case này.
4. Redis client được tạo trong middleware constructor và sống đến hết process; nếu sau này cần lifecycle quản trị chặt hơn hoặc test cleanup sạch hơn, nên inject shared client từ service main.

---

### 7.5. `observability/`

Đây là package quan trọng nhất trong `pkg/`, vì nó nối request ID, tracing và business metric thành một luồng chung.

#### `context.go`

##### Mục đích

Tạo và propagate `X-Request-ID` xuyên qua HTTP request, context và log.

##### Thành phần nổi bật

- `HeaderRequestID = "X-Request-ID"`
- `RequestIDMiddleware()`
  - lấy request id từ header nếu có
  - nếu không có thì generate bằng `uuid.NewString()`
  - set vào request context + request header + response header
- `WithRequestID(...)`, `RequestIDFromContext(...)`, `RequestIDFromRequest(...)`
- `ContextFields(ctx)`
  - rút `request_id`, `trace_id`, `span_id` thành `[]zap.Field`
- `LoggerWithContext(...)`
  - tạo logger con đã gắn field context

##### Khi nào nên bắt đầu đọc từ đây

Nếu bạn muốn hiểu vì sao log ở service có `request_id`, `trace_id`, `span_id`, đây là file nên đọc đầu tiên.

#### `tracing.go`

##### Mục đích

Thiết lập OpenTelemetry cho HTTP và outbound HTTP client.

##### Function nổi bật

- `SetupTracing(...)`
  - set global propagator
  - nếu `cfg.Enabled = false` thì trả shutdown no-op
  - nếu bật thì tạo OTLP HTTP exporter, tracer provider, sampler, resource `service.name`

- `EchoMiddleware(serviceName string)`
  - extract trace context từ HTTP header
  - mở server span theo mẫu `METHOD route`
  - attach method/route/target/client_ip/http.status_code/request.id

- `WrapHTTPTransport(base http.RoundTripper)`
  - bọc outbound HTTP transport để tự inject trace context + `X-Request-ID`

- `newTraceExporter(...)`
  - parse OTLP endpoint từ config

##### Điểm cần cẩn trọng

1. `SetupTracing(...)` set **global** tracer provider; thường chỉ nên gọi một lần mỗi process.
2. `newTraceExporter(...)` kỳ vọng endpoint ở dạng base OTLP host, không nên phụ thuộc vào custom path phức tạp vì code hiện chủ yếu dùng `parsed.Host`.
3. Nếu service tạo `http.Client` tùy biến mà không dùng `WrapHTTPTransport(...)`, trace/request-id outbound HTTP sẽ bị đứt.

#### `grpc.go`

##### Mục đích

Chuẩn hoá tracing và request id cho gRPC server/client.

##### Thành phần nổi bật

- `GRPCUnaryServerInterceptor(serviceName string)`
  - extract metadata -> context
  - đọc `x-request-id`
  - start server span
  - record `rpc.system`, `rpc.method`, `request.id`
  - gọi handler rồi `recordGRPCStatus(...)`

- `GRPCUnaryClientInterceptor(serviceName string)`
  - start client span
  - inject trace context + request id vào metadata outgoing

- `metadataCarrier`
  - adapter để metadata gRPC implement `propagation.TextMapCarrier`

- `recordGRPCStatus(...)`
  - map error -> gRPC code -> OTel status

##### Vì sao file này quan trọng

Đây là cầu nối giữa `proto/` và `pkg/observability`: mọi gRPC client/server dùng chung trong repo có thể mang theo trace và request ID mà không phải lặp code ở từng service.

##### Giới hạn hiện tại

Interceptor này **không tự xử lý auth metadata domain-specific**. Nếu handler muốn `userID`, nó phải có cơ chế riêng.

#### `metrics.go`

##### Mục đích

Expose một bộ metric business-level tối thiểu thay vì chỉ metric kỹ thuật HTTP.

##### Metric hiện có

- `ecommerce_business_operation_total`
- `ecommerce_business_operation_duration_seconds`
- `ecommerce_business_state_transition_total`

##### Function nổi bật

- `ObserveOperation(service, operation, outcome, duration)`
- `IncEvent(service, operation, outcome)`
- `RecordStateTransition(service, entity, from, to, outcome)`
- `OutcomeFromError(err, businessErrors...)`

##### Ý nghĩa thiết kế

Package này ép code nghiệp vụ phân biệt ít nhất 3 outcome:

- `success`
- `business_error`
- `system_error`

Đây là cách hữu ích để dashboard không trộn validation/domain fail với hạ tầng fail.

##### Điểm cần cẩn trọng

- label được lowercase và replace space bằng `_`; nếu đổi tên operation tùy tiện sẽ làm metric phân mảnh.
- package dùng global metric registry qua `promauto`, nên tên metric phải ổn định.

---

### 7.6. `response/`

File chính: `response/response.go`

#### Mục đích

Chuẩn hoá HTTP JSON envelope để frontend hoặc API consumer không phải xử lý mỗi endpoint một kiểu.

#### Struct/function nổi bật

- `Response`
  - `Success`, `Message`, `Data`, `Error`, `Meta`
- `Meta`
  - `Page`, `Limit`, `Total`, `NextCursor`, `HasNext`
- `Success(...)`
- `SuccessWithMeta(...)`
- `Error(...)`

#### Ý nghĩa thiết kế

`Meta` hỗ trợ cả hai kiểu pagination:

- offset/page (`Page`, `Limit`, `Total`)
- cursor (`NextCursor`, `HasNext`)

Điều này cho thấy HTTP API đã bắt đầu hướng sang cursor cho các list endpoint lớn, dù một số contract khác trong repo vẫn còn page/limit.

#### Điểm cần cẩn trọng

- `Data interface{}` rất linh hoạt nhưng không tự đảm bảo schema; consistency nằm ở handler/service.
- `Error` là string đơn giản; không có field machine-readable `code`, nên nếu sau này cần frontend mapping tinh vi hơn, có thể phải mở rộng envelope theo hướng additive.

---

### 7.7. `validation/`

File chính: `validation/validator.go`

#### Mục đích

Adapter giữa interface validator của Echo và `go-playground/validator`.

#### Thành phần nổi bật

- `CustomValidator`
- `New()`
  - tạo validator instance
  - đăng ký `RegisterTagNameFunc(...)` để lỗi dùng tên field theo tag `json`
- `Validate(i interface{}) error`
  - validate struct
  - nếu có `validator.ValidationErrors` thì map sang `echo.NewHTTPError(400, ...)`
- `Message(err error) string`
  - extract message thân thiện cho client
- `formatValidationErrors(...)`
  - gom nhiều field error thành một string

#### Input/output

- Input: struct request đã bind từ HTTP body/query/path
- Output: `nil` nếu hợp lệ, hoặc error có thể đưa thẳng vào `response.Error(...)`

#### Điểm cần cẩn trọng

1. Package này hiện mới map một số tag phổ biến như `required`, `email`, `min`, `max`, `gt`, `gte`, `lt`, `lte`.
2. Nếu bạn thêm custom validator tag mới, nên cập nhật `formatValidationErrors(...)` để message không bị chung chung.
3. `Message(err)` sẽ fallback về `err.Error()` nếu error không phải `*echo.HTTPError`; điều này có thể làm lộ message kỹ thuật hơn mong muốn nếu custom validator trả lỗi lạ.

---

## 8. Dependency giữa các package trong `pkg/`

Luồng phụ thuộc nội bộ khá gọn:

- `database` phụ thuộc `config.DatabaseConfig`
- `middleware/rate_limit` phụ thuộc `config.RedisConfig`
- `middleware/logging` phụ thuộc `observability`
- `observability/tracing` phụ thuộc `config.TracingConfig`
- `response` và `validation` gần như độc lập, chỉ bám Echo
- `logger` độc lập với các package khác trong `pkg/`

Điều này là một dấu hiệu tốt: `pkg/` vẫn giữ coupling tương đối thấp. Chưa có package nào trở thành “god package”.

---

## 9. Pattern thiết kế đang dùng

### 9.1. Explicit wiring

Repo tránh framework DI nặng. Mỗi service main tự gọi từng constructor rồi ghép lại.

### 9.2. Adapter pattern

- `validation.CustomValidator` adapter giữa Echo và validator library
- `observability.metadataCarrier` adapter giữa metadata gRPC và OTel propagator
- `observability.requestContextTransport` adapter giữa `http.RoundTripper` và tracing/request-id propagation

### 9.3. Middleware pipeline

`auth`, `rate limit`, `logging`, `tracing`, `request id` đều dùng cùng `echo.MiddlewareFunc` nên lắp ghép được theo pipeline.

### 9.4. Fail-soft có chủ đích

- config file không tồn tại vẫn chạy
- tracing disabled trả shutdown no-op
- Redis rate limiter fail sẽ fallback in-memory

Đây là tinh thần “degrade gracefully” cho thành phần phụ trợ.

---

## 10. Những chỗ dễ gây lỗi hoặc dễ hiểu nhầm

### 10.1. `config.Load(...)` chưa có env namespace theo service

Đây là điểm đáng chú ý nhất trong `pkg/`: chữ ký hàm khiến người đọc dễ nghĩ mỗi service có env prefix riêng, nhưng implementation hiện chưa làm vậy.

### 10.2. Auth middleware không dùng JSON envelope chuẩn

`JWTAuth(...)` và `RequireRole(...)` trả `map[string]string` trực tiếp, không dùng `response.Error(...)`. Nếu client kỳ vọng envelope đồng nhất 100%, đây là điểm lệch.

### 10.3. Request ID là opt-in

Nếu service không mount `RequestIDMiddleware()`, `RequestLogger(...)` và tracing vẫn chạy nhưng không tự sinh request id.

### 10.4. Rate limit degraded mode không còn distributed

Fallback từ Redis sang memory giúp service không chết, nhưng khi scale nhiều replica thì limit sẽ không còn chính xác toàn cục.

### 10.5. Tracing chỉ propagate những gì package biết

Shared interceptor không hiểu domain auth context. Đừng giả định rằng gRPC handler tự có `userID` chỉ vì trace/request id đã được propagate.

### 10.6. `response.Meta` rộng hơn nhiều API hiện tại

`Meta` đã hỗ trợ cursor pagination, nhưng không phải endpoint nào cũng đi theo cursor. Khi mở rộng API, cần giữ consistency giữa transport contract và envelope.

---

## 11. Nên bắt đầu từ đâu khi muốn mở rộng?

### Trường hợp 1: thêm config dùng chung

Bắt đầu từ `config/config.go`, sau đó cập nhật deployment config.

### Trường hợp 2: thêm HTTP cross-cutting concern

Ví dụ audit header, correlation policy, body size limit dùng chung: bắt đầu từ `middleware/` hoặc `observability/`.

### Trường hợp 3: thêm metric business chuẩn

Bắt đầu ở `observability/metrics.go`. Cố gắng giữ label ít nhưng đủ nghĩa.

### Trường hợp 4: đổi format response chung

Xem `response/response.go` trước, nhưng phải cân nhắc backward compatibility cho frontend và gateway.

### Trường hợp 5: thêm rule validate mới hay custom tag

Mở `validation/validator.go`, thêm registration cho validator và map error message tương ứng.

### Trường hợp 6: thêm propagation cho outbound gRPC/HTTP

Ưu tiên sửa ở `observability/` để mọi service hưởng lợi cùng lúc, thay vì patch rải rác ở từng service.

---

## 12. Đề xuất cải tiến an toàn

1. **Làm rõ env prefix trong config**
   - hoặc thật sự thêm `SetEnvPrefix(...)`
   - hoặc giữ logic hiện tại nhưng sửa toàn bộ comment/tài liệu để tránh hiểu nhầm

2. **Chuẩn hoá lỗi auth theo `response.Error(...)`**
   - giúp HTTP envelope đồng nhất hơn

3. **Định nghĩa typed auth context cho gRPC**
   - hiện shared interceptor mới propagate request/tracing, chưa có caller identity

4. **Cân nhắc inject shared Redis client**
   - nếu sau này cần lifecycle/shutdown/test control tốt hơn

5. **Bổ sung custom validator message cho tag đặc thù**
   - giảm lỗi kiểu “failed validation rule xyz” quá generic

---

## 13. Kết luận

`pkg/` là nền hạ tầng dùng chung của platform, giữ cho các service trong repo có cùng cách:

- đọc config
- log
- trace
- expose metric
- validate request
- trả response
- bảo vệ route

Giá trị lớn nhất của thư mục này không nằm ở độ phức tạp, mà ở việc nó tạo **một chuẩn vận hành thống nhất** cho nhiều service. Khi sửa ở đây, cần nhớ rằng ảnh hưởng sẽ lan rất rộng: thay đổi nhỏ ở `pkg/` có thể tác động đồng thời đến gateway, user-service, product-service, order-service, cart-service, payment-service và các client nội bộ qua gRPC.
