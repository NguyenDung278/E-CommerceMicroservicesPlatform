# Annotated: `services/order-service/internal/service/order_service.go`

Source gốc: `services/order-service/internal/service/order_service.go`

## 1. Vì sao file này là "must-read"?

Nếu bạn chỉ chọn một file để học backend Go thực chiến trong project này, mình sẽ chọn file này.

Nó gom gần như đủ các chủ đề quan trọng:

- business orchestration,
- validate input ở service layer,
- gọi service khác qua gRPC,
- kiểm tra stock,
- tính total price,
- tạo domain object,
- persist bằng repository transaction,
- publish event sau khi commit,
- ownership check khi đọc dữ liệu.

Đây là một file cực tốt để học cách một use case nhiều bước được tổ chức trong Go.

## 2. Vai trò của file

`OrderService` là trái tim của nghiệp vụ đặt hàng.

Nó nhận yêu cầu "người dùng muốn mua những item này" và biến yêu cầu đó thành:

- một `Order` hợp lệ,
- nhiều `OrderItem`,
- tổng tiền đúng,
- dữ liệu được lưu an toàn,
- event được phát ra cho các hệ thống khác.

## 3. Annotate theo block dòng

### Dòng 3-20: import

Block import cho bạn thấy file này đang phối hợp nhiều loại việc:

- `context`, `time` cho lifetime và timeout,
- `encoding/json` cho event payload,
- `errors`, `fmt` cho error handling,
- `uuid` cho ID,
- `amqp` cho RabbitMQ,
- `zap` cho logging,
- `grpc/codes` và `status` để map lỗi gRPC,
- `dto`, `grpc_client`, `model`, `repository` cho domain nội bộ.

Nhìn import là biết ngay: đây không phải CRUD đơn giản, mà là orchestration file.

### Dòng 22-28: business errors

Đây là các domain error quan trọng:

- order không tồn tại,
- order rỗng,
- product không tồn tại,
- product không còn hợp lệ,
- thiếu stock.

Điều đáng học:

- service layer nên định nghĩa rõ vocabulary lỗi của domain,
- handler sẽ dựa vào đó để trả đúng HTTP status.

### Dòng 30-37: `OrderEvent`

Đây là payload được publish sang RabbitMQ.

Điều cần hiểu:

- event không phải model DB,
- event là dữ liệu tối thiểu mà downstream service cần biết.

Đây là tư duy quan trọng khi làm event-driven system:

- không publish cả thế giới,
- chỉ publish dữ liệu cần thiết cho consumer.

### Dòng 39-53: struct và constructor

`OrderService` có 4 dependency:

- `repo`
- `amqpCh`
- `log`
- `productClient`

Từ đây bạn rút ra được vai trò của service:

- cần DB qua repository,
- cần gọi product-service qua gRPC,
- cần log,
- cần publish event.

Đây là một "dependency signature" rất giàu ý nghĩa.

### Dòng 55-69: đầu hàm `CreateOrder`

```go
if len(req.Items) == 0 {
    return nil, ErrEmptyOrder
}
```

Đây là business validation đầu tiên.

Ý nghĩa:

- một order không thể tồn tại nếu không có item,
- validation này thuộc domain nên đặt ở service là hợp lý.

Đây là điều người học rất hay nhầm:

- không phải validation nào cũng ở handler,
- business validation nên nằm ở service để dù gọi từ HTTP hay từ nơi khác vẫn đúng.

### Dòng 71-78: khởi tạo `Order`

Service tạo object order ngay từ đầu:

- sinh `ID`,
- gắn `UserID`,
- set `Status` mặc định là `pending`,
- set timestamp.

Tại sao nên tạo `Order` sớm?

- để tất cả item phía sau đều gắn cùng `order.ID`,
- giúp flow build object rõ ràng hơn.

### Dòng 80-112: vòng lặp xử lý từng item

Đây là phần giàu kiến thức nhất của hàm.

#### Dòng 85: gọi product-service bằng gRPC

```go
product, err := s.productClient.GetProduct(ctx, item.ProductID)
```

Tại sao không tin dữ liệu giá từ client?

- client có thể sửa request,
- giá và stock phải đến từ source of truth của product-service.

Đây là một nguyên tắc backend cực kỳ quan trọng:

> Dữ liệu ảnh hưởng tiền bạc hoặc tồn kho không được tin từ frontend.

#### Dòng 87-94: map lỗi gRPC sang lỗi domain

Service không trả thẳng lỗi gRPC ra ngoài.

Nó đọc `grpcstatus.Code(err)` rồi map:

- `NotFound` -> `ErrProductNotFound`
- `InvalidArgument` -> `ErrProductUnavailable`
- còn lại -> lỗi hệ thống chung hơn

Điều nên học:

- service boundary không nên làm rò rỉ chi tiết transport layer quá mức,
- tầng service nên chuyển lỗi hạ tầng thành ngôn ngữ domain dễ hiểu hơn.

#### Dòng 97-100: check stock

```go
if product.StockQuantity < int32(item.Quantity) {
    return nil, fmt.Errorf("%w: product %s only has %d item(s)", ...)
}
```

Đây là business rule rất thực tế:

- order không được tạo nếu stock không đủ.

Điểm hay:

- lỗi được wrap với context cụ thể hơn,
- vẫn giữ được lỗi gốc `ErrInsufficientStock`.

Đây là chỗ rất đáng học về `fmt.Errorf("%w", err)` trong Go.

#### Dòng 102-111: tạo `OrderItem` và cộng total

Mỗi item được chuyển thành `model.OrderItem`.

Các field quan trọng:

- `OrderID`
- `ProductID`
- `Name`
- `Price`
- `Quantity`

Sau đó:

```go
totalPrice += float64(product.Price) * float64(item.Quantity)
```

Đây là nơi source of truth về giá được dùng để tính tiền thật.

Điều nên học:

- total price không đến từ client,
- order item nên snapshot lại tên và giá tại thời điểm đặt hàng.

### Dòng 113-118: persist order

```go
order.TotalPrice = totalPrice
if err := s.repo.Create(ctx, order); err != nil {
    return nil, err
}
```

Service hoàn tất domain object rồi mới persist.

Repository phía dưới dùng transaction để:

- insert order,
- insert order_items,
- commit cùng nhau.

Đây là nơi bạn nên nối việc đọc file này với `order_repository.go`.

### Dòng 120-125: publish event sau commit

```go
s.publishOrderEvent(order)
return order, nil
```

Điểm tư duy rất hay:

- lưu DB là bước bắt buộc,
- publish event là side effect quan trọng nhưng không làm fail cả order nếu publish lỗi.

Phiên bản hiện tại cũng đã tốt hơn kiểu fire-and-forget goroutine trước đó vì nó có retry ngắn.

Đây là điểm rất đáng học về trade-off:

- đơn giản,
- robust hơn trước,
- nhưng vẫn chưa phải outbox pattern hoàn chỉnh.

### Dòng 128-140: `GetOrder`

Đây là đoạn nhỏ nhưng rất quan trọng về security.

Flow:

1. Lấy order theo ID.
2. Nếu không có thì `ErrOrderNotFound`.
3. Nếu có nhưng `order.UserID != userID` thì cũng trả `ErrOrderNotFound`.

Tại sao không trả `forbidden` ở đây?

- để tránh lộ việc record đó có tồn tại hay không,
- đồng thời đơn giản hóa semantics ở layer ngoài.

Đây là record-level authorization.

### Dòng 143-155: `GetUserOrders` và `UpdateStatus`

`GetUserOrders` đơn giản vì query theo `userID`.

`UpdateStatus` cho thấy một pattern phổ biến:

- check existence trước,
- sau đó update.

Đây là cách service đảm bảo lỗi trả ra có nghĩa hơn.

### Dòng 158-205: `publishOrderEvent`

Đây là phần hạ tầng nhưng cực nên học.

#### Dòng 160-163: check dependency

Nếu không có `amqpCh`, service log warning và bỏ qua.

Điều này cho thấy service chấp nhận degraded mode ở phần async side effect.

#### Dòng 165-170: build event payload

Service không publish trực tiếp `order` model đầy đủ. Nó tạo `OrderEvent`.

Đây là event contract.

#### Dòng 172-176: marshal JSON

Event phải được serialize trước khi publish.

Nếu marshal lỗi, service log rồi dừng publish.

#### Dòng 178-179: timeout context

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
```

Tại sao cần timeout?

- tránh publish bị treo quá lâu,
- tránh side effect async làm giữ tài nguyên vô hạn.

Đây là bài học rất quan trọng về `context` trong Go.

#### Dòng 181-202: retry publish

Service retry tối đa 3 lần, mỗi lần sleep tăng dần.

Đây là một dạng retry đơn giản, chưa phải exponential backoff đầy đủ, nhưng rất dễ hiểu và thực dụng.

Điều nên học:

- không phải lỗi tạm thời nào cũng cần bỏ cuộc ngay,
- retry ngắn có thể tăng độ ổn định đáng kể.

### Dòng 207-223: `SetupExchange`

Đây là phần chuẩn bị RabbitMQ exchange.

Ý nghĩa:

- tên exchange là `events`,
- type là `topic`,
- durable để exchange tồn tại bền hơn.

Đây là cửa để bạn học khái niệm:

- exchange
- routing key
- durable
- topic routing

## 4. Những tư duy rất đáng học từ file này

- Use case phức tạp nên được tổ chức thành từng bước rõ ràng.
- Service là nơi orchestration mạnh nhất.
- Dữ liệu tiền và stock phải lấy từ source of truth.
- Authorization không dừng ở JWT, mà còn phải kiểm tra ownership.
- Event publish nên được làm cẩn thận, không cẩu thả.

## 5. Sau file này bạn nên đọc tiếp gì?

1. `services/order-service/internal/repository/order_repository.go`
2. `services/order-service/internal/grpc_client/product_client.go`
3. `services/order-service/internal/handler/order_handler.go`

## 6. Câu hỏi tự kiểm tra

1. Vì sao `CreateOrder` phải gọi product-service thay vì tin dữ liệu từ client?
2. Vì sao validation "order rỗng" đặt ở service là hợp lý?
3. Vì sao `GetOrder` còn phải check `order.UserID == userID`?
4. Vì sao publish event được làm sau khi persist DB?
5. Nếu bạn muốn chắc chắn không mất event, bạn sẽ phải học thêm pattern nào?
