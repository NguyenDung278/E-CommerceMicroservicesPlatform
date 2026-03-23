# Deep Dive

Thư mục này dành cho việc hiểu hệ thống ở cấp kiến trúc và runtime behavior, trước khi đi xuống từng dòng code.

## Nên đọc theo thứ tự này

1. [system-overview.md](./system-overview.md)
2. [technology-stack.md](./technology-stack.md)
3. [api-gateway.md](./api-gateway.md)
4. [user-service.md](./user-service.md)
5. [product-service.md](./product-service.md)
6. [cart-service.md](./cart-service.md)
7. [order-service.md](./order-service.md)
8. [payment-service.md](./payment-service.md)
9. [notification-service.md](./notification-service.md)

## Mục tiêu của bộ tài liệu này

- hiểu service nào chịu trách nhiệm domain nào
- phân biệt source of truth của từng loại dữ liệu
- nắm được luồng HTTP, gRPC và RabbitMQ
- hiểu vì sao repo dùng nhiều thành phần infra khác nhau

## Tư duy đọc kiến trúc

Mỗi khi mở một file deep-dive, hãy tự trả lời bốn câu:

1. Input vào service là gì
2. Dependency bắt buộc và dependency tùy chọn là gì
3. Dữ liệu được lưu ở đâu
4. Service phát hay consume tín hiệu gì từ service khác

Sau khi trả lời được bốn câu này cho từng service, bạn sẽ đọc source nhanh hơn rất nhiều.
