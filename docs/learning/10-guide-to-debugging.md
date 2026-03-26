# Hướng dẫn Gỡ lỗi (Debugging & Troubleshooting)

Khi chạy hệ thống Microservices qua Docker, việc truy vết lỗi sẽ có đôi chút phức tạp hơn chạy 1 server monolithic đơn lẻ. Dưới đây là các kỹ năng và chiêu giúp bạn debug khoanh vùng lỗi.

## 1. Tìm lỗi qua Logs
Log là công cụ quan trọng nhất. Tất cả các service này đều xuất log theo chuẩn JSON thông qua thư viện `zap`.

**Làm sao để xem Log?**
```bash
# Xem log của mọi microservices đang chạy trong compose
docker compose -f deployments/docker/docker-compose.yml logs -f

# Chỉ xem log của một service cụ thể (vd: order-service)
docker compose -f deployments/docker/docker-compose.yml logs -f order-service
```
Dấu hiệu nhận biết lỗi: Tìm từ khoá `"level":"error"` hoặc HTTP Status `500`. Cấu trúc chuẩn log sẽ bắn kèm `caller` (dòng code sinh ra lỗi) giúp bạn nhảy thẳng đến vị trí file trong IDE.

## 2. Tìm lỗi với Jaeger (Distributed Tracing)
Khi API Gateway trả 500, nhưng bạn không rõ lỗi sâu bên trong là service nào đang gây ra.
1. Hãy mở Jaeger UI (được cung cấp sẵn nếu chạy Full stack qua docker-compose): Truy cập `http://localhost:16686`.
2. Chọn Service là `api-gateway` và nhấn **Find Traces**.
3. Ở Traces view, bạn sẽ thấy đồ thị request đi từ `api-gateway` -> `cart-service` -> `product-service`. 
4. Node nào hiện màu đỏ chính là Node gây ra lỗi. Bạn click vào đó để xem lỗi cụ thể (Tags/Logs của trace).

## 3. Lỗi 500: Database Connection/Migration
Một lỗi rất phổ biến khi lần đầu chạy hoặc vừa thêm tính năng là quên chạy SQL Migration.
- Dấu hiệu: Log có dòng dạng `relation "table_name" does not exist`.
- Cách fix: Bạn có thể chạy ép Migration chạy lại bằng `make migrate-up`.

## 4. Chạy debug từng dòng code (Breakpoint via VSCode/GoLand)
Nếu bạn không muốn xem Log qua Docker mà muốn đặt Breakpoint cho một service, bạn có thể:
1. Dập tắt container của service đó (vd: `docker stop docker-user-service-1`).
2. Sửa file `.env` local của bạn để trỏ tới database host (vì DB Postgres đang nằm trong Docker, bạn phải trỏ là `localhost` thay vì `postgres` trong docker network).
3. Ấn F5 trên file `main.go` của service đó bằng VSCode hoặc GoLand chạy ở chế độ Debug local.
4. Lợi ích: DB/Redis/RabbitMQ vẫn nằm trong Docker, nhưng Service logic chạy ngay trên máy host Macbook của bạn. Dễ dàng F10, F11 từng dòng code!

## 5. Dùng Postman / cURL để thu hẹp phạm vi
Luôn chia để trị.
- Thay vì test toàn bộ luồng từ UI Frontend.
- Hãy mở Postman bắn trực tiếp vào Port của Service đó (không qua Gateway) để xem service đó sống và trả data đúng định dạng chưa.
- Lệnh cURL rất có tác dụng ở đây, hầu hết file `README.md` từng service đều có sẵn sample request.
