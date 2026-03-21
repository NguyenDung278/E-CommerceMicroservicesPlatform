# Annotated: `services/order-service/internal/repository/order_repository.go`

Source gốc: `services/order-service/internal/repository/order_repository.go`

## 1. Vì sao file này đáng học?

Nếu `order_service.go` dạy bạn cách nghĩ về use case, thì `order_repository.go` dạy bạn cách biến use case đó thành dữ liệu thật trong PostgreSQL.

File này rất đáng học vì nó cho bạn thấy:

- repository pattern trong Go trông như thế nào,
- transaction được mở và commit ra sao,
- aggregate `Order + OrderItems` được persist thế nào,
- cách đọc dữ liệu nhiều bảng theo phong cách tương đối rõ ràng,
- và giới hạn tự nhiên của cách làm "đơn giản nhưng hiểu được".

## 2. Vai trò của file

Repository không quyết định business rule như:

- order có hợp lệ không,
- stock có đủ không,
- user có được xem order đó không.

Repository chỉ chịu trách nhiệm:

- ghi order vào DB,
- đọc order từ DB,
- cập nhật trạng thái order.

Đây là một nguyên tắc rất quan trọng khi học backend:

- service quyết định "có nên làm không",
- repository quyết định "làm bằng SQL thế nào".

## 3. Annotate theo block dòng

### Dòng 1-9: package và import

File dùng:

- `context` để gắn lifetime/cancel/timeout cho query,
- `database/sql` là standard package của Go để làm việc với SQL DB,
- `fmt` để wrap lỗi,
- `model` để biết object nào được đọc/ghi.

Điều nên học:

- nhiều project Go backend production vẫn dùng `database/sql` trực tiếp thay vì ORM nặng,
- cách này rất “boring but robust”, dễ hiểu SQL thật hơn.

### Dòng 11-16: interface `OrderRepository`

```go
type OrderRepository interface {
    Create(ctx context.Context, order *model.Order) error
    GetByID(ctx context.Context, id string) (*model.Order, error)
    GetByUserID(ctx context.Context, userID string) ([]*model.Order, error)
    UpdateStatus(ctx context.Context, id string, status model.OrderStatus) error
}
```

Interface này mô tả hợp đồng của tầng persistence cho order domain.

Điều đáng học:

- interface ở đây nhỏ, vừa đủ use case hiện có,
- không cố gắng generic hóa quá mức.

Đây là một đặc trưng tốt của Go: interface nhỏ, bám đúng nhu cầu.

### Dòng 18-24: struct concrete implementation và constructor

```go
type postgresOrderRepository struct {
    db *sql.DB
}

func NewOrderRepository(db *sql.DB) OrderRepository {
    return &postgresOrderRepository{db: db}
}
```

Đây là implementation cụ thể cho PostgreSQL thông qua `database/sql`.

Ý nghĩa:

- service chỉ cần biết interface,
- implementation thật dùng `*sql.DB`.

Đây là một pattern rất Go-like:

- interface ở boundary,
- implementation cụ thể ở package nội bộ.

### Dòng 26-29: comment của `Create`

Comment nói đúng bản chất của transaction:

- order mà không có item là invalid aggregate,
- nếu insert item fail sau khi insert order thành công, phải rollback toàn bộ.

Đây là cách rất nên học transaction:

- đừng học transaction như một API kỹ thuật thuần túy,
- hãy học nó như công cụ bảo vệ invariant của domain.

### Dòng 29-35: `BeginTx` và `defer tx.Rollback()`

```go
tx, err := r.db.BeginTx(ctx, nil)
if err != nil {
    return fmt.Errorf("failed to begin transaction: %w", err)
}
defer tx.Rollback()
```

### Vì sao `BeginTx` quan trọng?

Từ đây trở đi, các câu lệnh SQL thuộc cùng một transaction.

Nghĩa là:

- hoặc tất cả cùng commit,
- hoặc tất cả cùng rollback.

### Vì sao `defer tx.Rollback()` là một idiom rất đáng nhớ?

Vì nó giúp code an toàn hơn trong mọi đường return sớm.

Nếu:

- insert order fail,
- insert item fail,
- hoặc có panic được recover phía trên,

