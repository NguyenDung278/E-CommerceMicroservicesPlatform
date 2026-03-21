# E-Commerce Microservices Platform - Phân tích Back-end

Tài liệu này phân tích phần back-end của repo `E-Commerce Microservices Platform` theo góc nhìn học tập dành cho người muốn theo hướng Back-end Developer với Golang. Mục tiêu không chỉ là biết "file nào làm gì", mà còn hiểu vì sao dự án được tổ chức như vậy, luồng request chạy qua đâu, business logic nằm ở tầng nào, và bạn nên học được gì từ cách viết code này.

## 1. Tổng quan dự án

Đây là một hệ thống thương mại điện tử được tổ chức theo mô hình microservices viết bằng Go. Hệ thống chia nghiệp vụ thành nhiều service riêng:

- `api-gateway`: điểm vào chung cho client.
- `user-service`: đăng ký, đăng nhập, profile người dùng.
- `product-service`: CRUD và truy vấn sản phẩm.
- `cart-service`: quản lý giỏ hàng bằng Redis.
- `order-service`: tạo đơn hàng, kiểm tra stock, tính tổng tiền.
- `payment-service`: xử lý thanh toán cho đơn hàng.
- `notification-service`: nhận event từ RabbitMQ để xử lý thông báo.

Nếu nhìn theo góc độ học nghề, đây là một dự án rất tốt để luyện 3 tư duy quan trọng của Golang backend:

- Tách lớp rõ ràng giữa `handler -> service -> repository`.
- Giữ domain logic ở tầng `service`, tránh nhồi business logic vào HTTP layer.
- Dùng shared package (`pkg`) để tái sử dụng middleware, config, validation, response format.

Điểm đáng chú ý là mỗi service có thể là một Go module riêng, có `cmd/main.go` riêng, `internal` riêng, migration riêng. Đây là cách tổ chức khá gần với thực tế production khi hệ thống đã lớn.

## 2. Công nghệ sử dụng và lý do

### 2.1 Ngôn ngữ và runtime

- `Go / Golang`
  - Lý do chọn: đơn giản, compile nhanh, concurrency tốt, binary deploy gọn, rất hợp cho back-end service.
  - Lợi ích trong dự án này: mỗi service build thành một binary độc lập, dễ containerize bằng Docker.

### 2.2 HTTP framework và middleware

- `Echo`
  - Dùng ở gateway và các HTTP service.
  - Lý do chọn: nhẹ, API rõ ràng, dễ gắn middleware, dễ bind/validate request.
  - Lợi ích: phù hợp cho kiểu service CRUD và API JSON tiêu chuẩn.

- Shared middleware trong `pkg/middleware`
  - `JWTAuth`: xác thực token.
  - `RequireRole`: phân quyền theo role.
  - `NewRateLimiter`: rate limit đơn giản.
  - `RequestLogger`: ghi log request.
  - `FrontendCORS`: cấu hình CORS dùng chung.
  - Lợi ích: tất cả service dùng chung chuẩn xác thực và bảo vệ request, không bị mỗi nơi một kiểu.

### 2.3 Database và storage

- `PostgreSQL`
  - Dùng cho `user-service`, `product-service`, `order-service`, `payment-service`.
  - Lý do chọn: ACID tốt, query mạnh, phù hợp dữ liệu nghiệp vụ có transaction.
  - Lợi ích trong dự án: đơn hàng, user, payment đều là dữ liệu cần consistency cao.

- `Redis`
  - Dùng cho `cart-service`.
  - Lý do chọn: giỏ hàng là dữ liệu tạm thời, đọc/ghi nhanh, phù hợp key-value.
  - Lợi ích: cart không phải source of truth cuối cùng, nên lưu trên Redis rất hợp lý.

### 2.4 Giao tiếp giữa service

- `REST/HTTP`
  - Dùng giữa frontend -> gateway -> service.
  - Dễ debug bằng browser, Postman, curl.

