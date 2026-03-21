# 03. Roadmap đọc source code của project này

Tài liệu này giúp bạn biết nên đọc gì trước, đọc gì sau, và đọc như thế nào để không bị ngợp.

## Giai đoạn 1: Nhìn bức tranh lớn

### Mục tiêu

- biết project có những service nào,
- mỗi service làm domain gì,
- request đi vào từ đâu.

### Cần đọc

1. `README.md`
2. `docs/ecommerce-backend-golang-analysis.md`
3. `docs/deep-dive/README.md`
4. `api-gateway/cmd/main.go`

### Câu hỏi tự kiểm tra

- API Gateway làm gì?
- có bao nhiêu service backend?
- service nào dùng PostgreSQL, service nào dùng Redis?
- service nào publish event, service nào consume event?

## Giai đoạn 2: Học shared package trước

### Vì sao?

Vì rất nhiều service dùng chung `pkg`.

### Cần đọc

1. `pkg/config/config.go`
2. `pkg/middleware/auth.go`
3. `pkg/middleware/rate_limit.go`
4. `pkg/middleware/logging.go`
5. `pkg/validation/validator.go`
6. `pkg/response/response.go`
7. `pkg/database/postgres.go`

### Sau khi đọc xong, bạn nên hiểu

- request được auth thế nào,
- config được load thế nào,
- validation hoạt động ra sao,
- response JSON được chuẩn hóa thế nào.

## Giai đoạn 3: Đọc service dễ trước

### Bắt đầu với `user-service`

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
