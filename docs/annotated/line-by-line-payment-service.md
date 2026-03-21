# Line-by-Line Annotated: `services/payment-service/internal/service/payment_service.go`

Source gốc: `services/payment-service/internal/service/payment_service.go`

Tài liệu này tập trung vào cách đọc `PaymentService` bằng security mindset. Mục tiêu không chỉ là hiểu flow chạy thế nào, mà còn hiểu vì sao các lớp bảo vệ được đặt đúng chỗ.

## Cách đọc file này

Khi đọc `payment_service.go`, bạn nên luôn giữ 3 câu hỏi trong đầu:

1. Dữ liệu nào trong flow này có thể bị client giả mạo?
2. Ở bước nào service đang kiểm tra quyền sở hữu dữ liệu?
3. Ở bước nào service đang chống race condition hoặc duplicate?

Nếu bạn giữ được 3 câu hỏi này, bạn sẽ học được rất nhiều từ file này.

## Toàn cảnh của file

`PaymentService` làm 4 việc chính:

1. kiểm tra payment trùng,
2. verify order thật từ `order-service`,
3. tạo payment với amount lấy từ backend,
4. publish event sau khi persist.

File này đáng học vì nó thể hiện rất rõ ranh giới giữa:

- input do client gửi,
- dữ liệu thật do backend tự xác minh,
- và dữ liệu nhạy cảm không được tin từ frontend.

## Dòng 1-18: package và import

Import của file cho bạn thấy ngay bản chất của use case:

- có `context`, `time`, `errors`,
- có `json`,
- có `uuid`,
- có `pq` để hiểu lỗi PostgreSQL,
- có `amqp` để publish event,
- có `client` để gọi order-service,
- có `repository` để ghi payment.

Chỉ nhìn import là đã thấy file này là giao điểm của:

- business rule,
- security,
- database,
- inter-service communication,
- async event.

## Dòng 20-27: `PaymentEvent`

```go
type PaymentEvent struct {
    PaymentID string  `json:"payment_id"`
    OrderID   string  `json:"order_id"`
    UserID    string  `json:"user_id"`
    Amount    float64 `json:"amount"`
    Status    string  `json:"status"`
}
```

Đây là dữ liệu được công bố cho thế giới bên ngoài payment-service.

Bạn nên đọc nó với câu hỏi:

- consumer thực sự cần biết gì sau một payment?

Việc event chỉ mang những field cốt lõi là một dấu hiệu thiết kế khá tốt.

## Dòng 29-38: struct và constructor

```go
type PaymentService struct {
    repo        repository.PaymentRepository
    orderClient *client.OrderClient
    amqpCh      *amqp.Channel
    log         *zap.Logger
}
```

Dependencies nói lên rất nhiều điều:

- `repo`: source of persistence cho payment,
- `orderClient`: phải hỏi order-service trước khi tin order,
- `amqpCh`: có side effect async,
- `log`: phải quan sát được khi lỗi.

## Dòng 40-49: comment trên `ProcessPayment`

Comment này cực tốt cho người học vì nó tách rõ:

- flow production thật,
- flow demo hiện tại.

Điều này giúp bạn hiểu rằng:

- code hiện tại chưa tích hợp cổng thanh toán thật,
- nhưng cấu trúc service đã được tổ chức theo hướng có thể mở rộng sau.

## Dòng 50-58: duplicate pre-check

```go
existing, err := s.repo.GetByOrderID(ctx, req.OrderID)
if err != nil {
    return nil, err
}
if existing != nil {
    return nil, ErrDuplicatePayment
}
```

### Vì sao check ở đây?

Để fail sớm nếu order đã có payment trước đó.

### Nhưng vì sao check này vẫn chưa đủ?

Vì hai request song song vẫn có thể cùng đi qua đây trước khi DB insert xong.

Đó là lý do phía dưới vẫn còn lớp bảo vệ bằng unique constraint.

### Bài học lớn

Đừng bao giờ nghĩ application-level check là đủ cho chống duplicate ở domain nhạy cảm.

## Dòng 60-66: gọi `order-service`

