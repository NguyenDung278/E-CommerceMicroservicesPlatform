# Annotated: `services/payment-service/internal/repository/payment_repository.go`

Source gốc: `services/payment-service/internal/repository/payment_repository.go`

## 1. Vì sao file này đáng học?

File này không “ồn ào” như service layer, nhưng lại rất quan trọng để học tư duy persistence thực tế:

- query theo khóa nào cho đúng use case,
- ownership filter nên được đẩy xuống SQL ra sao,
- `not found` nên được biểu diễn thế nào trong repository,
- update trạng thái được làm tối giản nhưng rõ ràng như thế nào.

Nếu `order_repository.go` dạy bạn transaction, thì file này dạy bạn query semantics và authorization-friendly persistence.

## 2. Vai trò của file

Repository payment chịu trách nhiệm:

- ghi payment mới,
- tìm payment theo ID,
- tìm payment theo order,
- tìm payment theo ID/order nhưng có ràng buộc `user_id`,
- cập nhật trạng thái payment.

Điểm đáng học nhất ở đây là:

- quyền truy cập dữ liệu không chỉ nằm ở service,
- mà còn được biểu diễn ngay trong câu SQL thông qua `WHERE ... AND user_id = ?`.

## 3. Annotate theo block dòng

### Dòng 1-9: package và import

Import rất gọn:

- `context`
- `database/sql`
- `fmt`
- `model`

Điều này cho thấy repository layer ở đây giữ đúng vai trò:

- không biết gì về JWT, HTTP hay RabbitMQ,
- chỉ tập trung vào database interaction.

### Dòng 11-18: interface `PaymentRepository`

```go
type PaymentRepository interface {
    Create(ctx context.Context, payment *model.Payment) error
    GetByID(ctx context.Context, id string) (*model.Payment, error)
    GetByOrderID(ctx context.Context, orderID string) (*model.Payment, error)
    GetByIDForUser(ctx context.Context, id, userID string) (*model.Payment, error)
    GetByOrderIDForUser(ctx context.Context, orderID, userID string) (*model.Payment, error)
    UpdateStatus(ctx context.Context, id string, status model.PaymentStatus) error
}
```

### Điều nên nhìn ra ngay

Interface này cố ý có cả:

- hàm đọc chung,
- và hàm đọc đã gắn ownership filter.

Đây không phải trùng lặp vô nghĩa. Nó phản ánh hai loại use case:

- use case nội bộ cần đọc payment theo khóa,
- use case user-facing cần bảo đảm quyền truy cập theo `user_id`.

Đây là một điểm thiết kế khá tốt cho người học.

### Dòng 20-26: concrete repository và constructor

```go
type postgresPaymentRepository struct {
    db *sql.DB
}

func NewPaymentRepository(db *sql.DB) PaymentRepository {
    return &postgresPaymentRepository{db: db}
}
```

Pattern giống order repository:

- struct giữ `*sql.DB`,
- constructor trả ra interface.

Điều nên học:

- consistency giữa các repository giúp codebase dễ đọc hơn rất nhiều.

## 4. Ghi payment

### Dòng 28-40: `Create`

