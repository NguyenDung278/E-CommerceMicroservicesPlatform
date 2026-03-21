# Annotated: `services/payment-service/internal/service/payment_service.go`

Source gốc: `services/payment-service/internal/service/payment_service.go`

## 1. Vì sao file này rất đáng học?

Đây là file dạy rất rõ một tư duy quan trọng của backend:

> domain nhạy cảm phải được bảo vệ bằng nhiều lớp check nhỏ nhưng đúng chỗ.

File này giúp bạn học:

- trust boundary,
- duplicate protection,
- ownership verification,
- amount phải lấy từ backend,
- event publishing sau payment,
- error mapping giữa infra và domain.

Nếu `order_service.go` là bài học về orchestration, thì file này là bài học về security mindset.

## 2. Vai trò của file

`PaymentService` chịu trách nhiệm:

- nhận yêu cầu thanh toán,
- đảm bảo order hợp lệ,
- đảm bảo user đang thanh toán chính order của mình,
- đảm bảo không bị thanh toán trùng,
- tạo payment record,
- phát event cho hệ thống khác biết payment đã hoàn tất.

## 3. Annotate theo block dòng

### Dòng 3-18: import

Nhìn block import, bạn thấy file này kết hợp:

- business logic,
- HTTP client nội bộ tới order-service,
- DB constraint handling,
- RabbitMQ publish,
- logging.

`github.com/lib/pq` xuất hiện để nhận diện unique violation từ PostgreSQL.

Đây là chi tiết rất đáng học:

- nhiều khi domain error đẹp ở service layer thực chất được xây từ lỗi DB driver phía dưới.

### Dòng 20-27: `PaymentEvent`

Đây là contract event của payment domain.

Event chứa:

- `payment_id`
- `order_id`
- `user_id`
- `amount`
- `status`

Điều nên học:

- event là bản tóm tắt domain change,
- không phải lúc nào cũng trùng 1:1 với DB schema.

### Dòng 29-38: struct và constructor

Dependencies của service:

- `repo` để đọc/ghi payment,
- `orderClient` để verify order từ source of truth,
- `amqpCh` để publish event,
- `log` để observability.

Chỉ cần nhìn constructor là bạn đã biết service này vừa có sync path vừa có async side effect.

### Dòng 40-49: comment của `ProcessPayment`

Comment này rất giá trị cho người học vì nó chỉ rõ:

- flow production thật sẽ phức tạp hơn nhiều,
- bản demo hiện tại mô phỏng payment thành công ngay,
- nhưng structure code đang được đặt để sau này có thể mở rộng.

Đây là bài học hay:

- code demo tốt không nhất thiết phải giả vờ production-ready hoàn chỉnh,
- nhưng nên bộc lộ rõ điểm nào là mô phỏng, điểm nào là thực tế.

### Dòng 50-58: check duplicate payment

```go
existing, err := s.repo.GetByOrderID(ctx, req.OrderID)
if err != nil {
    return nil, err
}
if existing != nil {
    return nil, ErrDuplicatePayment
}
```

Đây là lớp bảo vệ đầu tiên.

Tại sao cần?

- cùng một order không nên có nhiều payment thành công,
- nếu không check, hệ thống có thể double charge hoặc dữ liệu thanh toán bị sai.

Điều nên học:

- logic chống duplicate nên có nhiều lớp:
  - check ở service,
  - unique constraint ở DB,
  - map lỗi DB về lỗi domain.

### Dòng 60-69: verify order từ order-service

```go
order, err := s.orderClient.GetOrder(ctx, authHeader, req.OrderID)
...
if order.UserID != userID {
    return nil, ErrOrderNotFound
}
```

Đây là trái tim bảo mật của flow này.

Service không tin:

- order ID từ client là hợp lệ,
- user hiện tại có quyền với order đó,
- amount từ client là đúng.

Nó gọi sang `order-service` để lấy order thật rồi verify ownership.

Điều nên học:

- source of truth phải được tôn trọng,
- authentication có rồi vẫn phải authorization ở record level,
- domain nhạy cảm không được tin dữ liệu từ request body.

