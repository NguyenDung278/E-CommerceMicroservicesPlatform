# Hướng dẫn phát triển tính năng mới

Tài liệu này hướng dẫn cách thêm một tính năng backend mới theo đúng cấu trúc và workflow hiện tại của repo, không dùng path cũ như `internal/delivery/http`.

## 1. Bắt đầu từ boundary, không bắt đầu từ code

Trước khi viết gì, hãy xác định feature của bạn thuộc loại nào:

- HTTP API public qua gateway
- HTTP API chỉ dùng nội bộ service
- gRPC contract giữa service
- event publish / consume
- logic nội bộ không lộ ra ngoài

### Vì sao bước này quan trọng

Boundary quyết định:

- file nào cần sửa
- contract nào cần thay đổi
- có phải cập nhật gateway hay không
- có cần migration, config, docs hay test mới không

## 2. Đường đi chuẩn khi thêm feature trong repo này

Với một service chuẩn, bạn sẽ thường động vào:

- `services/<service>/internal/dto/`
- `services/<service>/internal/model/`
- `services/<service>/internal/repository/`
- `services/<service>/internal/service/`
- `services/<service>/internal/handler/`
- `services/<service>/internal/grpc/` nếu có gRPC
- `services/<service>/cmd/main.go`
- `services/<service>/migrations/` nếu schema đổi

Nếu feature phải đi ra ngoài qua gateway:

- `api-gateway/internal/handler/*`
- `api-gateway/cmd/main.go` chỉ để wiring handler/proxy, không phải chỗ nhét business logic

## 3. Ví dụ thực chiến: thêm một API mới cho `product-service`

Giả sử bạn muốn thêm endpoint đọc thông tin tồn kho mở rộng cho sản phẩm.

### Bước 1: Xác định schema và migration nếu cần

Nếu feature cần thêm cột hoặc bảng:

1. tạo migration mới trong `services/product-service/migrations/`
2. cập nhật model hoặc persistence struct liên quan

### Bước 2: Viết repository trước

Ở `services/product-service/internal/repository/`:

- viết query SQL parameterized
- chỉ select cột cần thiết
- scan dữ liệu về model rõ ràng

### Vì sao bắt đầu từ repository

Với feature liên quan DB, repository là nơi giúp bạn kiểm tra ngay:

- query có đúng không
- index có cần không
- dữ liệu trả về có đủ cho business logic không

## 4. Viết service để giữ rule nghiệp vụ

Ở `services/product-service/internal/service/`:

- gọi repository
- validate rule nghiệp vụ
- map lỗi sang domain error có ý nghĩa

### Nguyên tắc

- service không nên nhận `echo.Context`
- service không nên biết HTTP status code
- service là nơi giữ business invariant

## 5. Viết HTTP handler ở đúng chỗ

Trong repo này, HTTP handler nằm ở:

```text
services/<service>/internal/handler/
```

Ví dụ với product:

- `services/product-service/internal/handler/product_handler.go`

### Handler nên làm gì

- bind request
- validate input
- gọi service
- map domain error sang response envelope từ `pkg/response`

### Handler không nên làm gì

- viết SQL
- giữ transaction
- nhồi business rule phức tạp

## 6. Nếu feature là gRPC, sửa ở đâu

### Contract

Proto nằm ở:

- `proto/product.proto`
- `proto/user.proto`

Generated files hiện được commit ngay trong `proto/`:

- `proto/*.pb.go`
- `proto/*_grpc.pb.go`

### Điều rất quan trọng

Repo hiện **không có** target `make proto`. Vì vậy nếu bạn sửa `.proto`, bạn cần dùng workflow `protoc` phù hợp trên máy mình để regenerate các file generated rồi commit chúng cùng thay đổi.

### gRPC implementation

Với service có gRPC server:

- xem `services/product-service/internal/grpc/`
- wiring thường nằm trong `services/<service>/cmd/main.go`

Với service có gRPC client:

- xem `internal/grpc_client/` hoặc package tương đương trong service gọi

## 7. Đăng ký route HTTP trong service

Hầu hết service đăng ký route ngay trong handler bằng hàm `RegisterRoutes(...)`.

Ví dụ:

- `services/product-service/internal/handler/product_handler.go`
- `services/user-service/internal/handler/user_handler.go`

Sau đó `cmd/main.go` gọi:

- tạo handler
- gọi `handler.RegisterRoutes(e, cfg.JWT.Secret)`

### Vì sao nên đọc `cmd/main.go`

Đây là nơi bạn thấy đầy đủ:

- config nào được load
- middleware nào đang được gắn
- feature mới đã được wire vào runtime hay chưa

## 8. Nếu feature cần public qua gateway

Gateway của repo này không phải generic catch-all router. Nó có handler theo domain:

- `api-gateway/internal/handler/user_handler.go`
- `api-gateway/internal/handler/product_handler.go`
- `api-gateway/internal/handler/cart_handler.go`
- `api-gateway/internal/handler/order_handler.go`
- `api-gateway/internal/handler/payment_handler.go`

Vì vậy khi thêm HTTP API public mới:

1. thêm route ở service đích
2. thêm route forward tương ứng ở gateway handler cùng domain
3. đảm bảo `api-gateway/cmd/main.go` vẫn wire đúng handler/proxy

## 9. Nếu feature cần config mới

Khi thêm config runtime:

1. cập nhật `pkg/config`
2. thêm default hợp lý cho local/dev
3. cập nhật file trong `deployments/docker/config/`
4. cập nhật `.env.example` hoặc `.env.local.example` nếu cần
5. cập nhật docs liên quan

## 10. Test và verify

### Tối thiểu nên có

- unit test cho service nếu logic có rule nghiệp vụ
- repository test nếu query/transaction quan trọng
- handler test cho request/response mapping nếu endpoint mới có nhiều edge case

### Verify local

1. chạy `make test`
2. chạy `make vet`
3. nếu có frontend hoặc API contract liên quan, verify qua `curl` hoặc UI
4. nếu route đi qua gateway, test cả gateway path

## 11. Checklist trước khi coi feature là xong

- feature nằm đúng layer `handler -> service -> repository`
- query mới đã nghĩ đến index hoặc performance chưa
- route service và route gateway đã đồng bộ chưa
- docs hoặc README liên quan đã cập nhật chưa
- có điểm nào đang partial hoặc chưa expose hết cho frontend không
- có contract nào ở frontend cần cập nhật normalizer/type không

## 12. Mẹo thực chiến

- bắt đầu bằng feature nhỏ nhưng đi trọn vòng đời: migration -> repo -> service -> handler -> gateway -> test -> docs
- đừng bắt đầu bằng refactor lớn nếu bạn chưa trace xong flow hiện tại
- nếu có thể giải quyết trong service hiện tại, đừng vội đề xuất thêm service mới