```go
order, err := s.orderClient.GetOrder(ctx, authHeader, req.OrderID)
if err != nil {
    if errors.Is(err, client.ErrOrderNotFound) {
        return nil, ErrOrderNotFound
    }
    return nil, err
}
```

### Đây là chỗ rất quan trọng

Payment-service không tự giả định rằng order ID client gửi là đáng tin.

Nó hỏi source of truth là order-service.

### Vì sao forward `authHeader`?

Để lời gọi nội bộ vẫn tôn trọng authorization hiện có, thay vì payment-service tự bịa một quyền truy cập mới.

Đây là một cách đơn giản để tái dùng security context.

### Vì sao map `client.ErrOrderNotFound` thành `ErrOrderNotFound`?

Vì service muốn trả lỗi theo ngôn ngữ domain của chính nó, không để lộ client implementation detail lên handler.

## Dòng 67-69: ownership verification

```go
if order.UserID != userID {
    return nil, ErrOrderNotFound
}
```

Đây là record-level authorization.

### Ý nghĩa

User có token hợp lệ vẫn chưa đủ.
Họ chỉ được thanh toán đơn hàng thuộc về chính họ.

### Vì sao lại trả `ErrOrderNotFound`?

Tương tự nhiều pattern an toàn khác:

- không xác nhận chi tiết quá mức rằng order kia có tồn tại nhưng không thuộc quyền của bạn,
- giữ semantics đơn giản cho client.

## Dòng 71-81: build payment object

```go
now := time.Now()
payment := &model.Payment{
    ID:            uuid.New().String(),
    OrderID:       req.OrderID,
    UserID:        userID,
    Amount:        order.TotalPrice,
    Status:        model.PaymentStatusCompleted,
    PaymentMethod: req.PaymentMethod,
    CreatedAt:     now,
    UpdatedAt:     now,
}
```

### Dòng quan trọng nhất: `Amount: order.TotalPrice`

Đây là trái tim bảo mật của file.

Service không nhận amount từ request body. Nó tự lấy từ order thật.

### Vì sao điều này cực kỳ quan trọng?

Nếu client gửi:

- `order_id = A`
- `amount = 1000`

thì client hoàn toàn có thể sửa `amount = 1`.

Backend phải tự quyết định amount thật từ source of truth.

### `PaymentMethod: req.PaymentMethod`

Đây là một ví dụ hay về việc:

- không phải field nào từ client cũng nguy hiểm,
- nhưng các field liên quan tiền bạc trực tiếp thì phải đặc biệt cẩn thận.

## Dòng 83-88: create payment và unique fallback

```go
if err := s.repo.Create(ctx, payment); err != nil {
    if isUniqueViolation(err) {
        return nil, ErrDuplicatePayment
    }
    return nil, err
}
```

### Tại sao đây là lớp bảo vệ rất quan trọng?

Vì race condition là chuyện rất thật.

Hai request đến gần như cùng lúc có thể:

- cùng thấy chưa có payment ở pre-check,
- rồi cùng insert.

DB unique constraint là lớp chặn cuối cùng bảo vệ tính đúng đắn.

### Bài học backend nên nhớ

Business invariant quan trọng nên được bảo vệ ở cả:

- service layer,
- và database layer.

## Dòng 90-93: publish event sau persist

```go
s.publishPaymentEvent(payment)
return payment, nil
```

Ý nghĩa:

- payment record đã trở thành sự thật trong DB,
- event chỉ là tín hiệu thông báo cho các hệ thống khác biết điều đó.

Một lần nữa, persist là bước cốt lõi; side effect xảy ra sau.

## Dòng 96-105: `GetPayment`

```go
payment, err := s.repo.GetByIDForUser(ctx, paymentID, userID)
...
if payment == nil {
    return nil, ErrPaymentNotFound
}
```

### Điểm cực kỳ đáng học

Service không gọi `GetByID` rồi mới `if payment.UserID != userID`.

Nó dùng luôn method có filter theo user.

Điều này tốt vì:

- giảm nguy cơ quên ownership check,
- query intent rõ ràng hơn,
- đẩy điều kiện truy cập xuống repository/query.

## Dòng 107-115: `GetPaymentByOrder`

Tư duy tương tự `GetPayment`, chỉ khác khóa lookup là `orderID`.

Đây là ví dụ rất rõ về việc:

- auth không chỉ có ở create path,
- read path cũng phải được bảo vệ cẩn thận.

Nhiều hệ thống bị lộ dữ liệu ở chính các endpoint “đọc thôi”.

## Dòng 118-121: check broker dependency

```go
if s.amqpCh == nil {
    return
}
```

Đây là defensive programming tối thiểu.

Không có broker thì bỏ publish, không làm hỏng toàn bộ flow trả payment cho user.

## Dòng 123-129: build event payload

```go
event := PaymentEvent{
    PaymentID: payment.ID,
    OrderID:   payment.OrderID,
    UserID:    payment.UserID,
    Amount:    payment.Amount,
    Status:    string(payment.Status),
}
```

Đây là bước chuyển từ domain model sang event contract.

Bạn nên để ý cách code giữ contract rất rõ, không mập mờ.

## Dòng 131-135: marshal JSON

Nếu marshal lỗi:

- log lại,
- bỏ publish.

Đây là cách xử lý side effect lỗi khá hợp lý trong bối cảnh hiện tại.

## Dòng 137-138: timeout context

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
```

Giống order-service, payment-service tạo một timeout riêng cho publish path.

Điều này giúp side effect:

- có giới hạn thời gian rõ ràng,
- không treo vô hạn.

## Dòng 140-143: chọn routing key

```go
routingKey := "payment.completed"
if payment.Status == model.PaymentStatusFailed {
    routingKey = "payment.failed"
}
```

### Vì sao bước này thú vị?

Nó cho thấy event routing phụ thuộc vào trạng thái business, không phải phụ thuộc vào handler route.

Đây là một ví dụ đẹp về việc event name/routing key nên phản ánh domain event.

## Dòng 145-165: retry publish

Pattern giống order-service:

- thử tối đa 3 lần,
- publish với context timeout,
- nếu thành công thì log và return,
- nếu fail thì sleep ngắn rồi thử lại.

Điều nên học:

- giữ pattern thống nhất giữa các service là một lợi thế lớn về maintainability.

## Dòng 167: log lỗi cuối

Nếu mọi lần retry đều fail, service để lại log lỗi để vận hành viên hoặc developer có thể tra nguyên nhân.

Operational visibility là một phần của code backend tốt.

## Dòng 170-173: `isUniqueViolation`

```go
var pqErr *pq.Error
return errors.As(err, &pqErr) && pqErr.Code == "23505"
```

### Vì sao helper nhỏ này rất hay?

Nó dạy bạn ba thứ cùng lúc:

1. dùng `errors.As` để unwrap lỗi,
2. hiểu lỗi cụ thể của driver PostgreSQL,
3. chuyển chi tiết hạ tầng thành semantics business.

### `23505` là gì?

Đó là mã lỗi unique violation của PostgreSQL.

Nếu bạn làm backend Go nghiêm túc, hiểu một số mã lỗi DB quan trọng là rất đáng giá.

## Những bài học lớn nên rút ra từ file này

1. Domain nhạy cảm phải có nhiều lớp check.
2. Client không được quyết định amount thanh toán.
3. Authorization phải có cả ownership check ở read path và write path.
4. Unique constraint trong DB là lớp bảo vệ cực quan trọng.
5. Error handling tốt là cầu nối giữa hạ tầng và business semantics.

## Tự kiểm tra sau khi đọc

1. Nếu bỏ `orderClient.GetOrder`, payment-service sẽ tin nhầm điều gì từ client?
2. Vì sao `Amount` không được đến từ request body?
3. Vì sao vừa cần pre-check duplicate vừa cần `isUniqueViolation`?
4. Vì sao read payment cũng cần filter theo `userID`?
5. Nếu tích hợp cổng thanh toán thật, bước nào của flow này sẽ thay đổi nhiều nhất?
