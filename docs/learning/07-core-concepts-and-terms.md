# Core Concepts And Terms

Đây là glossary ngắn để người mới đọc repo không bị ngợp.

## API Gateway

Service nhận request từ frontend rồi forward xuống backend service phù hợp. Trong repo này, gateway chủ yếu là thin proxy chứ không giữ business logic nặng.

## Source of truth

Nơi dữ liệu gốc đáng tin nhất.

- product data: PostgreSQL
- cart state: Redis
- search index: không phải source of truth

## DTO

Data Transfer Object. Đây là struct đại diện request/response giữa HTTP hoặc gRPC layer và service layer.

## Repository

Lớp đọc/ghi dữ liệu. Repository không nên giữ business rule phức tạp, mà chủ yếu làm việc với PostgreSQL hoặc Redis.

## Service layer

Lớp giữ business logic. Ví dụ:

- kiểm tra stock
- tính quote order
- hash password
- quyết định publish event hay không

## gRPC

Protocol RPC nội bộ giữa service với service. Trong repo này, gRPC được dùng chủ yếu để `cart-service` và `order-service` hỏi `product-service`.

## Event-driven flow

Flow mà một service publish event rồi service khác consume bất đồng bộ. Repo dùng RabbitMQ cho notification và payment/order side effects.

## Graceful degradation

Hệ thống vẫn chạy ở mức tối thiểu khi một dependency phụ bị lỗi. Ví dụ `product-service` vẫn có thể chạy core catalog ngay cả khi Elasticsearch hoặc MinIO có vấn đề.

## Graceful shutdown

Service nhận tín hiệu dừng rồi đóng server, worker, trace exporter một cách an toàn thay vì chết ngang.

## Bootstrapping user state

Ở frontend, sau khi có token, ứng dụng gọi API profile để nạp lại thông tin user. Đây là bước bootstrap auth state.

## Guest cart

Giỏ hàng tạm lưu ở client khi người dùng chưa đăng nhập. Sau khi login, frontend sẽ merge guest cart sang server cart.
