# proto

Thư mục `proto/` là nơi định nghĩa contract gRPC dùng chung giữa các service. Đây là **source of truth cho schema inter-service**, còn các file generated như `*.pb.go` và `*_grpc.pb.go` chỉ là mã dẫn xuất từ `.proto`.

## 1. Vai trò của `proto/`

Ở repo này, `proto/` làm ba việc:

1. mô tả dữ liệu trao đổi giữa service với service
2. sinh client/server interface cho gRPC trong Go
3. tạo kiểu dữ liệu dùng chung để order/cart/product/user service có thể giao tiếp mà không phải tự định nghĩa payload riêng

Điểm quan trọng: HTTP handler ở từng service có thể dùng DTO riêng, nhưng khi đi qua gRPC thì payload phải quay về contract trong `proto/`.

---

## 2. Bản đồ thư mục

| File                 | Vai trò                                                |
| -------------------- | ------------------------------------------------------ |
| `product.proto`      | Contract cho Product Service                           |
| `user.proto`         | Contract cho User Service                              |
| `product.pb.go`      | Message struct + getter + proto reflection cho product |
| `product_grpc.pb.go` | Client/server gRPC stub cho product                    |
| `user.pb.go`         | Message struct + getter + proto reflection cho user    |
| `user_grpc.pb.go`    | Client/server gRPC stub cho user                       |
| `go.mod`             | Module Go riêng cho package `proto`                    |

### Quy tắc quan trọng

- **Chỉnh `.proto`, không chỉnh `*.pb.go` bằng tay**.
- Sau khi sửa `.proto`, phải regenerate code.
- File generated có comment `DO NOT EDIT`; hãy tin nó.

---

## 3. Từ `.proto` đi vào code Go như thế nào?

Luồng chuyển hoá hiện tại như sau:

1. Viết schema trong `product.proto` hoặc `user.proto`.
2. Chạy `protoc` + plugin Go để sinh:
   - `*.pb.go`: message type, `GetX()`, `ProtoReflect()`, metadata
   - `*_grpc.pb.go`: client interface, server interface, handler registration, full method name constant
3. Service provider implement server interface generated:
   - Product: `services/product-service/internal/grpc/product_grpc.go`
   - User: `services/user-service/internal/grpc/user_grpc.go`
4. Service consumer tạo client generated:
   - Order/cart gọi `pb.NewProductServiceClient(...)`
5. Shared interceptor trong `pkg/observability/grpc.go` bọc client/server call để propagate trace + request id.

Nói ngắn gọn:

`.proto` -> generated Go type/interface -> service adapter -> business service/repository

---

## 4. Liên kết giữa `proto/` và `pkg/`

Hai thư mục này liên kết với nhau theo các điểm sau:

### 4.1. `pkg/config` cung cấp endpoint gRPC

Trong `pkg/config/config.go`:

- `GRPCConfig.Port` dùng để service mở gRPC server
- `ServicesConfig.ProductServiceGRPC` dùng để service khác dial product-service

### 4.2. `pkg/observability` bọc transport gRPC

Trong `pkg/observability/grpc.go`:

- `GRPCUnaryClientInterceptor(...)` inject trace context và request ID vào metadata outgoing
- `GRPCUnaryServerInterceptor(...)` extract metadata và record status vào span

Điều này làm cho contract trong `proto/` không chỉ là schema dữ liệu, mà còn chạy trong một transport đã được gắn observability chuẩn.

### 4.3. `pkg/response` và `pkg/validation` không dùng trực tiếp ở gRPC layer

Đây là điểm cần nhớ:

- HTTP dùng `pkg/response` và `pkg/validation`
- gRPC dùng `status.Error(...)`, `codes.*` và message generated từ proto

Vì vậy khi mở rộng API nội bộ qua gRPC, đừng cố ép envelope HTTP vào proto một cách cơ học.

---

## 5. Đặc điểm kiến trúc đáng chú ý của module này

### 5.1. Hai proto package khác nhau nhưng chung một Go package

- `product.proto` khai báo `package product;`
- `user.proto` khai báo `package user;`
- nhưng cả hai đều có `option go_package = "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"`

Kết quả là trong Go, toàn bộ generated type nằm chung trong package `proto`.

