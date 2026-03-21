# 01. Go Backend Foundations

Tài liệu này giải thích những khái niệm cốt lõi bạn cần nắm để đọc source backend của project này một cách vững vàng.

## 1. Package là gì?

Trong Go, package là đơn vị tổ chức code cơ bản. Một package thường nhóm các file có cùng trách nhiệm.

Ví dụ trong project:

- `handler`: xử lý HTTP hoặc message đầu vào
- `service`: business logic
- `repository`: truy cập DB/Redis
- `model`: entity nội bộ
- `dto`: object cho request/response

### Bạn cần nhớ

- Package không phải folder thuần túy, mà là ranh giới logic.
- Tổ chức package tốt giúp code dễ đọc, dễ test, dễ bảo trì.

## 2. Module là gì?

Go module là đơn vị quản lý dependency. Project này dùng nhiều module:

- `api-gateway`
- từng `service`
- `pkg`
- `proto`

Điều này phản ánh thế giới thật của microservices: mỗi service có thể có dependency riêng.

## 3. `internal` trong Go là gì?

Thư mục `internal` là cơ chế của Go để giới hạn import. Package nằm trong `internal` chỉ được import bởi code ở cùng phạm vi cha.

Ý nghĩa:

- ngăn lộ implementation detail ra ngoài,
- giữ boundary rõ ràng hơn,
- ép người đọc dùng đúng abstraction.

## 4. `context.Context` là gì?

`context.Context` là object đi cùng request để mang theo:

- deadline,
- cancellation signal,
- metadata theo request.

Trong backend Go, bạn gần như luôn truyền `ctx` từ:

- handler
- xuống service
- xuống repository / gRPC client / HTTP client

### Tại sao quan trọng?

Nếu client hủy request hoặc timeout, backend nên dừng các thao tác DB/network tương ứng.

## 5. `defer` dùng để làm gì?

`defer` cho phép hẹn một lệnh chạy ở cuối function. Rất hữu ích cho:

- `rows.Close()`
- `tx.Rollback()`
- `file.Close()`
- `conn.Close()`

### Tư duy đúng

Trong Go backend, `defer` là công cụ giúp cleanup tài nguyên an toàn và dễ đọc.

## 6. Error handling trong Go khác gì nhiều ngôn ngữ khác?

Go không dùng exception làm cơ chế chính. Thay vào đó:

- function trả `value, err`
- caller kiểm tra `if err != nil`

Project này còn dùng:

- `fmt.Errorf("...: %w", err)` để bọc lỗi
- `errors.Is(...)` để kiểm tra loại lỗi

### Tại sao cách này đáng học?

Nó buộc bạn nghĩ rõ:

- lỗi sinh ra ở đâu,
- nên xử lý ở tầng nào,
- và response HTTP nào phù hợp với loại lỗi đó.

## 7. Constructor pattern `NewX(...)`

Trong project này, bạn sẽ thấy nhiều constructor:

- `NewUserService`
- `NewPaymentHandler`
- `NewProductRepository`

Ý nghĩa:

- gom dependency tại một chỗ,
- giúp inject dependency dễ hơn,
- code dễ test hơn.

## 8. Interface trong backend Go dùng để làm gì?

Interface thường được dùng ở ranh giới phụ thuộc.

Ví dụ:

- service phụ thuộc vào repository interface
- không phụ thuộc trực tiếp vào implementation PostgreSQL/Redis

Điều này giúp:

- thay storage dễ hơn,
- test bằng mock/stub dễ hơn,
- code ít coupling hơn.

## 9. Handler, Service, Repository là gì?

### Handler

Nhiệm vụ:

- nhận request,
- bind dữ liệu,
- validate dữ liệu,
- gọi service,
- trả response.

Handler không nên:

- tính tiền,
- kiểm kho,
- viết SQL,
- quyết định business rule phức tạp.

### Service

Nơi chứa business logic.

Service trả lời các câu hỏi như:

- user này có được xem record này không?
- đơn hàng có hợp lệ không?
- cần gọi service nào khác?
- khi nào publish event?

### Repository

Nơi nói chuyện với database hoặc storage.

Repository nên tập trung vào:

- SELECT / INSERT / UPDATE / DELETE
- serialize/deserialize data
- transaction ở mức persistence

## 10. DTO và Model

### DTO

DTO là object cho việc giao tiếp với bên ngoài:

- request body
- response body
- query object

### Model

Model đại diện cho entity nội bộ/domain hoặc dữ liệu DB.

Tách DTO khỏi model giúp:

- API không bị lẫn với cấu trúc DB,
- dễ đổi contract mà không phá domain,
- tránh trả dữ liệu nhạy cảm vô tình.

## 11. Middleware là gì?

Middleware là code chạy quanh handler chính. Trong project này middleware xử lý:

- JWT auth
- role checking
- CORS
- rate limiting
- logging

Middleware rất quan trọng vì nó giúp project tránh duplicate code ở hàng chục handler.

## 12. Transaction là gì?

Transaction đảm bảo một nhóm thao tác DB phải cùng thành công hoặc cùng rollback.

Ví dụ kinh điển trong project:

- tạo `order`
- tạo `order_items`

Nếu chỉ một phần thành công, dữ liệu sẽ sai.

## 13. Event-driven là gì?

Event-driven nghĩa là service không gọi trực tiếp side effect cuối cùng, mà phát sự kiện rồi consumer xử lý tiếp.

Ví dụ trong project:

- `order-service` phát `order.created`
- `payment-service` phát `payment.completed`
- `notification-service` consume các event đó

## 14. Bản chất quan trọng nhất khi đọc backend Go

Khi mở bất kỳ file nào, hãy tự hỏi:

1. Đây là boundary layer hay domain layer?
2. Nó đang nhận input từ đâu?
3. Nó đang tin dữ liệu nào và verify dữ liệu nào?
4. Nó đang gọi dependency nào?
5. Nó đang thay đổi state ở đâu?

Nếu trả lời được 5 câu này, bạn sẽ đọc source backend Go nhanh hơn rất nhiều.
