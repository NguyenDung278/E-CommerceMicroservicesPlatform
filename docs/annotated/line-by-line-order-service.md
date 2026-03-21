# Line-by-Line Annotated: `services/order-service/internal/service/order_service.go`

Source gốc: `services/order-service/internal/service/order_service.go`

Tài liệu này đi sát từng cụm dòng quan trọng trong `OrderService`, với mục tiêu giúp bạn hiểu cách một use case nhiều bước được viết trong Go theo phong cách đủ sạch, đủ thực tế và khá gần production mindset.

## Cách đọc file này

1. Mở file source thật cùng lúc.
2. Đọc từng cụm dòng nhỏ.
3. Với mỗi cụm, hỏi lại:
   - đây là validation, orchestration, persistence hay side effect?
   - nếu bước này hỏng thì hệ thống sai ở logic nào?
   - dữ liệu ở bước này đến từ client hay từ source of truth?

## Toàn cảnh của file

`OrderService` là nơi biến "ý định mua hàng" thành "đơn hàng thật".

Flow lớn của `CreateOrder` là:

1. kiểm tra request có item không,
2. tạo order skeleton,
3. với từng item thì gọi product-service để lấy dữ liệu thật,
4. kiểm tra stock,
5. tạo order item và cộng tổng tiền,
6. persist order bằng repository,
7. publish event sau khi persist.

## Dòng 1-20: package và import

Nhìn import là bạn đã thấy file này là use case orchestration:

- có `context` và `time`,
- có `json`,
- có `uuid`,
- có `amqp`,
- có `grpc status codes`,
- có `repository`,
- có `productClient`.

Đây không phải một service CRUD đơn giản. Đây là nơi phối hợp nhiều dependency.

## Dòng 22-28: domain errors

```go
var (
    ErrOrderNotFound      = errors.New("order not found")
    ErrEmptyOrder         = errors.New("order must contain at least one item")
    ErrProductNotFound    = errors.New("product not found")
    ErrProductUnavailable = errors.New("product is unavailable")
    ErrInsufficientStock  = errors.New("insufficient stock")
)
```

### Vì sao phần này rất quan trọng?

Đây là vocabulary của domain order.

Service layer dùng các lỗi này để nói với tầng trên:

- lỗi gì là lỗi nghiệp vụ,
- lỗi gì là lỗi expected,
- lỗi gì handler có thể map sang status code rõ ràng.

### Điều nên học

Trong Go, `errors.New(...)` đơn giản nhưng rất mạnh nếu bạn dùng đúng chỗ và nhất quán.

## Dòng 30-37: `OrderEvent`

```go
type OrderEvent struct {
    OrderID    string  `json:"order_id"`
    UserID     string  `json:"user_id"`
    TotalPrice float64 `json:"total_price"`
    Status     string  `json:"status"`
}
```

### Ý nghĩa

Đây là event contract, không phải DB model.

Một người học backend nên cực kỳ chú ý điểm này:

- model lưu DB có thể rất nhiều field,
- nhưng event chỉ nên chứa field consumer thực sự cần.

### Tư duy thiết kế

Event nên nhỏ, rõ, ổn định. Đừng lôi cả model lớn đi publish nếu không thật sự cần.

## Dòng 39-53: struct `OrderService` và constructor

```go
type OrderService struct {
    repo          repository.OrderRepository
    amqpCh        *amqp.Channel
    log           *zap.Logger
    productClient *grpc_client.ProductClient
}
```

Nhìn dependencies là hiểu service này làm được gì:

- `repo`: nói chuyện với DB,
- `productClient`: nói chuyện với product-service,
- `amqpCh`: phát event,
- `log`: quan sát và debug.

Đây là một cách rất hay để "đọc" trách nhiệm của service thông qua constructor.

## Dòng 55-66: comment trên `CreateOrder`

Comment này nói thẳng bốn bước chính của use case. Đây là một kiểu comment rất tốt:

- không mô tả từng dòng,
- mà mô tả intent của cả hàm.

Khi bạn viết hàm dài hơn 30-40 dòng, kiểu comment flow như này rất hữu ích.

## Dòng 66-69: business validation đầu tiên

```go
if len(req.Items) == 0 {
    return nil, ErrEmptyOrder
}
```

### Tại sao validation này nằm ở service?

Vì đây là business rule, không phải chỉ là hình thức request.