thì rollback vẫn có cơ hội chạy.

Sau khi `Commit()` thành công, `Rollback()` sẽ trở thành no-op. Đây là lý do idiom này rất phổ biến.

### Bài học lớn

`defer rollback, then commit at the end` là một pattern bạn nên thuộc lòng khi viết transaction với `database/sql`.

### Dòng 37-48: insert vào bảng `orders`

```go
orderQuery := `
    INSERT INTO orders (id, user_id, status, total_price, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6)
`
_, err = tx.ExecContext(ctx, orderQuery,
    order.ID, order.UserID, order.Status, order.TotalPrice,
    order.CreatedAt, order.UpdatedAt,
)
```

### Điều nên học từ đoạn này

- SQL được viết rõ ràng, không động,
- placeholder `$1..$6` giúp tránh SQL injection,
- dữ liệu đến từ order object đã được service chuẩn bị sẵn.

### Tại sao repo không tự tính `total_price`?

Vì business logic tính giá nằm ở service.
Repository chỉ ghi kết quả cuối cùng.

Đây là separation of concerns.

### Vì sao dùng `ExecContext`?

Vì câu lệnh `INSERT` này không cần trả row data ngay.

`ExecContext` thường dùng cho:

- `INSERT`
- `UPDATE`
- `DELETE`

khi không cần `RETURNING`.

### Dòng 50-62: insert từng `order_items`

```go
itemQuery := `
    INSERT INTO order_items (id, order_id, product_id, name, price, quantity)
    VALUES ($1, $2, $3, $4, $5, $6)
`
for _, item := range order.Items {
    _, err = tx.ExecContext(ctx, itemQuery,
        item.ID, order.ID, item.ProductID, item.Name, item.Price, item.Quantity,
    )
    if err != nil {
        return fmt.Errorf("failed to create order item: %w", err)
    }
}
```

### Đây là nơi aggregate thật sự được persist

`orders` là bản ghi cha.
`order_items` là các bản ghi con.

### Vì sao query item dùng `order.ID` thay vì `item.OrderID`?

Hai cái về bản chất nên giống nhau, nhưng dùng `order.ID` ở đây nhấn mạnh rằng item đang thuộc aggregate hiện tại đang được create.

### Vì sao loop insert từng item chứ không bulk insert?

Vì đây là cách đơn giản, dễ đọc, dễ debug.

Trade-off:

- ít tối ưu hơn bulk insert khi số item rất lớn,
- nhưng rõ ràng hơn cho người học và đủ tốt cho use case storefront nhỏ/vừa.

### Điều nên học

Code backend tốt không phải lúc nào cũng tối ưu nhất. Nó thường là điểm cân bằng giữa:

- đúng,
- rõ,
- đủ nhanh,
- dễ bảo trì.

### Dòng 64: `return tx.Commit()`

```go
return tx.Commit()
```

Đây là điểm chốt transaction.

Nếu mọi lệnh trước đó thành công, `Commit()` biến toàn bộ thay đổi thành sự thật trong DB.

Nếu `Commit()` fail:

- toàn bộ use case create order vẫn được coi là thất bại ở tầng persistence,
- service phía trên sẽ nhận được lỗi này.

### Điều rất nên nhớ

Một transaction chưa commit thì chưa phải “sự thật” của database.

## 4. Đọc path lấy dữ liệu

### Dòng 67-80: `GetByID`

```go
orderQuery := `SELECT ... FROM orders WHERE id = $1`
order := &model.Order{}
err := r.db.QueryRowContext(ctx, orderQuery, id).Scan(...)
```

Repository đọc order cha trước.

### Vì sao `QueryRowContext`?

Vì theo thiết kế, `id` là khóa duy nhất. Kết quả mong đợi tối đa 1 dòng.

### Vì sao `sql.ErrNoRows` trả `nil, nil`?

Đây là một pattern rất phổ biến:

- "không có dữ liệu" không bị coi là lỗi hạ tầng,
- mà là trạng thái nghiệp vụ “not found”.

Service phía trên sẽ quyết định map nó thành `ErrOrderNotFound`.

Điều này giúp repository không dính business semantics quá sâu.

### Dòng 82-98: load `order_items`