### Dòng 71-81: tạo `Payment`

Đoạn quan trọng nhất ở đây là:

```go
Amount: order.TotalPrice,
```

Đây là quyết định kiến trúc rất đúng.

Tại sao không lấy `amount` từ client?

- client có thể giả request,
- số tiền là dữ liệu nhạy cảm,
- backend phải tự tính hoặc tự lấy từ source of truth.

Đây là nguyên tắc bạn nên nhớ rất lâu:

> Frontend chỉ nên gửi ý định. Backend mới quyết định dữ liệu thật.

### Dòng 83-88: create payment + map unique violation

```go
if err := s.repo.Create(ctx, payment); err != nil {
    if isUniqueViolation(err) {
        return nil, ErrDuplicatePayment
    }
    return nil, err
}
```

Đây là lớp bảo vệ thứ hai sau pre-check duplicate.

Vì sao vẫn cần nếu đã check ở trên?

- vì có race condition,
- hai request gần như đồng thời vẫn có thể vượt qua pre-check,
- DB unique constraint mới là lớp chặn cuối cùng.

Điều nên học:

- check ở application layer không thay thế được ràng buộc ở DB,
- robustness tốt thường đến từ nhiều lớp bảo vệ.

### Dòng 90-93: publish event

Sau khi create thành công, service publish `payment.completed` hoặc `payment.failed`.

Điều quan trọng:

- persist là sự thật chính,
- event là cách thông báo cho hệ thống khác biết sự thật đó.

### Dòng 96-115: read path có ownership filter

`GetPayment` và `GetPaymentByOrder` dùng:

- `GetByIDForUser`
- `GetByOrderIDForUser`

Tức là query đã lọc theo `user_id`.

Đây là điều rất đáng học:

- authorization tốt không nhất thiết phải fetch rồi mới if,
- nhiều trường hợp nên đẩy filter xuống repository/query để an toàn và rõ ràng hơn.

### Dòng 118-168: `publishPaymentEvent`

Flow rất giống order-service:

1. check `amqpCh`,
2. build event,
3. marshal JSON,
4. tạo timeout context,
5. chọn routing key theo status,
6. retry publish 3 lần,
7. log success hoặc failure.

Điểm đáng học:

- pattern side effect publish có thể được giữ đồng nhất giữa các service,
- consistency trong cách viết code giúp repo dễ đọc hơn rất nhiều.

### Dòng 170-173: `isUniqueViolation`

```go
var pqErr *pq.Error
return errors.As(err, &pqErr) && pqErr.Code == "23505"
```

Đây là một helper nhỏ nhưng rất giàu giá trị học tập.

Nó cho bạn thấy cách:

- unwrap lỗi,
- nhận diện lỗi cụ thể của PostgreSQL,
- map lỗi hạ tầng thành lỗi business thân thiện hơn.

Mã `23505` là unique violation của PostgreSQL.

Đây là ví dụ tốt về việc backend engineer cần hiểu cả DB error semantics, không chỉ code Go thuần.

## 4. Những tư duy rất đáng học từ file này

- Dữ liệu thanh toán không bao giờ được tin từ client.
- Duplicate protection phải có cả ở service và DB.
- Ownership check là bắt buộc ở domain nhạy cảm.
- Service layer là nơi tốt để kết hợp security + business rule.
- Lỗi infra nên được chuyển thành lỗi domain dễ hiểu.

## 5. Sau file này bạn nên đọc tiếp gì?

1. `services/payment-service/internal/client/order_client.go`
2. `services/payment-service/internal/repository/payment_repository.go`
3. `services/payment-service/internal/handler/payment_handler.go`

## 6. Câu hỏi tự kiểm tra

1. Vì sao `amount` phải lấy từ `order.TotalPrice`?
2. Vì sao vừa cần pre-check duplicate vừa cần unique constraint ở DB?
3. Vì sao `order-service` phải là source of truth cho order?
4. Vì sao query payment nên filter theo `user_id`?
5. Nếu production thật tích hợp Stripe, flow nào trong comment sẽ trở nên quan trọng hơn?