Handler có thể validate JSON format, required field, kiểu dữ liệu.
Nhưng "order phải có ít nhất một item" là quy tắc nghiệp vụ, nên service giữ nó là hợp lý.

### Nếu bỏ bước này?

Hệ thống có thể tạo order rỗng, một trạng thái domain vô nghĩa.

## Dòng 71-78: tạo order skeleton

```go
now := time.Now()
order := &model.Order{
    ID:        uuid.New().String(),
    UserID:    userID,
    Status:    model.OrderStatusPending,
    CreatedAt: now,
    UpdatedAt: now,
}
```

### Vì sao gọi là skeleton?

Vì order đã có:

- identity,
- owner,
- trạng thái,
- timestamp,

nhưng chưa có items và chưa có total.

### Những quyết định đáng học

`uuid.New().String()`:

- cho phép tạo ID tại application layer,
- không phải đợi DB autoincrement mới biết ID.

`StatusPending`:

- khi order vừa tạo, hệ thống chưa thanh toán xong,
- nên trạng thái mặc định phải phản ánh thực tế business.

`CreatedAt` và `UpdatedAt`:

- được set cùng lúc khi tạo mới,
- đây là pattern rất phổ biến.

## Dòng 80-82: bắt đầu build item và total

```go
var totalPrice float64
for _, item := range req.Items {
```

`totalPrice` là state được tích lũy trong suốt vòng lặp.

Đây là dấu hiệu cho thấy hàm đang thực hiện orchestration:

- mỗi item được xử lý riêng,
- kết quả từng item góp vào kết quả cuối cùng của order.

## Dòng 83-85: gọi product-service

```go
product, err := s.productClient.GetProduct(ctx, item.ProductID)
```

### Đây là dòng cực kỳ quan trọng

Service không dùng giá hay stock do frontend gửi lên.

Nó chủ động hỏi product-service:

- product có tồn tại không,
- giá hiện tại là bao nhiêu,
- stock hiện tại còn bao nhiêu.

### Bài học lớn

Trong backend, frontend chỉ nên gửi:

- product ID,
- quantity,
- và ý định mua.

Backend phải tự lấy dữ liệu thật từ source of truth.

## Dòng 86-95: map lỗi gRPC

```go
if err != nil {
    switch grpcstatus.Code(err) {
    case codes.NotFound:
        return nil, fmt.Errorf("%w: %s", ErrProductNotFound, item.ProductID)
    case codes.InvalidArgument:
        return nil, fmt.Errorf("%w: %s", ErrProductUnavailable, item.ProductID)
    default:
        return nil, fmt.Errorf("failed to fetch product %s: %w", item.ProductID, err)
    }
}
```

### Vì sao đoạn này rất đáng học?

Nó là ví dụ rất đẹp về boundary translation:

- tầng transport gRPC có cách biểu diễn lỗi riêng,
- service layer chuyển nó thành ngôn ngữ domain của order.

### Phân tích từng nhánh

`codes.NotFound`:

- product ID không tồn tại,
- order không thể được tạo.

`codes.InvalidArgument`:

- product tồn tại nhưng trạng thái không hợp lệ cho use case hiện tại,
- ví dụ bị unavailable.

`default`:

- vẫn giữ thêm context `"failed to fetch product ..."`,
- đồng thời wrap lỗi gốc để không mất thông tin debug.

### Đây là chỗ rất nên học về `%w`

`fmt.Errorf("%w", err)` cho phép tầng trên dùng `errors.Is` hoặc `errors.As` sau này.

## Dòng 97-100: stock validation

```go
if product.StockQuantity < int32(item.Quantity) {
    return nil, fmt.Errorf("%w: product %s only has %d item(s)",
        ErrInsufficientStock, product.Name, product.StockQuantity)
}
```

### Ý nghĩa domain

User muốn mua nhiều hơn tồn kho thực tế, nên order bị từ chối.

### Vì sao dùng `int32(item.Quantity)`?

Vì `StockQuantity` từ gRPC product object đang là `int32`.

Khi đọc source Go, bạn nên chú ý những cast kiểu dữ liệu như thế này. Chúng thường phản ánh:

- contract của proto,
- hoặc contract giữa các service.

### Điều đáng học

Thông báo lỗi vừa giữ lỗi gốc `ErrInsufficientStock`, vừa thêm context cụ thể để debug dễ hơn.