- `gRPC`
  - Dùng từ `order-service` và `cart-service` sang `product-service`.
  - Lý do chọn: contract rõ ràng bằng `.proto`, type-safe hơn khi service gọi nhau.
  - Lợi ích: khi order/cart cần lấy dữ liệu sản phẩm thật, gRPC giúp request nhỏ và ổn định hơn.

- `RabbitMQ`
  - Dùng cho event bất đồng bộ như `order.created`, `payment.completed`.
  - Lý do chọn: tách side effect khỏi request chính.
  - Lợi ích: `notification-service` không cần bị gọi trực tiếp trong request mua hàng.

### 2.5 Thư viện và công cụ hỗ trợ

- `go-playground/validator`
  - Dùng validate DTO ở tầng handler.
  - Giúp validation khai báo bằng tag `validate:"..."`.

- `Viper`
  - Dùng load config từ file/env.
  - Lợi ích: cấu hình nhất quán giữa các service.

- `zap`
  - Dùng logging.
  - Lý do chọn: nhanh, structured logging tốt.

- `golang-migrate`
  - Dùng migration database.
  - Lợi ích: schema đi cùng source code, dễ tái tạo môi trường.

- `JWT (golang-jwt/jwt/v5)`
  - Dùng cho authentication.
  - Giúp các service downstream đọc được `user_id`, `email`, `role` từ token.

- `Prometheus`, `Grafana`, `Jaeger`
  - Dùng cho observability.
  - Đây là phần giúp người học hiểu thêm cách hệ thống production-friendly đo metrics và tracing.

- `Docker Compose`
  - Dùng dựng toàn bộ local stack.
  - Rất quan trọng với người học backend vì giúp hiểu hệ thống nhiều service thực sự chạy như thế nào.

### 2.6 Vì sao stack này tốt cho người học Golang backend?

- Bạn được học cả request-driven service và event-driven worker.
- Bạn thấy rõ cách Go tổ chức code theo package nhỏ, rõ trách nhiệm.
- Bạn được tiếp cận cả `database/sql`, gRPC, JWT, Redis, RabbitMQ, middleware, config.

## 3. Kiến trúc hệ thống

### 3.1 Bức tranh tổng thể

```text
Frontend
  -> API Gateway
      -> User Service
      -> Product Service
      -> Cart Service -> Product Service (gRPC)
      -> Order Service -> Product Service (gRPC)
      -> Payment Service -> Order Service (HTTP read)

Order Service ----> RabbitMQ ----> Notification Service
Payment Service --> RabbitMQ ----> Notification Service

User / Product / Order / Payment -> PostgreSQL
Cart -> Redis

Metrics -> Prometheus -> Grafana
Tracing -> Jaeger
```

### 3.2 Kiểu kiến trúc đang dùng

Đây là `microservices architecture` kết hợp 3 phong cách giao tiếp:

- `Client-facing synchronous HTTP`: frontend gọi API gateway, gateway forward sang service.
- `Internal synchronous gRPC/HTTP`: service cần dữ liệu thật từ service khác thì gọi trực tiếp.
- `Asynchronous messaging`: order/payment publish event để notification xử lý sau.

### 3.3 Cách các thành phần tương tác

- Client không gọi từng service trực tiếp, mà đi qua `api-gateway`.
- Gateway gần như là lớp reverse proxy mỏng, giữ contract `/api/v1/...`.
- Mỗi service giữ business logic của domain riêng.
- Shared concerns như auth, config, validation được đưa vào `pkg`.

### 3.4 Tại sao kiến trúc này đáng học?

Với người học Go backend, đây là một ví dụ tốt để hiểu rằng:

- Không phải mọi logic đều nằm trong `main.go`.
- `handler` không phải nơi viết business logic nặng.
- `repository` không nên biết về HTTP.
- Khi hệ thống lớn lên, boundary giữa domain rất quan trọng.