```go
itemQuery := `SELECT ... FROM order_items WHERE order_id = $1`
rows, err := r.db.QueryContext(ctx, itemQuery, id)
...
for rows.Next() {
    item := model.OrderItem{}
    if err := rows.Scan(...); err != nil {
        return nil, fmt.Errorf("failed to scan order item: %w", err)
    }
    order.Items = append(order.Items, item)
}
```

### Đây là pattern "parent first, children second"

Repository không dùng join lớn ở đây. Nó:

1. lấy order,
2. rồi lấy items theo `order_id`.

### Vì sao cách này tốt cho người học?

- rất dễ đọc,
- map dữ liệu sang struct rõ ràng,
- không cần xử lý duplicate row như khi join parent-child trong một query.

### Trade-off

Nó tạo 2 query cho 1 aggregate.

Với scale nhỏ/vừa hoặc khi ưu tiên readability, đây là lựa chọn hoàn toàn hợp lý.

### Một điểm bạn nên tự để ý

File này chưa check `rows.Err()` sau vòng `for rows.Next()`.
Đó là một cải tiến tốt có thể bổ sung sau để bắt lỗi phát sinh trong quá trình iterate rows.

## 5. Danh sách order của user

### Dòng 101-119: `GetByUserID`

```go
query := `SELECT ... FROM orders WHERE user_id = $1 ORDER BY created_at DESC`
```

Đây là query rất điển hình cho list endpoint:

- lọc theo owner,
- sắp xếp theo thời gian mới nhất trước.

### Điều quan trọng

Repository này chưa load `Items` cho từng order trong list.

Tại sao điều đó hợp lý?

- list endpoint thường chỉ cần summary,
- nếu load full items cho mọi order, chi phí query có thể tăng không cần thiết.

Đây là một quyết định rất backend-minded:

- list và detail thường không cần cùng một lượng dữ liệu.

### Một điểm nên lưu ý

Tương tự phía trên, có thể thêm `rows.Err()` sau vòng lặp để code chặt hơn.

## 6. Cập nhật trạng thái

### Dòng 121-128: `UpdateStatus`

```go
query := `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`
_, err := r.db.ExecContext(ctx, query, status, id)
```

Đây là update rất điển hình:

- set trạng thái mới,
- đồng thời cập nhật `updated_at`.

### Vì sao dùng `NOW()` trong SQL thay vì `time.Now()` từ Go?

Đây là một lựa chọn hợp lý khi muốn timestamp update phản ánh thời gian từ góc nhìn DB.

Nó giúp:

- tránh lệch múi giờ/clock giữa app và DB trong một số bối cảnh,
- giữ logic update timestamp gắn ngay trong câu lệnh cập nhật.

### Một hạn chế nhỏ

Hàm này không kiểm tra `RowsAffected`, nên nếu `id` không tồn tại thì repo hiện tại vẫn coi như không lỗi.

Service phía trên đã có check existence trước khi gọi `UpdateStatus`, nên logic vẫn ổn trong flow hiện tại.

## 7. Những bài học lớn từ file này

1. Transaction tồn tại để bảo vệ invariant của aggregate, không chỉ là kỹ thuật DB.
2. Repository nên chịu trách nhiệm SQL, không ôm business rule.
3. `database/sql` + SQL rõ ràng là một cách học backend Go rất tốt.
4. Đọc aggregate có thể làm theo cách đơn giản: parent trước, child sau.
5. List query và detail query thường khác nhau về lượng dữ liệu cần tải.

## 8. Nơi bạn nên đọc tiếp sau file này

1. [order-service line-by-line](/Users/nguyendung/FPT/projects/ecommerce-platform/docs/annotated/line-by-line-order-service.md)
2. `services/order-service/internal/model/order.go`
3. `services/order-service/migrations/*.sql`

## 9. Câu hỏi tự kiểm tra

1. Vì sao `Create` phải dùng transaction?
2. Vì sao `defer tx.Rollback()` là idiom đáng nhớ?
3. Vì sao `GetByID` đọc order trước rồi mới đọc items?
4. Vì sao list orders không nhất thiết phải load full items?
5. Nếu bạn cần tối ưu hơn cho nhiều item, bạn sẽ cân nhắc hướng nào?