## Dòng 102-111: tạo `OrderItem` và cộng tiền

```go
orderItem := model.OrderItem{
    ID:        uuid.New().String(),
    OrderID:   order.ID,
    ProductID: item.ProductID,
    Name:      product.Name,
    Price:     float64(product.Price),
    Quantity:  item.Quantity,
}
order.Items = append(order.Items, orderItem)
totalPrice += float64(product.Price) * float64(item.Quantity)
```

### Tại sao snapshot `Name` và `Price` vào order item?

Vì order là dữ liệu lịch sử tại thời điểm mua.

Nếu sau này product đổi tên hoặc đổi giá, đơn hàng cũ vẫn phải phản ánh giá lúc đặt.

Đây là một bài học rất thực tế về domain modeling.

### Vì sao cộng `totalPrice` ở đây thay vì để DB tự tính?

Vì service đang sở hữu business flow tạo order, nên nó tính tổng tiền từ dữ liệu xác thực được.

Điều này làm logic:

- dễ test hơn,
- rõ hơn,
- không phụ thuộc vào client.

## Dòng 113: gán total cho order

```go
order.TotalPrice = totalPrice
```

Một dòng ngắn nhưng là điểm kết thúc giai đoạn “build aggregate in memory”.

Trước dòng này:

- order chưa đầy đủ.

Sau dòng này:

- order object đã đủ dữ liệu để persist.

## Dòng 115-118: persist qua repository

```go
if err := s.repo.Create(ctx, order); err != nil {
    return nil, err
}
```

### Điều nên đọc ra ở đây

Service không tự viết SQL. Nó giao trách nhiệm đó cho repository.

Đây là separation of concerns rất chuẩn:

- service quyết định “phải lưu cái gì”,
- repository quyết định “lưu bằng SQL như thế nào”.

### Điều nên học

Một use case nhiều bước nên dừng ở service layer trước khi đi vào persistence layer, thay vì nhét SQL trực tiếp trong service.

## Dòng 120-123: publish sau commit

```go
s.publishOrderEvent(order)
```

### Vì sao publish sau khi `repo.Create` thành công?

Vì sự thật business phải được persist trước.

Nếu publish trước rồi DB fail:

- consumer sẽ nghĩ order đã tồn tại,
- nhưng thực tế DB không có.

Đây là inconsistency rất nguy hiểm.

### Điểm trade-off

Project hiện chọn:

- persist là bắt buộc,
- publish là side effect quan trọng nhưng không rollback order nếu publish lỗi.

Đây là lựa chọn đơn giản và thực tế, dù chưa phải outbox pattern hoàn chỉnh.

## Dòng 128-140: `GetOrder`

```go
order, err := s.repo.GetByID(ctx, orderID)
...
if order.UserID != userID {
    return nil, ErrOrderNotFound
}
```

### Vì sao đoạn này rất quan trọng?

Vì có JWT hợp lệ chưa đủ.

User A không được xem order của user B.

### Tại sao trả `ErrOrderNotFound` thay vì `forbidden`?

Đây là một kỹ thuật khá phổ biến để không xác nhận sự tồn tại của record không thuộc quyền truy cập.

Nó giảm rò rỉ thông tin:

- attacker không biết order đó có thật hay không,
- chỉ biết mình không lấy được dữ liệu.

## Dòng 143-145: `GetUserOrders`

```go
return s.repo.GetByUserID(ctx, userID)
```

Một dòng rất ngắn nhưng thể hiện nguyên tắc tốt:

- nếu use case đơn giản, service không cần cố "làm màu" thêm nhiều logic.

Code gọn khi business rule gọn là một dấu hiệu tốt.

## Dòng 147-156: `UpdateStatus`

```go
order, err := s.repo.GetByID(ctx, orderID)
...
return s.repo.UpdateStatus(ctx, orderID, status)
```

### Tại sao check existence trước?

Để trả lỗi domain có nghĩa hơn.

Nếu update thẳng rồi không biết record có tồn tại không, error semantics sẽ kém rõ ràng hơn.

### Đây là pattern gì?

Read-before-write validation.

Nó khá phổ biến khi business cần chắc record tồn tại trước khi đổi trạng thái.

## Dòng 158-163: đầu hàm `publishOrderEvent`