## 4. Luồng hoạt động chính

Phần này mô tả các luồng nghiệp vụ quan trọng nhất theo dạng step-by-step.

### 4.1 Luồng đăng nhập

1. Frontend gọi `POST /api/v1/auth/login` qua gateway.
2. Gateway forward request sang `user-service`.
3. `user-service/internal/handler/user_handler.go` bind và validate request.
4. `user-service/internal/service/user_service.go` chuẩn hóa identifier:
   - Nếu có `@` thì hiểu là email.
   - Nếu không, normalize như số điện thoại.
5. Service lấy user từ repository.
6. So sánh password bằng `bcrypt.CompareHashAndPassword`.
7. Nếu đúng, tạo JWT chứa `user_id`, `email`, `role`, đồng thời tạo `refresh_token`.
8. Trả token pair về cho frontend, cho phép user giữ đăng nhập lâu dài an toàn hơn.

### 4.2 Luồng xem sản phẩm

1. Frontend gọi `GET /api/v1/products`.
2. Gateway forward sang `product-service`.
3. Handler đọc query params `search`, `category`, `limit`, `page`.
4. Service tính offset/limit hợp lệ.
5. Repository build câu SQL động nhưng vẫn parameterized.
6. Trả danh sách sản phẩm về frontend.

### 4.3 Luồng thêm vào giỏ hàng

1. Frontend gọi `POST /api/v1/cart/items` với `product_id`, `quantity`.
2. `cart-service` đọc `user_id` từ JWT middleware.
3. `cart-service/internal/service/cart_service.go` gọi gRPC sang `product-service` để lấy product thật.
4. Service dùng `name`, `price`, `stock` từ product service chứ không tin client.
5. Service lấy cart hiện tại từ Redis.
6. Nếu sản phẩm đã có trong cart, tăng quantity.
7. Tính lại tổng tiền.
8. Lưu cart về Redis.

Đây là một bài học backend rất quan trọng: dữ liệu quan trọng như giá và tên sản phẩm phải lấy từ server-side source of truth.

### 4.4 Luồng tạo đơn hàng

1. Frontend gọi `POST /api/v1/orders`.
2. `order-service` đọc danh sách item.
3. Với từng item, service gọi gRPC sang `product-service` để lấy thông tin sản phẩm thật.
4. Service kiểm tra stock.
5. Service tạo `Order` và `OrderItem`, tính `total_price`.
6. Repository ghi `orders` và `order_items` trong cùng một transaction.
7. Sau khi commit, service publish event `order.created`.
8. Notification service có thể nhận event để xử lý tiếp.

### 4.5 Luồng thanh toán

1. Frontend gọi `POST /api/v1/payments` với `order_id`, `payment_method`.
2. `payment-service` đọc `Authorization` header và `user_id` từ JWT.
3. Service gọi sang `order-service` để lấy order thật của chính user đó.
4. Service tự lấy `total_price` từ order làm `payment.Amount`.
5. Service kiểm tra duplicate payment theo `order_id`.
6. Repository ghi payment vào bảng `payments`.
7. Service publish event `payment.completed`.

Sau patch mới, client không còn được gửi `amount`. Đây là một ví dụ rất thực tế về nguyên tắc bảo mật backend: `never trust the client for money`.

### 4.6 Luồng notification bất đồng bộ

1. `notification-service` bind queue `notification-queue` với các routing key:
   - `order.created`
   - `payment.completed`
   - `payment.failed`
2. Khi có message, worker loop nhận `amqp.Delivery`.
3. `EventHandler` switch theo `RoutingKey`.
4. Parse JSON event.
5. Xử lý business action tương ứng.
6. `Ack` message nếu xử lý ổn, `Nack` nếu parse lỗi.

### 4.7 Luồng Hủy đơn hàng và Hoàn kho

