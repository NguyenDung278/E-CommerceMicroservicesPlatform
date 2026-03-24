# 03. Roadmap đọc source code

Tài liệu này là "kim chỉ nam" giúp bạn biết nên mở file nào trước, file nào sau để hiểu dự án này nhanh nhất mà không bị lạc trong Microservices.

---

## 🏎️ 1. Quick Start (5 phút để hiểu cấu trúc)

Nếu bạn vừa clone repo này và muốn biết "nó làm cái gì ở đâu", hãy đọc theo đúng thứ tự này:

1. **`api-gateway/cmd/main.go`**: Điểm vào của mọi request. Bạn sẽ thấy các route công khai.
2. **`pkg/middleware/auth.go`**: Cách hệ thống bảo vệ API bằng JWT.
3. **`services/user-service/internal/service/user_service.go`**: Business logic cơ bản nhất (Đăng ký/Đăng nhập).
4. **`pkg/response/response.go`**: Cách backend trả dữ liệu JSON tiêu chuẩn.

---

## 🏗️ 2. Quy tắc "3 Lớp" (Phải hiểu trước khi đọc tiếp)

Mọi service trong dự án này (User, Product, Order...) đều tuân theo một khuôn mẫu (Pattern) duy nhất. Khi bạn hiểu khuôn này, bạn sẽ đọc file nào cũng thấy quen thuộc:

1. **`internal/handler/` (Tầng Giao Diện)**: Nhận request từ HTTP, kiểm tra dữ liệu đầu vào (Validation).
2. **`internal/service/` (Tầng Nghiệp Vụ)**: Nơi chứa logic chính (Tính tiền, kiểm kho, gửi mail). Đây là phần quan trọng nhất.
3. **`internal/repository/` (Tầng Dữ Liệu)**: Nơi viết các câu lệnh SQL hoặc gọi Redis để lưu/lấy dữ liệu.

---

## 📅 3. Lộ trình đọc chi tiết theo từng giai đoạn

### Giai đoạn 1: Hiểu "Xương sống" (`pkg/` và `api-gateway/`)

Đừng đọc logic nghiệp vụ ngay. Hãy đọc những thứ bổ trợ trước vì service nào cũng dùng chúng.

- [ ] **Lớp bảo vệ**: `pkg/middleware/auth.go` (JWT) và `rate_limit.go`.
- [ ] **Cấu hình**: `pkg/config/config.go` (Cách load file `.yaml` và `.env`).
- [ ] **Dữ liệu trả về**: `pkg/response/response.go` (Bạn sẽ thấy `success`, `message`, `data`).
- [ ] **Cổng vào**: `api-gateway/internal/proxy/service_proxy.go` (Cách Gateway forward request đi).

### Giai đoạn 2: Đọc Service mô hình mẫu (`user-service`)

`user-service` là service đơn giản nhất để học trọn vẹn quy trình:
1. Mở `internal/handler/user_handler.go` để xem các endpoint.
2. Mở `internal/service/user_service.go` để xem logic đăng ký.
3. Mở `internal/repository/user_repository.go` để xem cách viết SQL.

### Giai đoạn 3: Học về giao tiếp giữa các Service (`product-service` & `cart-service`)

Ở đây bạn sẽ học được cách các service "nói chuyện" với nhau:
- [ ] **gRPC Server**: Đọc `services/product-service/internal/handler/grpc_handler.go`.
- [ ] **gRPC Client**: Đọc `services/cart-service/internal/service/cart_service.go`. Bạn sẽ thấy Cart gọi Product để lấy giá thật.
- [ ] **Redis**: Đọc `services/cart-service/internal/repository/cart_repository.go` để xem cách dùng DB bộ nhớ tạm.


Vì service này có:

- auth flow đơn giản,
- PostgreSQL repository dễ hiểu,
- JWT generation,
- profile update.

### Tiếp theo là `product-service`

Vì đây là CRUD thuần, rất hợp để luyện:

- route
- service
- repository
- migration

## Giai đoạn 4: Đọc service trung bình

### `cart-service`

Học được:

- Redis
- gRPC client
- source of truth

### `notification-service`

Học được:

- RabbitMQ consumer
- event-driven flow
- health endpoint cho worker

## Giai đoạn 5: Đọc service khó nhất

### `order-service`

Bạn nên đọc sau khi đã hiểu:

- gRPC cơ bản
- transaction
- repository pattern

### `payment-service`

Bạn nên đọc sau khi đã hiểu:

- auth/authorization
- duplicate protection
- trust boundary giữa frontend và backend

## Giai đoạn 6: Trace use case end-to-end

Sau khi đọc từng service riêng, hãy trace theo use case:

### Use case 1: Login

- gateway
- user handler
- user service
- user repository
- JWT middleware

### Use case 2: Browse product

- gateway
- product handler
- product service
- product repository

### Use case 3: Add to cart

- gateway
- cart handler
- cart service
- gRPC product client
- Redis repository

### Use case 4: Create order

- gateway
- order handler
- order service
- gRPC product client
- order repository
- RabbitMQ event

### Use case 5: Process payment

- gateway
- payment handler
- payment service
- order client
- payment repository
- RabbitMQ event

## Giai đoạn 7: Đọc migration và proto

### Migration

Đọc `migrations/*.sql` để hiểu:

- schema thật đang lưu gì,
- constraint nào bảo vệ dữ liệu,
- index nào tối ưu truy vấn.

### Proto

Đọc `proto/*.proto` để hiểu:

- internal contract giữa service,
- request/response của gRPC,
- service nào expose capability gì.

## Cách đọc một file backend Go cho hiệu quả

Với mỗi file, hãy làm theo mẫu này:

1. Xem package name.
2. Xem import nào được dùng.
3. Xem struct chính của file là gì.
4. Xem public methods nào có trên struct đó.
5. Tự hỏi file này là input layer, domain layer hay storage layer.

## Checklist tự đánh giá

Sau khi học hết roadmap này, bạn nên tự kiểm tra xem mình đã làm được chưa:

- tôi có thể mô tả login flow mà không mở code không?
- tôi có thể nói order total được tính ở đâu không?
- tôi có thể giải thích vì sao cart không tin `price` từ frontend không?
- tôi có thể chỉ ra event nào được publish sau khi tạo order/payment không?
- tôi có thể giải thích vai trò của `context.Context` trong các service không?

Nếu trả lời được những câu này, bạn đã hiểu project ở mức rất tốt.
