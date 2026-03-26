# Hướng dẫn Phát triển tính năng mới (How to add a new feature)

Khi đã nắm được kiến trúc ở mức tổng quan, bước tiếp theo của bạn là thử tay trực tiếp vào việc lập trình. 
Tài liệu này sẽ hướng dẫn step-by-step cách thêm 1 API mới vào nền tảng.

> Ví dụ: Chúng ta sẽ tạo một API Lấy chi tiết thông tin kho trong `product-service` và public nó ra ngoài thông qua `api-gateway`.

## Bước 1: Khai báo Contract trong `proto/` (Nếu là gRPC)
Hệ thống sử dụng Protocol Buffers làm nguồn chân lý cho các service kết nối với nhau.
1. Mở file `proto/product.proto`.
2. Định nghĩa message Request và Response.
3. Thêm hàm RPC vào trong `service ProductService { ... }`.
4. Rời khỏi file và chạy lệnh sinh code Go:
   ```bash
   make proto
   ```
   (Lệnh này sẽ tự động sinh/cập nhật code ở `pkg/grpc/pb/product.pb.go`).

## Bước 2: Thiết kế Database và Cập nhật Entity
1. Mở file `.sql` trong folder `services/product-service/migrations/`.
2. Nếu thêm bảng hoặc thêm cột, viết SQL nguyên thuỷ (`CREATE TABLE...`, `ALTER TABLE...`).
3. Trong code Go, tìm đến file định nghĩa struct (vd: `services/product-service/internal/repository/product.go` hoặc folder `domain/`).
4. Khai báo struct tương ứng ở Go.

## Bước 3: Viết Repository (Tương tác Database)
1. Mở file thư mục `repository` của service đó.
2. Viết câu query raw SQL (`SELECT`, `INSERT`, `UPDATE`), dùng biến truyền chuẩn (vd: `$1, $2`) để chống SQL Injection.
3. Nhớ ánh xạ (scan) kết quả từ SQL row trở lại struct Go.

## Bước 4: Viết Service Logic (Business Logic)
1. Thêm hàm vào tầng Service (`internal/service`).
2. Tầng này sẽ gọi Repository để lấy dữ liệu, áp dụng các tính toán logic (kiểm tra điều kiện, xử lý lỗi, v.v.).
3. Nếu cần ném lỗi, hãy tự throw các lỗi rõ ràng để controller ở trên bắt và phản hồi.

## Bước 5: Viết HTTP Controller / gRPC Handler
Nếu tính năng này cung cấp API RESTful cho Frontend ngoài cùng:
1. Vào mục `internal/delivery/http` của `product-service`.
2. Định nghĩa hàm xử lý HTTP (sử dụng [Echo framework](https://echo.labstack.com/)).
3. Validate Payload từ Frontend (Dùng `pkg/validation`).
4. Nếu hợp lệ, gọi xuống tầng Service ở **Bước 4**.
5. Đóng gói kết quả bằng format chuẩn qua `pkg/response`.

Nếu tính năng này là gọi ngầm gRPC (vd: Cart gọi tới Product):
- Sửa file `internal/delivery/grpc/handler.go` và implements hàm Interface đã sinh ra ở Bước 1.

## Bước 6: Route và API Gateway
Gắn endpoint của bạn vào App:
1. Khai báo route (Vd: `e.GET("/api/v1/products/:id/stock", handler.GetStock)`) trong router file của service đó (`api.go` hay `router.go`).
2. Mở `api-gateway/main.go`. Khai báo reverse proxy route ánh xạ đường dẫn từ Gateway vào thẳng Service đích của bạn.

## Bước 7: Chạy và Test local
Dùng Terminal hoặc Postman để gọi thẳng vào localhost xem kết quả.
```bash
make compose-up
```
Thử gọi API mới của bạn thông qua `localhost:8080/api/...`

Chúc bạn thành công với API đầu tiên!