1. Frontend gọi `PUT /api/v1/orders/:id/cancel`.
2. `order-service` kiểm tra quyền sở hữu order và rule nghiệp vụ (chỉ hủy đơn `pending`).
3. Đổi status thành `cancelled`.
4. Với mỗi item, gọi RPC `UpdateProduct` sang `product-service` để khôi phục kho (`stock = stock + quantity`). Giải pháp này tải sử dụng Proto struct để không cần sinh thêm file PB.
5. Publish event `order.cancelled` tới RabbitMQ.
6. `notification-service` nhận event và gửi email xác nhận hủy đơn cho khách hàng.

Đây là ví dụ điển hình về Distributed Transaction theo dạng best-effort và Event-driven Architecture trong hệ sinh thái E-commerce.

Đây là ví dụ tốt để học event-driven backend trong Go.

## 5. Cấu trúc thư mục và file

### 5.1 Cấu trúc thư mục mức cao

```text
ecommerce-platform/
  api-gateway/
    cmd/
    internal/
      handler/
      proxy/
  services/
    user-service/
    product-service/
    cart-service/
    order-service/
    payment-service/
    notification-service/
  pkg/
    config/
    database/
    logger/
    middleware/
    response/
    validation/
  proto/
  deployments/
    docker/
    k8s/
  docs/
```

### 5.2 Ý nghĩa của từng thư mục lớn

- `api-gateway/`
  - Nơi gom tất cả route public và forward sang service thật.

- `services/*`
  - Mỗi service là một domain backend riêng.
  - Cấu trúc bên trong thường theo mẫu:
    - `cmd/main.go`
    - `internal/handler`
    - `internal/service`
    - `internal/repository`
    - `internal/model`
    - `internal/dto`
    - `migrations`

- `pkg/`
  - Shared package dùng lại giữa các service.
  - Đây là nơi cực kỳ đáng học, vì nó thể hiện cách tránh duplicate code trong Go monorepo.

- `proto/`
  - Định nghĩa contract gRPC giữa service.

- `deployments/docker/config/`
  - File config YAML cho từng service.

### 5.3 File quan trọng cần đọc đầu tiên

Nếu bạn là người mới học dự án này, thứ tự đọc hợp lý là:

1. [README.md](/Users/nguyendung/FPT/projects/ecommerce-platform/README.md)
2. [api-gateway/cmd/main.go](/Users/nguyendung/FPT/projects/ecommerce-platform/api-gateway/cmd/main.go)
3. [pkg/config/config.go](/Users/nguyendung/FPT/projects/ecommerce-platform/pkg/config/config.go)
4. [pkg/middleware/auth.go](/Users/nguyendung/FPT/projects/ecommerce-platform/pkg/middleware/auth.go)
5. [services/user-service/internal/service/user_service.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/user-service/internal/service/user_service.go)
6. [services/product-service/internal/repository/product_repository.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/product-service/internal/repository/product_repository.go)
7. [services/order-service/internal/service/order_service.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/order-service/internal/service/order_service.go)
8. [services/payment-service/internal/service/payment_service.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/payment-service/internal/service/payment_service.go)
9. [services/cart-service/internal/service/cart_service.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/cart-service/internal/service/cart_service.go)
10. [services/notification-service/internal/handler/event_handler.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/notification-service/internal/handler/event_handler.go)

### 5.4 Naming convention và coding pattern

#### Naming convention

- Tên package thường ngắn, đúng domain: `handler`, `service`, `repository`, `model`, `dto`.
- Exported identifier dùng `PascalCase`: `UserService`, `PaymentHandler`.
- Unexported identifier dùng `camelCase`: `paymentRepo`, `productClient`.
- JSON field dùng `snake_case`: `user_id`, `total_price`.

#### Coding pattern lặp lại nhiều nhất

- `NewX(...)` constructor pattern
  - Ví dụ: `NewPaymentService`, `NewCartHandler`, `NewProductRepository`.