```go
if s.amqpCh == nil {
    s.log.Warn("RabbitMQ channel not available, skipping event publish")
    return
}
```

### Đây là defensive programming

Service chấp nhận trường hợp broker chưa sẵn sàng hoặc môi trường không có RabbitMQ.

Thay vì panic, nó log warning rồi bỏ qua.

### Điều nên suy nghĩ

Đây là lựa chọn phù hợp với demo/simple production path, nhưng nếu hệ thống cần reliability cao hơn, bạn sẽ học tiếp outbox pattern.

## Dòng 165-170: build `OrderEvent`

```go
event := OrderEvent{
    OrderID:    order.ID,
    UserID:     order.UserID,
    TotalPrice: order.TotalPrice,
    Status:     string(order.Status),
}
```

Đây là bước chuyển từ domain model sang event contract.

Rất đáng học vì nó cho thấy:

- không phải cứ có model là publish nguyên model,
- service cần chủ động chọn dữ liệu nào được public ra event bus.

## Dòng 172-176: JSON marshal

```go
body, err := json.Marshal(event)
if err != nil {
    s.log.Error("failed to marshal order event", zap.Error(err))
    return
}
```

Marshal lỗi là lỗi hạ tầng/serialization. Service log rồi dừng publish.

Điều đáng học:

- side effect thất bại không luôn đồng nghĩa phải fail toàn bộ use case đã persist xong.

## Dòng 178-179: timeout context

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
```

### Vì sao tạo context mới thay vì dùng `ctx` của request?

Request ban đầu có thể đã gần timeout hoặc đã bị cancel. Service muốn side effect publish có một khoảng thời gian nhỏ, độc lập, có kiểm soát.

Đây là một quyết định đáng học. Nó cho thấy tác giả đã nghĩ về lifetime của side effect sau request.

## Dòng 181-202: retry publish

```go
for attempt := 0; attempt < 3; attempt++ {
    err = s.amqpCh.PublishWithContext(ctx, ...)
    if err == nil {
        ...
        return
    }
    time.Sleep(time.Duration(attempt+1) * 150 * time.Millisecond)
}
```

### Vì sao retry?

Broker hoặc network có thể lỗi thoáng qua.

### Vì sao sleep tăng dần?

Đây là một dạng backoff đơn giản để:

- không bắn dồn dập liên tục,
- cho hạ tầng một khoảng nghỉ ngắn để hồi phục.

### Điều nên học

Không phải retry nào cũng phải phức tạp. Một bounded retry ngắn, rõ ràng, đôi khi là lựa chọn đơn giản nhưng hữu ích.

## Dòng 204: log lỗi cuối cùng

```go
s.log.Error("failed to publish order event", zap.Error(err))
```

Đây là điểm cuối của side effect flow.

Nếu mọi retry đều fail:

- service không panic,
- không rollback order,
- nhưng phải để lại dấu vết đủ rõ cho operator.

Đây là operational mindset.

## Dòng 207-223: `SetupExchange`

```go
err := ch.ExchangeDeclare(
    "events",
    "topic",
    true,
    false,
    false,
    false,
    nil,
)
```

### Điều cần hiểu

`events`:

- là exchange name.

`topic`:

- cho phép route theo routing key linh hoạt hơn direct exchange.

`true` ở vị trí durable:

- exchange sẽ bền hơn qua restart của broker.

### Vì sao đoạn này đáng học?

Nó là cầu nối giữa code Go và hạ tầng messaging. Đọc được nó nghĩa là bạn bắt đầu chạm vào distributed system mindset.

## Những bài học lớn nên rút ra từ file này

1. Service layer là nơi orchestration mạnh nhất.
2. Dữ liệu tiền và tồn kho phải đến từ source of truth.
3. Business validation nên nằm ở service nếu nó là quy tắc domain.
4. Persist trước, side effect sau là một nguyên tắc rất quan trọng.
5. Authorization đúng không chỉ là có JWT, mà còn là ownership check.

## Tự kiểm tra sau khi đọc

1. Nếu frontend gửi luôn `price`, vì sao order-service vẫn không nên tin?
2. Vì sao cần snapshot giá vào `OrderItem`?
3. Vì sao `GetOrder` phải check `order.UserID != userID`?
4. Vì sao publish event không diễn ra trước `repo.Create`?
5. Nếu cần reliability cao hơn cho event, bạn sẽ học thêm pattern nào?