### Ý nghĩa của lựa chọn này

Ưu điểm:

- consumer chỉ import một package Go là `github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto`

Ràng buộc:

- tên type giữa các file phải tránh trùng nhau trên toàn bộ module Go
- ví dụ không thể có hai message cùng tên `Status` ở hai file khác nhau nếu cùng generate vào một package Go

---

## 6. Giải thích `product.proto`

### 6.1. Mục đích file

`product.proto` mô tả contract gRPC cho Product Service, chủ yếu để service khác:

- lấy thông tin sản phẩm
- cập nhật sản phẩm
- trong tương lai có thể list/search/create/delete qua gRPC

### 6.2. `service ProductService`

RPC được khai báo:

| RPC              | Input                   | Output                   | Ý nghĩa contract              |
| ---------------- | ----------------------- | ------------------------ | ----------------------------- |
| `GetProducts`    | `GetProductsRequest`    | `GetProductsResponse`    | list sản phẩm theo page/limit |
| `GetProductByID` | `GetProductByIDRequest` | `GetProductByIDResponse` | lấy 1 sản phẩm theo id        |
| `CreateProduct`  | `CreateProductRequest`  | `CreateProductResponse`  | tạo sản phẩm                  |
| `UpdateProduct`  | `UpdateProductRequest`  | `UpdateProductResponse`  | cập nhật sản phẩm             |
| `DeleteProduct`  | `DeleteProductRequest`  | `DeleteProductResponse`  | xoá sản phẩm                  |
| `SearchProducts` | `SearchProductsRequest` | `SearchProductsResponse` | search sản phẩm               |

### 6.3. Điều đang xảy ra trong code thực tế

Hiện tại server product trong `services/product-service/internal/grpc/product_grpc.go` **mới implement `GetProductByID` và `UpdateProduct`**.

Vì `ProductGRPCServer` embed `pb.UnimplementedProductServiceServer`, nên các RPC còn lại nếu bị gọi sẽ trả `codes.Unimplemented`.

Đây là điểm rất quan trọng khi bảo trì:

- contract đã khai báo rộng hơn implementation hiện tại
- không nên giả định mọi RPC trong proto đều đã sẵn sàng production

### 6.4. Giải thích từng message

#### `GetProductsRequest`

Field:

- `page`: trang hiện tại
- `limit`: số item/trang
- `category`: filter category
- `sort_by`: tên trường sort

**Lưu ý quan trọng**: đây là offset/page style pagination. Nó khác hướng cursor pagination đang xuất hiện ở HTTP catalog của product-service. Nếu sau này mở rộng gRPC list endpoint, cần quyết định có giữ kiểu cũ hay thêm contract cursor mới.

#### `GetProductsResponse`

- `products`: danh sách sản phẩm
- `total_count`: tổng số item match
- `page`, `limit`: echo lại request context

#### `GetProductByIDRequest`

- `product_id`: khóa chính của sản phẩm

Đây là request được dùng thật trong order-service và cart-service để kiểm tra tính hợp lệ của item.

#### `GetProductByIDResponse`

- `product`: snapshot của sản phẩm

#### `CreateProductRequest`

- `name`, `description`, `category`, `image_url`
- `price`
- `stock_quantity`

**Cảnh báo**: `price` đang là `float`, không lý tưởng cho dữ liệu tiền tệ vì có rủi ro rounding drift.

#### `CreateProductResponse`

- `product`: sản phẩm vừa tạo

#### `UpdateProductRequest`

- `product_id`
- toàn bộ trường sản phẩm còn lại

Đây là message có ý nghĩa kỹ thuật rất lớn:

1. Trong `proto3`, scalar field như `string`, `float`, `int32` **không có presence rõ ràng** nếu không dùng `optional`, wrapper hoặc `oneof`.
2. Vì vậy contract hiện tại gần với mô hình **full replacement snapshot** hơn là patch update.
3. Order Service hiện đang tận dụng RPC này để restore stock khi huỷ đơn: nó đọc snapshot sản phẩm hiện tại rồi gửi lại toàn bộ field với `stock_quantity` mới.

**Rủi ro**: nếu hai caller cùng update theo kiểu read-modify-write, rất dễ ghi đè dữ liệu cũ/stale ngoài ý muốn.