- `handler -> service -> repository`
  - `handler`: nhận request và trả response.
  - `service`: xử lý business logic.
  - `repository`: truy cập storage.

- `DTO pattern`
  - Request/response body được tách riêng trong `dto`.
  - Điều này làm code rõ ràng hơn model database.

- `error wrapping`
  - Dùng `fmt.Errorf("...: %w", err)` để giữ context.

- `defer`
  - Dùng để đóng connection, rollback transaction, close rows.

- `context.Context`
  - Truyền xuyên suốt từ HTTP layer xuống DB/gRPC.
  - Đây là thói quen rất quan trọng trong Golang backend.

## 6. Phân tích code chi tiết

### 6.1 Entry point của một service Go

File điển hình: [services/payment-service/cmd/main.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/payment-service/cmd/main.go)

Một `main.go` trong repo này thường làm 8 việc:

1. Load config bằng `config.Load(...)`.
2. Tạo logger.
3. Kết nối database hoặc Redis.
4. Chạy migrations nếu cần.
5. Kết nối dependency bên ngoài như RabbitMQ hoặc gRPC.
6. Khởi tạo repository.
7. Khởi tạo service.
8. Khởi tạo handler rồi đăng ký route vào Echo.

Đây là pattern Go backend rất điển hình: `main.go` chỉ làm wiring, không chứa business logic.

### 6.2 Shared auth middleware

File: [pkg/middleware/auth.go](/Users/nguyendung/FPT/projects/ecommerce-platform/pkg/middleware/auth.go)

Đây là một trong những file nên đọc kỹ vì nó cho bạn thấy cách Go xử lý authentication theo hướng reusable.

Luồng logic chính:

1. Lấy header `Authorization`.
2. Kiểm tra format `Bearer <token>`.
3. Parse JWT bằng custom claims.
4. Kiểm tra signing method.
5. Kiểm tra token còn hợp lệ.
6. Gắn claims vào `echo.Context`.

Điểm Golang đáng học:

- Middleware trong Echo là higher-order function: hàm trả về hàm.
- Claims được gắn vào context rồi đọc lại bằng helper `GetUserClaims`.
- `RequireRole` là ví dụ đẹp của authorization middleware tách biệt khỏi business logic.

### 6.3 Gateway proxy pattern

File: [api-gateway/internal/proxy/service_proxy.go](/Users/nguyendung/FPT/projects/ecommerce-platform/api-gateway/internal/proxy/service_proxy.go)

Đây là trái tim của `api-gateway`.

Ý tưởng chính:

- Gateway không tự xử lý domain logic.
- Nó nhận request từ client, clone request, copy header, forward sang backend service.
- Sau đó copy response từ backend về client.

Các điểm kỹ thuật quan trọng:

- Dùng `http.Client` với timeout và transport config.
- Có circuit breaker bằng `sony/gobreaker`.
- Có retry cho request idempotent như `GET`.

Đây là một ví dụ tốt để học:

- cách Go làm reverse proxy mức application,
- cách clone request,
- cách dùng `context.Context` xuyên qua network call.

### 6.4 Validation flow

File: [pkg/validation/validator.go](/Users/nguyendung/FPT/projects/ecommerce-platform/pkg/validation/validator.go)

Pattern đang dùng:

- DTO khai báo rule bằng tag, ví dụ `validate:"required,email"`.
- Handler gọi `c.Validate(&req)`.
- Validator format lại lỗi cho dễ đọc.

Ý nghĩa đối với người học:

- Validation nên xảy ra sớm ở boundary của hệ thống.
- Service không nên phải nhận một object "bẩn" rồi tự kiểm tra lại tất cả.

### 6.5 Repository pattern với SQL động an toàn

File: [services/product-service/internal/repository/product_repository.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/product-service/internal/repository/product_repository.go)

Đây là file rất tốt để học `database/sql`.

Điểm đáng chú ý:

- Query được build động theo `category` và `search`.
- Dù là dynamic SQL, code vẫn dùng placeholder `$1`, `$2`, ... để tránh SQL injection.
- Hàm `List(...)` trả về cả `products` và `total`, rất hợp cho pagination.

Điều bạn nên học từ file này:

- Viết repository không nhất thiết phải dùng ORM.
- `database/sql` vẫn rất mạnh nếu bạn tổ chức truy vấn cẩn thận.

### 6.6 Business logic tạo đơn hàng

File quan trọng nhất: [services/order-service/internal/service/order_service.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/order-service/internal/service/order_service.go)

Đây là nơi thể hiện rõ vai trò của tầng `service`.

Logic chính của `CreateOrder(...)`:

1. Kiểm tra đơn hàng không rỗng.
2. Tạo `Order` object với `pending` status.
3. Với từng item:
   - gọi gRPC sang `product-service`,
   - kiểm tra sản phẩm có tồn tại không,
   - kiểm tra đủ stock không,
   - tạo `OrderItem`,
   - cộng dồn `totalPrice`.
4. Gọi repository để persist bằng transaction.
5. Publish event `order.created`.

Tại sao đoạn này đáng học?

- Nó cho thấy business logic phải nằm ở service chứ không phải handler.
- Nó thể hiện rõ cách Go kết hợp nhiều dependency:
  - DB repository
  - gRPC client
  - RabbitMQ publisher
- Nó dùng error wrapping rất đúng kiểu Go.

### 6.7 Business logic thanh toán

File: [services/payment-service/internal/service/payment_service.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/payment-service/internal/service/payment_service.go)

Sau patch mới, `ProcessPayment(...)` chạy theo tư duy backend an toàn hơn:

1. Check duplicate payment theo `order_id`.
2. Gọi `order-service` qua [order_client.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/payment-service/internal/client/order_client.go) để lấy order thật.
3. Verify order thuộc đúng user hiện tại.
4. Lấy `order.TotalPrice` làm `payment.Amount`.
5. Ghi payment.
6. Publish payment event.

Đây là bài học quan trọng cho người học backend:

- Dữ liệu nhạy cảm như `amount` phải được tính ở server.
- Authorization không chỉ là "có token", mà còn là "có quyền truy cập record này không".

### 6.8 Cart service và tư duy source of truth

File: [services/cart-service/internal/service/cart_service.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/cart-service/internal/service/cart_service.go)

Điểm quan trọng nhất của file này là:

- Cart không còn tin `name` và `price` từ client.
- Service gọi `product-service` để lấy product thật.
- Service tính lại tổng cart sau mỗi thay đổi.

Đây là một mindset rất quan trọng trong nghề backend:

- Client có thể giả mạo request.
- API không nên tin giá tiền hay dữ liệu hiển thị do frontend gửi lên.

### 6.9 Event-driven consumer

File: [services/notification-service/internal/handler/event_handler.go](/Users/nguyendung/FPT/projects/ecommerce-platform/services/notification-service/internal/handler/event_handler.go)

Điều đáng học ở đây:

- Dù không có HTTP, service vẫn giữ cấu trúc package nhất quán.
- `HandleMessage` dùng `switch` theo routing key.
- Parse JSON event riêng cho từng loại.
- `Ack/Nack` giúp bạn hiểu khái niệm xử lý message đáng tin cậy.

Nếu bạn muốn theo hướng backend Go lâu dài, phần event-driven này rất đáng luyện vì ngoài đời thực nhiều hệ thống không chỉ có REST API.

### 6.10 Phân tích cấp độ dòng cho vài đoạn tiêu biểu

#### A. `JWTAuth` middleware

Đoạn code này đáng chú ý vì:

- `authHeader := c.Request().Header.Get("Authorization")`
  - lấy token từ HTTP layer.
