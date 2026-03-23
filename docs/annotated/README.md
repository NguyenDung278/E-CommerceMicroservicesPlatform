# Annotated Source Reading

Thư mục này dành cho việc đọc source code theo từng block quan trọng. Mục tiêu không phải là diễn giải mọi dòng, mà là:

- chỉ ra những đoạn quyết định flow xử lý,
- giải thích vì sao block đó tồn tại,
- cho bạn biết nên đặt câu hỏi gì khi đọc source thật.

## Cách đọc hiệu quả

1. Mở file markdown annotate tương ứng.
2. Mở source code thật song song trong IDE.
3. Đi theo từng block line number hoặc từng function chính.
4. Tự trace dữ liệu đi qua các layer: `handler -> service -> repository` hoặc `context -> hook -> page`.

## Thứ tự đọc khuyến nghị

1. [shared-packages.md](./shared-packages.md)
2. [api-gateway-main.md](./api-gateway-main.md)
3. [frontend-app.md](./frontend-app.md)
4. [auth-go.md](./auth-go.md)
5. [user-service.md](./user-service.md)
6. [product-service.md](./product-service.md)
7. [cart-service.md](./cart-service.md)
8. [order-service.md](./order-service.md)
9. [payment-service.md](./payment-service.md)
10. [notification-service.md](./notification-service.md)

## File annotate theo module

- [shared-packages.md](./shared-packages.md)
- [frontend-app.md](./frontend-app.md)
- [api-gateway-main.md](./api-gateway-main.md)
- [auth-go.md](./auth-go.md)
- [user-service.md](./user-service.md)
- [product-service.md](./product-service.md)
- [cart-service.md](./cart-service.md)
- [order-service.md](./order-service.md)
- [payment-service.md](./payment-service.md)
- [notification-service.md](./notification-service.md)
- [order-repository.md](./order-repository.md)
- [payment-repository.md](./payment-repository.md)

## File line-by-line sâu hơn

- [line-by-line-auth-go.md](./line-by-line-auth-go.md)
- [line-by-line-order-service.md](./line-by-line-order-service.md)
- [line-by-line-payment-service.md](./line-by-line-payment-service.md)

## Khi nào nên đọc annotate nào

- Sửa auth, role, JWT: bắt đầu từ `shared-packages.md`, `auth-go.md`, `user-service.md`
- Sửa catalog hoặc search: đọc `product-service.md`
- Sửa guest cart hoặc cart merge: đọc `frontend-app.md`, `cart-service.md`
- Sửa order/payment flow: đọc `order-service.md`, `payment-service.md`, `notification-service.md`

## Kết quả mong đợi

Sau khi đọc xong bộ này, bạn nên trả lời được:

- request vào từ đâu,
- business rule nằm ở layer nào,
- source of truth của mỗi domain là gì,
- service nào gọi service nào bằng HTTP, gRPC hoặc RabbitMQ.