#### `UpdateProductResponse`

- `product`: snapshot sau update

#### `DeleteProductRequest` / `DeleteProductResponse`

- `product_id`: id cần xoá
- `success`: bool kết quả

#### `SearchProductsRequest` / `SearchProductsResponse`

- `query`, `page`, `limit`
- `products`, `total_count`, `page`, `limit`

Hiện chưa thấy implementation gRPC thực tế cho search trong product server.

#### `Product`

Field:

- `id`: id sản phẩm
- `name`, `description`, `category`, `image_url`
- `price`: giá sản phẩm dạng float
- `stock_quantity`: tồn kho dạng int32
- `created_at`, `updated_at`: timestamp dạng string

### Lưu ý schema của `Product`

1. `price` là `float`: tiện ngắn hạn nhưng không đẹp cho money.
2. `created_at`, `updated_at` là `string`: server hiện tại format theo ISO-8601 trong `toProtoProduct(...)`, nhưng contract không ép kiểu mạnh như `google.protobuf.Timestamp`.
3. Nếu muốn nâng cấp, nên **thêm field mới** thay vì đổi type trực tiếp của field cũ.

---

## 7. Giải thích `user.proto`

### 7.1. Mục đích file

`user.proto` mô tả contract gRPC cho User Service. Nó phục vụ cả auth flow (`Register`, `Login`) lẫn user profile lookup/update.

### 7.2. `service UserService`

| RPC             | Input                  | Output                  | Ý nghĩa contract               |
| --------------- | ---------------------- | ----------------------- | ------------------------------ |
| `Register`      | `RegisterRequest`      | `RegisterResponse`      | đăng ký user và nhận token     |
| `Login`         | `LoginRequest`         | `LoginResponse`         | đăng nhập và nhận token        |
| `GetProfile`    | `GetProfileRequest`    | `GetProfileResponse`    | lấy profile user hiện tại      |
| `UpdateProfile` | `UpdateProfileRequest` | `UpdateProfileResponse` | cập nhật profile user hiện tại |
| `GetUserByID`   | `GetUserByIDRequest`   | `GetUserByIDResponse`   | lấy user theo id               |

### 7.3. Tình trạng implementation thực tế

User server trong `services/user-service/internal/grpc/user_grpc.go` đã implement đầy đủ các RPC ở trên.

Tuy nhiên có một điểm cần nhìn rất kỹ:

- `GetProfile` và `UpdateProfile` hiện **không dùng field `user_id` trong request**
- thay vào đó handler đọc `ctx.Value("userID")`
- shared gRPC interceptor trong `pkg/observability/grpc.go` **không set field này**

Điều đó có nghĩa là:

- contract và implementation hiện chưa khớp hoàn toàn về cách xác định current user
- hai RPC này chưa thật sự có auth propagation strategy chuẩn nếu service khác muốn dùng trực tiếp

### 7.4. Giải thích từng message

#### `RegisterRequest`

- `email`
- `password`
- `first_name`
- `last_name`

Request này map khá thẳng vào DTO register trong user-service.

#### `RegisterResponse`

- `token`: access/auth token
- `user`: snapshot user vừa tạo

**Cẩn trọng**: đây là response chứa secret bearer token. Không log raw token ở phía client hay server.

#### `LoginRequest`

- `email`
- `password`

#### `LoginResponse`

- `token`
- `user`

Tương tự `RegisterResponse`, response này phù hợp interactive auth flow hơn là generic internal lookup.

#### `GetProfileRequest`

- `user_id`

Theo nghĩa của schema, field này trông như “profile của user nào”. Nhưng implementation hiện tại lại lấy user id từ context auth, không từ field. Đây là vùng dễ gây hiểu nhầm nhất của `user.proto`.

#### `GetProfileResponse`

- `user`

#### `UpdateProfileRequest`

- `user_id`
- `first_name`
- `last_name`

Một lần nữa, implementation hiện tại ignore `user_id` từ request và đọc từ context.

Ngoài ra, do đây là `proto3`, string field rỗng không phân biệt được giữa:

- caller không gửi field
- caller cố tình muốn set về chuỗi rỗng