- `parts := strings.SplitN(authHeader, " ", 2)`
  - kiểm tra đúng format `Bearer token`.
- `jwt.ParseWithClaims(...)`
  - parse token vào custom struct claims.
- `if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok`
  - chống algorithm confusion attack.
- `c.Set("user", claims)`
  - gắn dữ liệu user vào request context để downstream dùng lại.

Đây là ví dụ điển hình cho cách Go tổ chức middleware: rõ ràng, ít magic, dễ debug.

#### B. `OrderService.CreateOrder`

Đoạn này thể hiện nhiều đặc trưng Golang:

- Khởi tạo struct tường minh:
  - dễ đọc, ít side effect.
- `for _, item := range req.Items`
  - dùng range loop rất Go-style.
- `fmt.Errorf("%w: ...", ErrX, ...)`
  - cho phép upper layer dùng `errors.Is(...)`.
- `s.repo.Create(ctx, order)`
  - service giữ control flow, repository chỉ lo persistence.

#### C. `ServiceProxy.Do`

Đoạn này rất tốt để học networking trong Go:

- Tạo backend URL từ `baseURL + path + query`.
- Copy header thủ công.
- Gắn `context` vào request.
- Dùng circuit breaker để tránh gọi service lỗi liên tục.

Nó cho thấy Go backend thường ưu tiên explicit code hơn là "magic framework behavior".

## 7. Kết luận

### 7.1 Điểm mạnh của dự án

- Tổ chức code rõ ràng, phù hợp để học.
- Tách lớp `handler/service/repository` tốt.
- Có đủ nhiều kỹ thuật backend quan trọng:
  - JWT auth
  - validation
  - PostgreSQL
  - Redis
  - gRPC
  - RabbitMQ
  - Docker Compose
  - observability
- Có test ở một số khu vực quan trọng, giúp người học thấy được thói quen kiểm chứng code.
- Shared package `pkg` làm rất đúng tinh thần tái sử dụng trong Go monorepo.

### 7.2 Người học nên rút ra gì để phát triển sự nghiệp Back-end với Golang?

- Học cách đọc `main.go` trước để hiểu wiring của service.
- Học cách phân biệt trách nhiệm giữa `handler`, `service`, `repository`.
- Thành thạo `context.Context`, `error wrapping`, `defer`, `database/sql`.
- Tập viết API sao cho backend giữ source of truth, không tin dữ liệu nhạy cảm từ client.
- Làm quen với event-driven flow, vì backend thực tế hiếm khi chỉ có CRUD.

### 7.3 Lộ trình học từ chính dự án này

Nếu bạn muốn dùng repo này như tài liệu học nghề, thứ tự học rất hợp lý là:

1. Đọc gateway và shared package.
2. Đọc `user-service` để hiểu auth cơ bản.
3. Đọc `product-service` để hiểu CRUD + repository SQL.
4. Đọc `order-service` để hiểu business logic đa bước.
5. Đọc `cart-service` để hiểu Redis + source of truth.
6. Đọc `payment-service` để hiểu authorization cho domain nhạy cảm.
7. Đọc `notification-service` để hiểu message consumer.

### 7.4 Kết luận cuối cùng

Nếu mục tiêu của bạn là trở thành Back-end Developer chuyên Golang, đây là kiểu dự án rất đáng học vì nó không chỉ dạy cú pháp Go, mà còn dạy cách tư duy như một backend engineer:

- tổ chức code có cấu trúc,
- bảo vệ dữ liệu đúng chỗ,
- thiết kế boundary giữa các module,
- và hiểu một hệ thống thật vận hành như thế nào.

Bạn không cần học hết mọi thứ cùng lúc. Chỉ cần đọc theo luồng request thật, bám vào từng service một, và tự tay trace:

`route -> handler -> service -> repository -> response`

Nếu làm được điều đó đều đặn, bạn đang đi đúng con đường để trở thành một Golang Back-end Developer vững nghề.