```go
query := `
    INSERT INTO payments (id, order_id, user_id, amount, status, payment_method, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`
_, err := r.db.ExecContext(ctx, query, ...)
```

### Vì sao hàm này đơn giản hơn order repository?

Vì aggregate của payment hiện tại đơn giản hơn:

- một payment chủ yếu là một row,
- không có child collection phải insert cùng transaction ở đây.

### Điều đáng học

Đơn giản là tốt khi domain thật sự đơn giản.

Không phải repository nào cũng phải có transaction dài. Chỉ dùng transaction khi invariant của domain thật sự cần nhiều câu lệnh cùng thành công.

### Một điểm quan trọng

`Create` không tự bắt unique violation ở đây.

Tại sao?

- repository chỉ wrap lỗi SQL,
- service phía trên mới quyết định map unique violation thành `ErrDuplicatePayment`.

Đây là ranh giới rất đẹp giữa persistence detail và business semantics.

## 5. Query theo payment ID

### Dòng 43-57: `GetByID`

```go
query := `SELECT ... FROM payments WHERE id = $1`
payment := &model.Payment{}
err := r.db.QueryRowContext(ctx, query, id).Scan(...)
```

Đây là lookup theo khóa chính.

### Vì sao trả `nil, nil` khi `sql.ErrNoRows`?

Repository đang nói:

- query chạy bình thường,
- nhưng không tìm thấy dữ liệu.

Đó không phải lỗi hạ tầng.

Service layer sẽ quyết định:

- đây là `ErrPaymentNotFound`,
- hay một semantics khác tùy use case.

Đây là cách tách trách nhiệm rất đúng.

## 6. Query theo `order_id`

### Dòng 59-73: `GetByOrderID`

```go
query := `SELECT ... FROM payments WHERE order_id = $1`
```

Đây là query rất quan trọng cho duplicate protection ở service.

Service gọi hàm này trước khi tạo payment để kiểm tra:

- order này đã có payment chưa?

### Điều nên học

Repository method thường phản ánh trực tiếp câu hỏi của business:

- "payment này có tồn tại theo ID không?"
- "order này đã có payment chưa?"

Tên hàm tốt giúp bạn nhìn code mà hiểu ngay use case.

## 7. Ownership-aware query

### Dòng 75-89: `GetByIDForUser`

```go
query := `SELECT ... FROM payments WHERE id = $1 AND user_id = $2`
```

### Đây là phần rất đáng học

Authorization ở đây không được làm bằng cách:

1. lấy payment theo ID,
2. rồi mới if `payment.UserID != userID`.

Thay vào đó, query được viết ngay từ đầu với ownership condition.

### Vì sao cách này tốt?

- query intent rõ ràng hơn,
- giảm nguy cơ quên check ownership ở service,
- dữ liệu không hợp lệ về quyền truy cập thậm chí không được lấy ra.

Đây là một mindset backend rất quan trọng:

> nếu có thể biểu diễn constraint truy cập ngay trong query, đó thường là một lựa chọn tốt.

### Dòng 91-105: `GetByOrderIDForUser`

Tư duy tương tự, nhưng lookup key là `order_id`.

Điều này đặc biệt hữu ích cho endpoint kiểu:

- "lấy payment của order này nếu order đó là của user hiện tại".

Bạn nên để ý cách repository đang encode use case vào method name.

## 8. Update trạng thái

### Dòng 107-114: `UpdateStatus`

```go
query := `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2`
_, err := r.db.ExecContext(ctx, query, status, id)
```

Pattern giống order repository:

- update field business chính,
- đồng bộ `updated_at`,
- wrap lỗi nếu SQL fail.

### Điều nên học

Consistency giữa các repository là một lợi thế lớn:

- dễ học,
- dễ review,
- dễ bảo trì.

### Một điểm nên chú ý

Hàm này cũng không check `RowsAffected`.

Trong flow hiện tại điều này ổn vì service phía trên thường đã verify existence trước.
Nhưng nếu sau này có use case khác, bạn có thể cân nhắc check thêm để phân biệt:

- update thành công,
- và update vào record không tồn tại.

## 9. Những bài học lớn từ file này

1. Repository method name nên phản ánh đúng câu hỏi của use case.
2. Ownership filter đẩy xuống SQL là một kỹ thuật rất đáng học.
3. `nil, nil` cho `not found` là pattern phổ biến ở repository Go.
4. Không phải repository nào cũng cần transaction; chỉ cần khi invariant của domain đòi hỏi.
5. Service và repository nên chia nhau rõ business semantics và SQL semantics.

## 10. Nơi bạn nên đọc tiếp sau file này

1. [payment-service line-by-line](/Users/nguyendung/FPT/projects/ecommerce-platform/docs/annotated/line-by-line-payment-service.md)
2. `services/payment-service/internal/model/payment.go`
3. `services/payment-service/migrations/*.sql`

## 11. Câu hỏi tự kiểm tra

1. Vì sao `GetByIDForUser` an toàn hơn pattern fetch rồi mới if ownership ở nhiều trường hợp?
2. Vì sao `Create` không cần transaction như order repository?
3. Vì sao `sql.ErrNoRows` thường được map thành `nil, nil` ở repository?
4. `GetByOrderID` phục vụ business rule nào ở service layer?
5. Nếu cần harden thêm `UpdateStatus`, bạn sẽ cân nhắc kiểm tra gì sau `ExecContext`?