Hiện user-service chọn cách map chuỗi rỗng thành `nil` bằng helper `optionalStringPointer(...)` để ngầm hiểu là “không update field đó”. Đây là workaround ở tầng server chứ không phải presence semantics thật sự của schema.

#### `UpdateProfileResponse`

- `user`

#### `GetUserByIDRequest`

- `user_id`

Đây là RPC an toàn và rõ nghĩa nhất cho internal lookup vì server dùng trực tiếp field này.

#### `GetUserByIDResponse`

- `user`

#### `User`

Field:

- `id`
- `email`
- `first_name`
- `last_name`
- `role`
- `created_at`
- `updated_at`

Tương tự product schema, timestamp đang là string chứ không phải `google.protobuf.Timestamp`.

---

## 8. Generated file đang làm gì?

### 8.1. `product.pb.go` và `user.pb.go`

Hai file này chứa:

- struct Go tương ứng với từng `message`
- method chuẩn do `protoc-gen-go` sinh ra:
  - `Reset()`
  - `String()`
  - `ProtoMessage()`
  - `ProtoReflect()`
  - `GetX()` cho từng field
- descriptor metadata dùng cho protobuf runtime

Trong code thực tế, những method quan trọng nhất cho developer thường là:

- `req.GetProductId()`
- `req.GetEmail()`
- `req.GetUserId()`

Chúng giúp đọc field an toàn khi pointer receiver có thể là `nil`.

### 8.2. `product_grpc.pb.go` và `user_grpc.pb.go`

Hai file này chứa:

- constant full method name, ví dụ:
  - `/product.ProductService/GetProductByID`
  - `/user.UserService/GetUserByID`
- `ProductServiceClient`, `UserServiceClient`
- `NewProductServiceClient(...)`, `NewUserServiceClient(...)`
- server interface
- `Unimplemented...Server`
- `Register...Server(...)`
- unary handler wrapper dùng trong runtime gRPC

### Vì sao `Unimplemented...Server` quan trọng?

Server embed struct này sẽ có forward compatibility tốt hơn khi sau này proto thêm RPC mới. Repo hiện đang dùng đúng pattern đó.

---

## 9. Luồng dữ liệu thực tế từ proto vào code

### 9.1. Luồng `Order Service -> Product Service` để lấy sản phẩm

1. Order Service cần báo giá/kiểm tra stock.
2. `services/order-service/internal/grpc_client/product_client.go` tạo `pb.GetProductByIDRequest{ProductId: ...}`.
3. `pb.ProductServiceClient.GetProductByID(...)` gửi request qua gRPC.
4. `pkg/observability.GRPCUnaryClientInterceptor(...)` inject trace/request id.
5. Product Service nhận request qua `pkg/observability.GRPCUnaryServerInterceptor(...)`.
6. `ProductGRPCServer.GetProductByID(...)` gọi service layer domain.
7. Domain model được map sang `pb.Product` bằng `toProtoProduct(...)`.
8. Order Service nhận `pb.Product`, rồi dùng `product.Price`, `product.StockQuantity`, `product.Name` để build order quote.

### 9.2. Luồng `Order Service -> Product Service` để restore stock khi huỷ đơn

1. Order Service gọi `RestoreStock(...)` ở gRPC client wrapper.
2. Wrapper fetch product snapshot hiện tại qua `GetProductByID`.
3. Wrapper tự tính `newStock = currentStock + quantity`.
4. Wrapper gửi `UpdateProductRequest` chứa **toàn bộ field sản phẩm**.
5. Product Service dùng request đó để update.

### Ý nghĩa thiết kế

Giải pháp này tái sử dụng contract có sẵn, nhưng đánh đổi bằng nguy cơ stale overwrite vì không có RPC chuyên biệt kiểu `AdjustStock` hoặc `RestoreStock`.

### 9.3. Luồng `User Service` server map proto sang domain

Ví dụ `Register(...)` trong user gRPC server:

1. nhận `pb.RegisterRequest`
2. map sang `dto.RegisterRequest`
3. gọi `userService.Register(...)`
4. nhận domain model user + token
5. map sang `pb.RegisterResponse`

Đây là pattern chung của gRPC adapter layer trong repo: **proto chỉ là boundary object, service layer vẫn dùng DTO/domain model nội bộ**.

