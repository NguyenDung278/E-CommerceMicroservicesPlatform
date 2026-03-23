# Annotated: Shared Packages

Khi mới vào repo, đừng nhảy ngay vào service business. Hãy đọc `pkg/` trước vì đây là nơi định nghĩa "luật chơi" chung cho toàn bộ backend.

File nên đọc:

- `pkg/config/config.go`
- `pkg/middleware/auth.go`
- `pkg/validation/validator.go`
- `pkg/database/postgres.go`

## 1. `pkg/config/config.go`

### Block `config.go:20-33`

`Config` gom gần như toàn bộ dependency runtime:

- HTTP server
- PostgreSQL
- Redis
- RabbitMQ
- JWT
- gRPC
- SMTP
- service URLs
- frontend base URL
- payment gateway
- object storage
- tracing
- search

Ý nghĩa: các service dùng chung một contract config thay vì mỗi nơi tự nghĩ cách load env.

### Block `config.go:168-226`

Đây là danh sách default values. Khi đọc block này bạn sẽ hiểu:

- port mặc định của từng loại dependency
- service-to-service URLs mặc định trong Docker network
- feature nào là optional và disabled by default như tracing/search

### Block `config.go:228-259`

Priority load config:

1. env vars
2. config file
3. defaults

`CONFIG_PATH` cho phép container mount một file config cụ thể, nên Docker Compose chỉ cần bind mount YAML rồi inject env secret cần thiết.

## 2. `pkg/middleware/auth.go`

### Block `auth.go:16-30`

`JWTClaims` chứa `UserID`, `Email`, `Role`. Điều này giúp downstream service không phải gọi lại `user-service` cho mọi request authenticated.

### Block `auth.go:43-87`

`JWTAuth` làm ba việc:

1. lấy header `Authorization`
2. parse token HMAC
3. đưa claims vào `Echo context`

Đoạn kiểm tra signing method ở `auth.go:66-72` là block security quan trọng để tránh algorithm confusion.

### Block `auth.go:98-123`

`RequireRole` là lớp authorization mỏng, tách biệt với authentication. Đây là lý do route có thể ghép `JWTAuth` và role middleware linh hoạt.

## 3. `pkg/validation/validator.go`

Block quan trọng nhất là `New()` và `Validate(...)`:

- map error field theo tag `json`
- format message validation thân thiện với client
- gắn vào Echo bằng `e.Validator = appvalidator.New()`

Tác dụng thực tế: mọi service HTTP trả lỗi validation nhất quán.

## 4. `pkg/database/postgres.go`

`NewPostgresDB(...)` thiết lập:

- open connection
- connection pool limits
- ping khi startup

`RunPostgresMigrations(...)` chạy migration từ embedded FS, nên mỗi service tự mang schema của chính nó.

## 5. Vì sao nên đọc các shared package này trước

Nếu không đọc `pkg/` trước, bạn sẽ thấy các service giống như lặp lại rất nhiều. Thực tế phần lặp đó là chủ đích:

- startup shape giống nhau
- middleware giống nhau
- logging/tracing/metrics giống nhau
- validation và auth giống nhau

Nhờ vậy khi sửa một service, bạn có thể dự đoán được service khác đang hoạt động theo cùng pattern nào.
