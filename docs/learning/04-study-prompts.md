# 04. Bộ prompt để học sâu project này

Tài liệu này cho bạn các prompt để tiếp tục học với AI hoặc tự luyện theo kiểu active learning. Mục tiêu là ép bản thân suy nghĩ và giải thích lại source code, không chỉ đọc thụ động.

## Cách dùng bộ prompt

- Chọn đúng service bạn đang học.
- Mỗi lần chỉ dùng 1 prompt.
- Sau khi đọc câu trả lời, quay lại source code để verify.
- Tự viết lại flow bằng lời của chính bạn.

## 1. Prompt để hiểu kiến trúc

### Prompt 1

```text
Hãy giải thích kiến trúc backend của project này như đang dạy cho một lập trình viên Go mới vào team. Mô tả vai trò của api-gateway, user-service, product-service, cart-service, order-service, payment-service, notification-service và cách chúng nói chuyện với nhau.
```

### Prompt 2

```text
Hãy so sánh trong project này: khi nào dùng HTTP, khi nào dùng gRPC, khi nào dùng RabbitMQ. Giải thích bằng chính các use case có trong source code.
```

## 2. Prompt để học Go backend foundations

### Prompt 3

```text
Dùng project này để giải thích cho tôi: package, module, internal, context.Context, defer, error wrapping, constructor pattern, interface, middleware, DTO, repository pattern.
```

### Prompt 4

```text
Hãy chỉ ra trong project này các ví dụ cụ thể cho từng khái niệm Go backend: context propagation, transaction, dependency injection, JWT middleware, gRPC client, event consumer.
```

## 3. Prompt để đọc theo từng service

### Prompt 5

```text
Hãy deep dive user-service trong project này. Tôi muốn hiểu route, handler, service, repository, migration và auth flow. Giải thích theo kiểu dạy học, không tóm tắt quá ngắn.
```

### Prompt 6

```text
Hãy deep dive product-service trong project này và giải thích vì sao nó phù hợp để học CRUD, pagination, filtering, authorization và gRPC exposure.
```

### Prompt 7

```text
Hãy deep dive cart-service trong project này. Tập trung vào Redis, source of truth, gRPC product client và vì sao backend không tin giá từ frontend.
```

### Prompt 8

```text
Hãy deep dive order-service trong project này. Tôi muốn hiểu transaction, orchestration, stock validation, total price calculation và publish event.
```

### Prompt 9

```text
Hãy deep dive payment-service trong project này. Giải thích kỹ ownership check, order verification, duplicate payment protection và tại sao amount phải được lấy từ backend thay vì client.
```

### Prompt 10

```text
Hãy deep dive notification-service trong project này. Giải thích exchange, queue, routing key, ack/nack, QoS và flow của một worker service viết bằng Go.
```

## 4. Prompt để trace use case end-to-end

### Prompt 11

```text
Hãy trace login flow end-to-end trong project này, bắt đầu từ frontend request đến khi JWT được trả về. Chỉ rõ file nào xử lý bước nào.
```

### Prompt 12

```text
Hãy trace add-to-cart flow end-to-end trong project này. Tôi muốn biết dữ liệu nào đến từ frontend, dữ liệu nào được backend tự lấy, và Redis được dùng ở bước nào.
```

### Prompt 13

```text
Hãy trace create-order flow end-to-end trong project này. Giải thích rõ nơi kiểm tra stock, nơi tính total price, nơi mở transaction và nơi publish event.
```

### Prompt 14

```text
Hãy trace process-payment flow end-to-end trong project này. Tập trung vào trust boundary, authorization, database write và event publishing.
```

## 5. Prompt để luyện tư duy thiết kế

### Prompt 15

```text
Nếu tôi biến project này thành modular monolith thì phần nào có thể gộp lại, phần nào nên giữ tách? Giải thích theo hướng đơn giản hóa nhưng vẫn robust.
```

### Prompt 16

```text
Hãy chỉ ra trong project này những nơi thể hiện rõ separation of concerns. Đồng thời chỉ ra những nơi có thể refactor tiếp để người học dễ đọc hơn.
```

### Prompt 17

```text
Trong project này, đâu là source of truth cho user, product, cart, order, payment? Hãy giải thích bằng mindset backend thực chiến.
```

## 6. Prompt để luyện đọc code cấp độ dòng

### Prompt 18

```text
Hãy giải thích line-by-line file pkg/middleware/auth.go trong project này. Tôi muốn hiểu không chỉ code làm gì mà còn vì sao phải làm như vậy.
```

### Prompt 19

```text
Hãy giải thích line-by-line hàm CreateOrder trong order_service.go. Chỉ rõ đâu là validation, đâu là orchestration, đâu là persistence, đâu là event publishing.
```

### Prompt 20

```text
Hãy giải thích line-by-line hàm ProcessPayment trong payment_service.go và chỉ ra những nguyên tắc bảo mật backend được áp dụng.
```

## 7. Prompt để tự kiểm tra mức hiểu

### Prompt 21

```text
Hãy hỏi tôi 15 câu kiểm tra mức hiểu backend project này, từ cơ bản đến nâng cao, nhưng đừng cho đáp án ngay.
```

### Prompt 22

```text
Hãy đóng vai mentor và kiểm tra xem tôi đã hiểu cart-service hay chưa. Hỏi tôi theo kiểu từng bước, sau đó phân tích điểm tôi trả lời chưa tốt.
```

### Prompt 23

```text
Sau khi tôi giải thích order-service bằng lời của mình, hãy chỉ ra những chỗ hiểu sai, chỗ còn mơ hồ, và cách sửa tư duy cho đúng.
```

## 8. Prompt để luyện viết code theo project style

### Prompt 24

```text
Hãy hướng dẫn tôi thêm một endpoint mới vào project này theo đúng style hiện tại: route, handler, service, repository, DTO, validation, migration nếu cần.
```

### Prompt 25

```text
Hãy đưa cho tôi một bài tập code nhỏ dựa trên project này, ví dụ thêm order cancellation hoặc password reset, nhưng chia nhỏ theo từng bước để tôi tự làm.
```

### Prompt 26

```text
Hãy review đoạn code tôi viết theo đúng style của repo này: ưu tiên bug, security, architecture, readability và Go idioms.
```

## 9. Cách học hiệu quả nhất với bộ prompt này

Mỗi service nên học theo chu kỳ:

1. Đọc deep-dive file của service.
2. Mở source code thật.
3. Dùng 1 prompt trace use case.
4. Tự tóm tắt lại bằng tay.
5. Dùng 1 prompt kiểm tra mức hiểu.
6. Dùng 1 prompt bài tập để tự code thêm.

Nếu bạn lặp chu kỳ này đủ lâu, khả năng đọc source và viết backend Go của bạn sẽ tăng rất rõ.