---

## 10. Những ràng buộc kỹ thuật cần giữ khi mở rộng

### 10.1. Không được reuse field number

Trong protobuf, số field mới là identity thật sự trên wire. Nếu xoá field cũ, đừng dùng lại số đó cho nghĩa mới.

### 10.2. Ưu tiên additive change

An toàn nhất là:

- thêm message mới
- thêm field mới với số mới
- thêm RPC mới

Tránh:

- đổi type field cũ
- đổi nghĩa field cũ
- xoá field mà chưa reserve/deprecate strategy

### 10.3. Cẩn thận với proto3 scalar presence

`string`, `int32`, `float`, `bool` ở proto3 không phân biệt rõ “unset” và “zero value” nếu không dùng `optional`, wrapper type hoặc `oneof`.

Điều này đặc biệt quan trọng cho các RPC update.

### 10.4. Không chỉnh generated file bằng tay

Chỉnh `product.pb.go` hoặc `user_grpc.pb.go` trực tiếp sẽ bị mất ở lần regenerate tiếp theo.

### 10.5. Thay đổi `package` hoặc `go_package` là breaking change lớn

Nó ảnh hưởng cả full gRPC method name lẫn đường import Go.

### 10.6. Giữ embed `Unimplemented...Server`

Nếu sau này thêm RPC mới vào service, server nào embed `Unimplemented...Server` sẽ an toàn hơn nhiều so với việc implement “trần”.

---

## 11. Đề xuất cải tiến an toàn

### 11.1. Product contract

1. Thêm RPC chuyên biệt cho stock adjustment (`AdjustStock` hoặc `RestoreStock`) thay vì tái sử dụng `UpdateProduct` kiểu full snapshot.
2. Nếu cần partial update thật sự, dùng `optional`/wrapper/`oneof` cho `UpdateProductRequest`.
3. Cân nhắc thêm field tiền tệ mới kiểu `int64 price_cents` hoặc `string price_decimal`, giữ `price` cũ để compatibility rồi migrate dần.
4. Cân nhắc thêm `google.protobuf.Timestamp` mới cho thời gian, giữ field string cũ trong giai đoạn quá độ.
5. Nếu muốn gRPC list/search được dùng thật, cần implement nốt các RPC đã khai báo hoặc tách contract chưa dùng ra khỏi service hiện tại.

### 11.2. User contract

1. Làm rõ auth model cho `GetProfile` / `UpdateProfile`:
   - hoặc server dùng `request.user_id`
   - hoặc schema đổi sang RPC rõ nghĩa kiểu `GetAuthenticatedProfile` và propagate caller identity qua metadata chuẩn
2. Nếu `RegisterResponse` / `LoginResponse` tiếp tục dùng cho internal service call, phải nhấn mạnh chính sách không log token.
3. Nếu cần partial profile update rõ nghĩa hơn, nên dùng `optional string first_name`, `optional string last_name` hoặc wrapper types.

---

## 12. Checklist trước khi sửa `.proto`

- [ ] Field mới có số mới chưa?
- [ ] Có vô tình đổi nghĩa field cũ không?
- [ ] Có consumer nào đang dùng generated client/server interface này không?
- [ ] Server implementation đã sẵn sàng cho RPC mới chưa?
- [ ] Contract mới có khớp với observability/auth propagation thực tế không?
- [ ] Có cần thêm migration ở domain/service layer tương ứng không?
- [ ] Có cần regenerate code và cập nhật các service consumer/provider không?

---

## 13. Kết luận

`proto/` là lớp contract trung tâm cho giao tiếp nội bộ bằng gRPC. Nó nhỏ nhưng ảnh hưởng rộng vì thay đổi tại đây sẽ lan sang:

- generated Go code
- gRPC client của service consumer
- gRPC server adapter của service provider
- cách trace/request-id được propagate qua `pkg/observability`

Khi mở rộng `proto/`, hãy xem `.proto` là API public giữa các service. Cần ưu tiên additive change, tôn trọng backward compatibility, và luôn kiểm tra xem schema hiện tại có thực sự khớp với implementation hay chỉ mới “khai báo trước” trên giấy.
