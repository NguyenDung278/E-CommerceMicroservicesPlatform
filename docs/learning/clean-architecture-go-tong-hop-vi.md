# Clean Architecture với Go — Tổng hợp khóa học qua ecommerce-platform

> **File này là gì.** Bản ghi đầy đủ của khóa mentor đọc hiểu source `ecommerce-platform`,
> viết cho người **ít kinh nghiệm lập trình**. Mỗi buổi đi từ "vấn đề đời thường" →
> "code thật trong repo" → "nguyên tắc rút ra" → quiz.
>
> **Cách dùng.** Đọc tuần tự lần đầu. Về sau dùng như sổ tra: mỗi mục đều có
> `file:line` trỏ thẳng vào source thật, mở ra đối chiếu được ngay.
>
> **Lưu ý về nguồn.** Buổi 1–4 diễn ra trong các phiên chat trước và được dựng lại
> từ ghi chú + đọc lại source ngày 2026-07-25. Buổi 5–7 được viết trực tiếp từ source.
> Mọi trích dẫn code trong file đều đã đối chiếu với repo tại thời điểm đó.

## Mục lục

| Buổi | Chủ đề | Service chính |
|---|---|---|
| [Phần 0](#phần-0--nhập-môn) | Từ vựng nền + cú pháp Go tối thiểu | — |
| [Buổi 1](#buổi-1--interface-di-và-error) | Interface, Dependency Injection, sentinel error, context | cart-service |
| [Buổi 2](#buổi-2--cơ-chế-go) | slice, map, defer, goroutine, channel, mutex | cart-service, user-service |
| [Buổi 3](#buổi-3--vòng-tròn-clean-architecture) | 4 lớp, Dependency Rule, DTO ≠ Entity | cart-service |
| [Buổi 4](#buổi-4--createorder-và-transaction-bundle) | Transaction, CAS chống oversell, row lock, Saga | order-service |
| [Buổi 5](#buổi-5--webhook-và-inbox-pattern) | HMAC, idempotency, inbox pattern | payment-service |
| [Buổi 6](#buổi-6--outbox-relay-worker) | SKIP LOCKED, lease, at-least-once | payment-service |
| [Buổi 7A](#buổi-7a--bảo-mật) | JWT, RBAC, rate limit, bcrypt, pepper | pkg/middleware, user-service |
| [Buổi 7B](#buổi-7b--chịu-tải-ở-gateway) | Circuit breaker, retry chọn lọc | api-gateway |
| [Buổi 7C](#buổi-7c--testing) | Fake, table test, testcontainers | toàn repo |
| [Buổi 8](#buổi-8--redis-caching) | Cache-aside, invalidation, index set, TTL, stampede | product-service |

---

## Phần 0 — Nhập môn

Phần này dành cho người chưa quen. Nếu bạn đã biết rồi thì nhảy sang Buổi 1.

### 0.1. Từ vựng nền

| Từ | Nghĩa dễ hiểu |
|---|---|
| **Service** | Một chương trình chạy độc lập, lo một mảng nghiệp vụ (đơn hàng, thanh toán…) |
| **Microservices** | Chia hệ thống thành nhiều service nhỏ thay vì một khối lớn |
| **API** | Cửa để chương trình khác gọi vào, ở đây là HTTP |
| **Handler** | Đoạn code nhận request HTTP và trả response |
| **Repository** | Đoạn code nói chuyện với database |
| **Transaction** | Nhóm nhiều lệnh DB thành một khối "được ăn cả, ngã về không" |
| **Idempotent** | Làm 1 lần hay 10 lần đều ra cùng kết quả |
| **Race condition** | Hai việc chạy cùng lúc giẫm chân nhau, ra kết quả sai |
| **Broker (RabbitMQ)** | Hộp thư trung gian: service A bỏ thư vào, service B lấy ra |
| **Webhook** | Một server bên ngoài gọi ngược vào API của bạn để báo tin |

### 0.2. Cú pháp Go tối thiểu để đọc được repo này

```go
// 1. Hàm: tên, tham số, kiểu trả về (Go trả nhiều giá trị được)
func Chia(a, b int) (int, error) {
    if b == 0 {
        return 0, errors.New("chia cho 0")   // lỗi là GIÁ TRỊ, không phải exception
    }
    return a / b, nil                         // nil = không có lỗi
}

// 2. Gọi hàm — mẫu này lặp lại hàng nghìn lần trong repo
ketQua, err := Chia(10, 2)
if err != nil {
    return nil, err      // gặp lỗi thì trả ngược lên trên
}

// 3. Struct = gom nhiều field thành một kiểu
type Payment struct {
    ID     string
    Amount float64
}

// 4. Method = hàm gắn vào một kiểu. `s *PaymentService` gọi là "receiver"
func (s *PaymentService) ProcessPayment(...) { ... }

// 5. Interface = danh sách hành vi, KHÔNG chứa code
type CartRepository interface {
    Get(ctx context.Context, userID string) (*model.Cart, error)
    Save(ctx context.Context, cart *model.Cart) error
}

// 6. Con trỏ: *Cart nghĩa là "địa chỉ của một Cart", &cart lấy địa chỉ
// 7. defer: hoãn lệnh tới lúc hàm kết thúc
// 8. ctx context.Context: tham số đầu tiên của gần như mọi hàm — mang tín hiệu huỷ
```

> 📖 **Ví von xuyên suốt khóa: nhà hàng.**
> - **Handler** = bồi bàn: nhận order từ khách, không nấu.
> - **Service** = bếp trưởng: quyết định nấu gì, theo công thức nào.
> - **Repository** = kho: chỉ biết lấy/cất nguyên liệu, không biết món ăn.
> - **Model/Entity** = nguyên liệu.
> - Bồi bàn không được tự vào kho bốc đồ. Kho không cần biết khách là ai.

---

## Buổi 1 — Interface, DI và error

**Service dùng làm ví dụ:** `cart-service` — nhỏ nhất repo (13 file Go), không có SQL,
nhưng vẫn đủ 4 tầng kiến trúc.

### 1.1. Interface trong Go là "ngầm định"

Mở [cart_repository.go](../../services/cart-service/internal/repository/cart/cart_repository.go):

```go
type CartRepository interface {
	Get(ctx context.Context, userID string) (*model.Cart, error)
	Save(ctx context.Context, cart *model.Cart) error
	Delete(ctx context.Context, userID string) error
}

type redisCartRepository struct {
	client *redis.Client
	ttl    time.Duration
}
```

Chú ý: **không có chữ `implements` nào cả.** Trong Java/C# bạn phải viết
`class RedisCartRepository implements CartRepository`. Go thì khác: chỉ cần
`redisCartRepository` có đủ 3 method đúng chữ ký, nó **tự động** là một `CartRepository`.

Đây gọi là **structural typing** (hay "duck typing"): *nếu nó kêu quạc quạc thì nó là con vịt.*

**Vì sao điều này quan trọng với kiến trúc?** Vì nó cho phép **interface được định nghĩa
ở phía người dùng, không phải phía người cung cấp.** Xem [cart_service.go](../../services/cart-service/internal/service/cart/cart_service.go):

```go
// ProductCatalog describes the product-service lookup capability required by
// cart mutations.
type ProductCatalog interface {
	GetProduct(ctx context.Context, productID string) (*pb.Product, error)
}
```

`CartService` cần tra cứu sản phẩm. Thay vì phụ thuộc vào gRPC client cụ thể, nó
**tự khai báo ra cái nó cần**. Cái tên rất đắt: không phải `ProductGRPCClient` mà là
`ProductCatalog` — mô tả **năng lực**, không mô tả **công nghệ**.

> 📖 **Ví von.** Bếp trưởng viết vào bảng: "tôi cần một người biết trả lời *món này còn
> nguyên liệu không*". Ai đáp ứng được thì vào — có thể là anh thủ kho thật, có thể là
> một sinh viên cầm bảng giả trong lúc test. Bếp trưởng không quan tâm.

**Nguyên tắc — Dependency Inversion:** tầng cao (service) không phụ thuộc tầng thấp
(gRPC/Redis). Cả hai cùng phụ thuộc vào **abstraction** do tầng cao đặt ra.

### 1.2. Dependency Injection qua constructor

```go
type CartService struct {
	repo          repository.CartRepository   // interface, không phải struct cụ thể
	productClient ProductCatalog              // interface
}

func NewCartService(repo repository.CartRepository, productClient ProductCatalog) *CartService {
	return &CartService{repo: repo, productClient: productClient}
}
```

`CartService` **không bao giờ tự tạo** kết nối Redis hay gRPC. Nó **nhận vào** qua
constructor. Đây là **Dependency Injection**.

Nơi mọi thứ được lắp lại với nhau gọi là **composition root** — chính là `cmd/main.go`.
Đây là file **duy nhất** trong service được phép biết "Redis nằm ở đâu, gRPC port nào".

Lợi ích cụ thể, không trừu tượng:

| Không DI | Có DI |
|---|---|
| Test phải chạy Redis thật | Test truyền vào một fake trong RAM |
| Đổi Redis → sửa service | Đổi Redis → chỉ sửa main.go |
| Service biết về hạ tầng | Service chỉ biết về hành vi |

### 1.3. Error trong Go: lỗi là giá trị

Go không có `try/catch`. Lỗi được **trả về như một giá trị bình thường** và bạn phải
xử lý ngay tại chỗ. Mẫu **sentinel error**:

```go
var (
	ErrItemNotFound       = errors.New("item not found in cart")
	ErrProductNotFound    = errors.New("product not found")
	ErrProductUnavailable = errors.New("product is unavailable")
	ErrInsufficientStock  = errors.New("insufficient stock")
)
```

Đây là các "lỗi có tên" của tầng service. Handler bắt chúng bằng `errors.Is` rồi dịch
sang HTTP status — xem lại [payment_handler.go:69](../../services/payment-service/internal/handler/payment/payment_handler.go:69):

```go
if errors.Is(err, service.ErrOrderNotFound) {
    return response.Error(c, http.StatusNotFound, "not found", "order not found")
}
if errors.Is(err, service.ErrPaymentAlreadySettled) {
    return response.Error(c, http.StatusConflict, "already settled", ...)
}
```

**Vì sao dùng `errors.Is` chứ không phải `err == ErrOrderNotFound`?** Vì lỗi thường
được **bọc** thêm ngữ cảnh trên đường đi lên:

```go
return fmt.Errorf("failed to create audit entry: %w", err)   // %w = wrap
```

`%w` giữ lại lỗi gốc bên trong. `errors.Is` biết bóc từng lớp ra để tìm. Nếu dùng `==`
thì lỗi đã bọc sẽ không khớp.

**Quy tắc phân tầng error trong repo này:**

```
repository  →  trả lỗi kỹ thuật, bọc bằng %w        ("failed to insert payment: ...")
service     →  dịch sang sentinel error của domain  (ErrPaymentNotFound)
handler     →  dịch sentinel error sang HTTP status (404)
```

Repository **không được** biết HTTP status. Handler **không được** viết SQL.

### 1.4. `context.Context` — sợi dây huỷ

Gần như mọi hàm trong repo đều có `ctx context.Context` ở tham số đầu. Nó mang:

1. **Tín hiệu huỷ** — khách đóng trình duyệt → ctx bị huỷ → query DB đang chạy dừng luôn,
   không phí tài nguyên.
2. **Deadline** — "quá 5 giây thì bỏ".
3. **Metadata** — request ID để trace xuyên nhiều service.

Ví dụ tạo deadline con, [payment_events.go:142](../../services/payment-service/internal/service/payment/payment_events.go:142):

```go
publishCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
err := s.publishOutboxMessage(publishCtx, message)
cancel()      // luôn phải gọi, nếu không sẽ rò rỉ
```

> **Quy tắc:** `ctx` là tham số **đầu tiên**, không bao giờ lưu vào struct, và luôn
> truyền tiếp xuống dưới.

### ✅ Quiz buổi 1

1. Vì sao interface `ProductCatalog` được đặt trong package `service` chứ không phải trong package của gRPC client?
2. `errors.Is(err, ErrX)` khác gì `err == ErrX`? Khi nào dùng `==` bị sai?
3. Nếu `CartService` tự gọi `redis.NewClient()` bên trong constructor thì việc viết unit test khó ở chỗ nào?
4. Ba tầng handler/service/repository — tầng nào được phép biết mã HTTP 404? Vì sao?

---

## Buổi 2 — Cơ chế Go

Buổi 1 nói về *thiết kế*. Buổi này nói về *cơ chế* — những thứ nếu không hiểu sẽ tạo ra
bug rất khó tìm.

### 2.1. Slice không phải là mảng

Một `slice` trong Go thực chất là một struct 3 field: **con trỏ tới mảng nền, độ dài (len),
sức chứa (cap)**.

```
s := []int{1, 2, 3}

  s ──► ┌─────┬─────┬─────┐
        │  1  │  2  │  3  │      len=3, cap=3
        └─────┴─────┴─────┘
```

Hệ quả nguy hiểm: **hai slice có thể cùng trỏ vào một mảng nền**. Sửa cái này, cái kia
đổi theo.

```go
a := []int{1, 2, 3, 4}
b := a[1:3]        // b trỏ vào CÙNG mảng nền của a
b[0] = 99
// a giờ là [1, 99, 3, 4] — a bị sửa dù ta chỉ đụng b
```

`append` càng rối: nếu còn `cap` thì ghi đè tại chỗ (ảnh hưởng slice khác); nếu hết `cap`
thì cấp mảng mới (không ảnh hưởng nữa). Tức là **hành vi phụ thuộc vào cap** — nguồn bug kinh điển.

Đó là lý do repo này rất hay copy giá trị trước khi trả ra. Xem trong test fake,
[payment_service_test.go:45](../../services/payment-service/internal/service/payment/payment_service_test.go:45):

```go
func (r *fakePaymentRepo) GetByID(_ context.Context, id string) (*model.Payment, error) {
	for _, payment := range r.payments {
		if payment.ID == id {
			copyValue := *payment        // ◄── copy, không trả con trỏ gốc
			return &copyValue, nil
		}
	}
	return nil, nil
}
```

Nếu trả thẳng `payment`, caller sửa nó là sửa luôn dữ liệu "trong DB giả" → test cho kết
quả sai lệch mà không ai hiểu vì sao.

### 2.2. Map và `fatal error: concurrent map writes`

Map trong Go **không an toàn khi nhiều goroutine cùng ghi**. Không phải "có thể sai" mà là
Go **cố tình làm chương trình chết ngay** với dòng `fatal error: concurrent map writes` —
không `recover()` được.

Cách repo xử lý, [login_protection.go:23](../../services/user-service/internal/handler/user/login_protection.go:23):

```go
type LoginAttemptProtector struct {
	mu           sync.Mutex                      // ◄── ổ khóa
	attempts     map[string]loginAttemptState    // ◄── thứ được bảo vệ
	// ...
}

func (p *LoginAttemptProtector) RecordFailure(keys ...string) (time.Duration, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()      // ◄── chắc chắn mở khóa dù thoát hàm kiểu gì
	// ... đọc/ghi p.attempts an toàn ...
}
```

Chú ý `mu` là **named field**, không phải embedding (`sync.Mutex` trần). Nếu embed,
`LoginAttemptProtector` sẽ vô tình có method `Lock()`/`Unlock()` công khai — người ngoài
khóa được cái mutex nội bộ của bạn. Đặt tên `mu` là **giữ khóa ở trong nhà**.

**Mẹo nhỏ:** `map[string]struct{}` được dùng làm **Set** (tập hợp) vì `struct{}` chiếm
**0 byte**. Xem [auth.go:100](../../pkg/middleware/auth.go:100):

```go
allowed := make(map[string]struct{}, len(roles))
for _, role := range roles {
	allowed[strings.ToLower(role)] = struct{}{}
}
// ...
if _, ok := allowed[strings.ToLower(claims.Role)]; !ok { ... }
```

### 2.3. `defer` — LIFO và tham số chốt ngay

Hai luật:

1. Nhiều `defer` chạy theo thứ tự **ngược** (vào sau ra trước).
2. **Tham số được tính ngay lúc gặp `defer`**, không phải lúc chạy.

```go
i := 0
defer fmt.Println(i)   // in ra 0, KHÔNG phải 1
i++
```

Nhưng closure thì đọc biến lúc chạy — đây là lý do repo dùng closure cho metrics,
[payment_processing.go:73](../../services/payment-service/internal/service/payment/payment_processing.go:73):

```go
outcome := appobs.OutcomeSuccess
defer func() {
	appobs.ObserveOperation("payment-service", "process_payment", outcome, time.Since(startedAt))
}()      // ◄── closure: đọc `outcome` lúc hàm kết thúc

// ... ở giữa hàm có thể gán outcome = appobs.OutcomeBusinessError ...
```

Nếu viết `defer appobs.ObserveOperation(..., outcome, ...)` thì `outcome` bị chốt là
`Success` ngay từ đầu — metric luôn báo thành công dù thực tế lỗi.

Và ứng dụng quan trọng nhất của `defer` trong repo — lưới an toàn cho transaction,
[order_repository_orders.go:46](../../services/order-service/internal/repository/order_repository_orders.go:46):

```go
tx, err := r.db.BeginTx(ctx, nil)
if err != nil { ... }
defer tx.Rollback()      // ◄── thoát kiểu gì cũng không để transaction treo
```

Sau `tx.Commit()` thành công, `tx.Rollback()` chạy nhưng **không làm gì** (transaction đã
kết thúc). Nên đặt `defer` này là an toàn tuyệt đối.

### 2.4. Goroutine và channel

**Mỗi HTTP request = 1 goroutine.** Echo tự lo việc đó. Nghĩa là code handler/service của
bạn **luôn chạy song song với chính nó** — đây là lý do mọi state chia sẻ phải được bảo vệ.

Goroutine tự tạo trong repo dùng cho worker nền, [main.go:94](../../services/payment-service/cmd/main.go:94):

```go
relayCtx, relayCancel := context.WithCancel(context.Background())
defer relayCancel()
if amqpCh != nil {
	go paymentService.StartOutboxRelay(relayCtx)     // ◄── `go` = chạy nền
}
```

Và mẫu **graceful shutdown** bằng channel, [main.go:133](../../services/payment-service/cmd/main.go:133):

```go
quit := make(chan os.Signal, 1)
signal.Notify(quit, os.Interrupt)
<-quit                    // ◄── đứng đây chờ, không tốn CPU

log.Info("shutting down server...")
relayCancel()             // dừng worker trước
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
e.Shutdown(ctx)           // rồi mới dừng HTTP
```

`<-quit` là "đọc từ channel" — goroutine chính **ngủ** ở đây cho tới khi có `Ctrl-C`.

Kết hợp `select` với `ctx.Done()` để vừa ngủ vừa nghe lệnh tắt,
[payment_events.go:123](../../services/payment-service/internal/service/payment/payment_events.go:123):

```go
select {
case <-ctx.Done():
	return              // có lệnh tắt → thoát ngay
case <-ticker.C:
	                    // hết 1 giây → làm vòng tiếp
}
```

### ✅ Quiz buổi 2

1. `b := a[1:3]; b[0] = 99` — vì sao `a` bị đổi? Vẽ sơ đồ con trỏ.
2. Vì sao fake repo trong test phải `copyValue := *payment` trước khi trả về?
3. Vì sao `LoginAttemptProtector` dùng `mu sync.Mutex` (named) thay vì embed `sync.Mutex`?
4. `defer fmt.Println(i)` và `defer func(){ fmt.Println(i) }()` khác nhau thế nào?
5. Nếu thay `select { case <-ctx.Done() ... case <-ticker.C }` bằng `time.Sleep(time.Second)` thì shutdown bị ảnh hưởng ra sao?

---

## Buổi 3 — Vòng tròn Clean Architecture

### 3.1. Bốn lớp và một luật duy nhất

```
        ┌─────────────────────────────────────────────┐
        │  Frameworks & Drivers                        │   Echo, Redis, gRPC,
        │  (cmd/main.go, internal/repository, client)  │   PostgreSQL, RabbitMQ
        │   ┌─────────────────────────────────────┐   │
        │   │  Interface Adapters                  │   │   handler, dto,
        │   │  (internal/handler, internal/dto)    │   │   repository impl
        │   │   ┌─────────────────────────────┐   │   │
        │   │   │  Use Cases                   │   │   │   internal/service
        │   │   │  (internal/service)          │   │   │
        │   │   │   ┌─────────────────────┐   │   │   │
        │   │   │   │  Entities            │   │   │   │   internal/model
        │   │   │   │  (internal/model)    │   │   │   │
        │   │   │   └─────────────────────┘   │   │   │
        │   │   └─────────────────────────────┘   │   │
        │   └─────────────────────────────────────┘   │
        └─────────────────────────────────────────────┘

             MŨI TÊN PHỤ THUỘC CHỈ ĐƯỢC HƯỚNG VÀO TRONG
```

**Dependency Rule:** code ở vòng trong **không được biết gì** về vòng ngoài.
`internal/model` không được import `echo`. `internal/service` không được nhận `echo.Context`.

> 📖 **Ví von.** Công thức nấu ăn (service) không được viết "bấm nút số 3 trên lò
> Panasonic model X". Nó viết "nướng 180°C trong 20 phút". Cái lò (framework) có thể thay,
> công thức thì không đổi.

### 3.2. Kỹ thuật review nhanh nhất: đọc phần `import`

Bạn không cần đọc hết 500 dòng để biết một file có vi phạm kiến trúc không. **Chỉ cần
nhìn `import`.**

```go
// internal/service/payment/payment_processing.go — ĐÚNG
import (
	"context"
	"errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
	appobs ".../pkg/observability"
	".../internal/client"
	".../internal/dto"
	".../internal/model"
)
```

Không có `echo`. Không có `database/sql`. Không có `net/http`.

Nếu bạn thấy `import "github.com/labstack/echo/v4"` trong một file thuộc `internal/service`
→ **đỏ đèn ngay**, không cần đọc tiếp.

| Package | ĐƯỢC import | KHÔNG được import |
|---|---|---|
| `internal/model` | stdlib | mọi thứ khác |
| `internal/service` | model, dto, client interface | echo, database/sql, redis |
| `internal/repository` | model, database/sql, redis | echo, net/http |
| `internal/handler` | echo, dto, service | database/sql |

### 3.3. DTO ≠ Entity

Hai kiểu dữ liệu trông giống nhau nhưng phục vụ hai mục đích khác nhau:

```go
// DTO — hợp đồng với thế giới bên ngoài
type ProcessPaymentRequest struct {
	OrderID       string  `json:"order_id" validate:"required"`
	PaymentMethod string  `json:"payment_method" validate:"required,oneof=manual momo ..."`
	Amount        float64 `json:"amount" validate:"omitempty,gt=0"`
}

// Entity — trạng thái nghiệp vụ thật
type Payment struct {
	ID              string
	OrderID         string
	UserID          string
	Status          PaymentStatus
	GatewayProvider string
	SignatureVerified bool
	// ... nhiều field mà client KHÔNG BAO GIỜ được gửi lên
}
```

**Vì sao không dùng chung một struct?** Ba lý do rất thực tế:

1. **Bảo mật.** Nếu bind thẳng JSON vào entity, kẻ tấn công gửi `{"status":"completed"}`
   là tự thanh toán cho mình. Đây gọi là **mass assignment vulnerability**.
2. **Đổi API không phải đổi DB.** Client đòi đổi tên field → sửa DTO, entity nguyên vẹn.
3. **Validation thuộc về biên.** Tag `validate:"..."` là luật của tầng ngoài, không phải
   luật nghiệp vụ.

### 3.4. Chỗ repo này "bẻ cong" luật — và vì sao chấp nhận được

Theo lý thuyết Clean Architecture chuẩn, interface `CartRepository` phải nằm ở
**tầng service** (người dùng định nghĩa cái mình cần). Nhưng trong repo:

```go
// services/cart-service/internal/repository/cart/cart_repository.go
package repository

type CartRepository interface { ... }        // ◄── interface nằm ở tầng repository
```

Còn `ProductCatalog` thì lại đúng chuẩn:

```go
// services/cart-service/internal/service/cart/cart_service.go
package service

type ProductCatalog interface { ... }        // ◄── interface nằm ở tầng service
```

**Hai cách khác nhau trong cùng một service.** Đây là điều bạn sẽ gặp thường xuyên trong
code thật: lý thuyết đẹp, thực tế có thoả hiệp.

Đánh giá công bằng: đặt `CartRepository` ở package `repository` **vẫn giữ được lợi ích
chính** (service phụ thuộc interface, test fake được), chỉ mất tính "thuần khiết" về
hướng phụ thuộc package. Với một service nhỏ, đây là thoả hiệp hợp lý. Điều quan trọng là
**biết mình đang thoả hiệp**, chứ không phải làm sai mà tưởng đúng.

### ✅ Quiz buổi 3

1. Phát biểu Dependency Rule bằng một câu của bạn.
2. Vì sao `internal/service` không được nhận `echo.Context` làm tham số?
3. Mass assignment vulnerability là gì? Cho ví dụ cụ thể với `Payment`.
4. Mở `services/order-service/internal/service/order/order_lifecycle.go`, đọc phần import và nhận xét: có vi phạm nào không?
5. `CartRepository` và `ProductCatalog` được đặt ở hai package khác nhau. Cái nào đúng chuẩn Clean Architecture hơn? Cái còn lại mất gì?

---

## Buổi 4 — CreateOrder và transaction bundle

**File chính:** [order_lifecycle.go:42](../../services/order-service/internal/service/order/order_lifecycle.go:42)
và [order_repository_orders.go:36](../../services/order-service/internal/repository/order_repository_orders.go:36).

Đây là hàm phức tạp nhất repo, và cũng là hàm dạy được nhiều nhất.

### 4.1. Vấn đề: một đơn hàng đụng vào bao nhiêu thứ?

```
CreateOrder
   ├── kiểm tra idempotency key      (chống bấm 2 lần)
   ├── gọi gRPC product-service      (giá và tồn kho THẬT, không tin client)
   ├── trừ kho                        (chống bán quá số lượng)
   ├── khóa và tiêu coupon            (chống dùng quá lượt)
   ├── INSERT orders                  ┐
   ├── INSERT order_items             │ phải cùng sống hoặc cùng chết
   ├── UPDATE coupons.used_count      │
   └── INSERT outbox_events           ┘
```

Nếu bước 6 thành công mà bước 7 hỏng: có đơn hàng nhưng **không có sản phẩm nào trong đơn**.
Dữ liệu "mồ côi". Không sửa được bằng tay khi có triệu đơn.

### 4.2. Transaction bundle — "được ăn cả, ngã về không"

```go
func (r *postgresOrderRepository) createOrderTx(
	ctx context.Context, order *model.Order,
	outbox *model.OutboxMessage, record *model.OrderIdempotencyRecord,
) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()                     // ◄── lưới an toàn

	if order.CouponCode != "" {
		if err := r.lockAndConsumeCoupon(ctx, tx, order.CouponCode, order.SubtotalPrice); err != nil {
			return err
		}
	}

	// INSERT orders ...
	// INSERT order_items (vòng lặp) ...
	// INSERT outbox_events ...

	return tx.Commit()
}
```

**ACID nói gì:**

| Chữ | Nghĩa | Ở đây là gì |
|---|---|---|
| **A**tomicity | Nguyên tử | 4 lệnh INSERT/UPDATE = 1 khối, không có nửa vời |
| **C**onsistency | Nhất quán | Ràng buộc FK, UNIQUE luôn đúng sau commit |
| **I**solation | Cô lập | Transaction khác không thấy dữ liệu chưa commit |
| **D**urability | Bền vững | Commit xong, mất điện vẫn còn |

Điểm quan trọng nhất: **mọi hàm nhận `tx *sql.Tx` chứ không phải `r.db`**. Nếu lỡ tay
dùng `r.db` bên trong, lệnh đó **nằm ngoài transaction** và sẽ không được rollback.
Đây là bug rất khó phát hiện vì code chạy đúng 99% thời gian.

### 4.3. Compare-and-Set chống bán quá kho

[product_repository.go:347](../../services/product-service/internal/repository/product/product_repository.go:347):

```go
func (r *postgresProductRepository) UpdateStock(ctx context.Context, id string, quantity int) error {
	query := `UPDATE products SET stock = stock - $1, updated_at = NOW()
	          WHERE id = $2 AND stock >= $1`      // ◄── điều kiện nằm TRONG câu UPDATE
	result, err := r.db.ExecContext(ctx, query, quantity, id)
	if err != nil { ... }
	rowsAffected, err := result.RowsAffected()
	if err != nil { return err }
	if rowsAffected == 0 {
		return fmt.Errorf("%w: product %s", ErrInsufficientStock, id)
	}
	return nil
}
```

**Vì sao không viết như thế này?**

```go
// CÁCH SAI — không có trong repo, để đối chiếu
stock := SELECT stock FROM products WHERE id = $1     // đọc
if stock >= quantity {                                 // kiểm tra
    UPDATE products SET stock = stock - quantity ...   // ghi
}
```

Vì giữa "đọc" và "ghi" có một khe hở. Đây gọi là **TOCTOU** (Time Of Check To Time Of Use):

```
kho còn 1 cái
  t=0ms   A: đọc stock = 1  → "còn hàng, OK"
  t=1ms   B: đọc stock = 1  → "còn hàng, OK"
  t=2ms   A: UPDATE stock = 0
  t=3ms   B: UPDATE stock = -1     ◄── BÁN QUÁ KHO
```

`WHERE stock >= $1` gộp **kiểm tra và ghi thành một hành động nguyên tử** mà PostgreSQL
đảm bảo. B sẽ nhận `rowsAffected == 0` và biết mình thua.

> **Nguyên tắc vàng:** *Đừng đọc rồi quyết định rồi ghi. Hãy để database vừa quyết định
> vừa ghi trong một câu lệnh, rồi hỏi nó "có ăn không" qua `RowsAffected()`.*

### 4.4. Row lock cho coupon

Coupon khác tồn kho: nó cần kiểm tra **nhiều điều kiện** (còn hạn? đủ min order? còn lượt?)
nên không nhét hết vào một `WHERE` được. Giải pháp là **khóa dòng lại rồi mới nghĩ**,
[order_repository_commerce.go:209](../../services/order-service/internal/repository/order_repository_commerce.go:209):

```go
query := `
	SELECT id, code, ..., usage_limit, used_count, active, expires_at, ...
	FROM coupons
	WHERE code = $1
	FOR UPDATE                    // ◄── khóa dòng này lại
`
coupon, err := scanCoupon(tx.QueryRowContext(ctx, query, strings.ToUpper(strings.TrimSpace(code))))
// ...
if !coupon.Active                                    { return ErrCouponInactive }
if coupon.ExpiresAt != nil && now.After(*coupon.ExpiresAt) { return ErrCouponExpired }
if coupon.MinOrderAmount > subtotal                  { return ErrCouponMinimumNotMet }
if coupon.UsageLimit > 0 && coupon.UsedCount >= coupon.UsageLimit {
	return ErrCouponUsageLimitReached
}

tx.ExecContext(ctx, `UPDATE coupons SET used_count = used_count + 1, ... WHERE id = $1`, coupon.ID)
```

`FOR UPDATE` bắt mọi transaction khác muốn đụng dòng coupon này **phải xếp hàng chờ** cho
tới khi transaction hiện tại commit/rollback. Nhờ vậy đoạn "đọc → kiểm tra 4 điều kiện →
ghi" trở nên an toàn.

**So sánh hai kỹ thuật:**

| | Compare-and-Set (`WHERE stock >= $1`) | Row lock (`FOR UPDATE`) |
|---|---|---|
| Điều kiện | Đơn giản, viết được trong SQL | Phức tạp, cần logic Go |
| Kẻ thua | Nhận `rowsAffected = 0`, biết ngay | Phải chờ |
| Hiệu năng | Nhanh hơn, không chặn ai | Chặn, có nguy cơ deadlock |
| Dùng khi | Trừ kho, đổi trạng thái | Nhiều điều kiện nghiệp vụ |

### 4.5. Idempotency hai lớp

Khách bấm "Đặt hàng" hai lần (mạng lag, sốt ruột). Không được tạo 2 đơn.

```
Lớp 1 (nhanh):  đọc bảng idempotency trước → thấy key cũ → trả đơn cũ luôn
Lớp 2 (chắc):   UNIQUE constraint trên (user_id, idempotency_key)
                → nếu 2 request VÀO CÙNG LÚC, lớp 1 không cứu được,
                  DB sẽ từ chối cái thứ hai bằng unique violation
                → code bắt lỗi đó và đọc lại bản ghi cũ
```

Xem cách xử lý ở [payment_processing.go:185](../../services/payment-service/internal/service/payment/payment_processing.go:185)
(payment-service dùng đúng công thức này):

```go
if idempotencyKey != "" && isUniqueViolation(err) {
	replayedPayment, replayErr := s.findIdempotentPayment(ctx, userID, idempotencyKey, requestHash)
	if replayErr == nil && replayedPayment != nil {
		requestLog.Info("payment request replayed from idempotency key", ...)
		return replayedPayment, nil          // ◄── thua cuộc đua nhưng vẫn trả kết quả đúng
	}
	// ...
}
```

**Bài học chung với buổi 5 và 6:** kiểm tra ở tầng application luôn có khe hở. Lớp phòng
thủ cuối cùng phải là một **ràng buộc trong database**.

### 4.6. Saga / compensation — và giới hạn thật của nó

Trừ kho xảy ra ở **product-service** (qua gRPC), tạo đơn xảy ra ở **order-service** (Postgres).
Hai database khác nhau → **không có transaction chung**.

Nếu trừ kho xong mà tạo đơn hỏng thì sao? Phải **hoàn tác thủ công** — gọi là
**compensation** (bồi thường), và mẫu tổng thể gọi là **Saga**:

```
  trừ kho (product-service)  ✓
  tạo đơn (order-service)    ✗ hỏng
        ↓
  restoreOrderItemsStock()   ← gọi ngược lại product-service để trả kho
```

**Nhưng đây là best-effort, không đảm bảo.** Nếu chính lời gọi hoàn kho cũng thất bại
(product-service đang chết), kho sẽ bị thiếu hụt và cần một job đối soát dọn dẹp sau.

Đây là sự thật quan trọng về microservices: **bỏ transaction phân tán thì phải chấp nhận
nhất quán cuối cùng (eventual consistency) và phải có cơ chế dọn rác.**

### ✅ Quiz buổi 4

1. Giải thích TOCTOU bằng ví dụ tồn kho, có timeline từng mili-giây.
2. Vì sao `lockAndConsumeCoupon` nhận `tx *sql.Tx` mà không phải `r.db`? Chuyện gì xảy ra nếu dùng nhầm?
3. Khi nào chọn CAS, khi nào chọn `FOR UPDATE`? Cho một ví dụ mới ngoài repo.
4. Idempotency "2 lớp" — lớp nào cứu được trường hợp 2 request đến cùng một mili-giây? Vì sao lớp kia không?
5. `defer tx.Rollback()` đặt ngay sau `BeginTx`. Sau khi `tx.Commit()` thành công, `Rollback()` vẫn chạy — có hại không? Vì sao?
6. Saga/compensation trong `CreateOrder` là best-effort. Mô tả một kịch bản nó thất bại và đề xuất cách phát hiện.

---

## Buổi 5 — Webhook và Inbox pattern

**Service:** `payment-service`. **File chính:**
[payment_refunds.go:230](../../services/payment-service/internal/service/payment/payment_refunds.go:230) (`HandleMomoWebhook`)
và [payment_repository.go:333](../../services/payment-service/internal/repository/payment/payment_repository.go:333) (`ApplyWebhookResult`).

### 5.1. Ba câu hỏi mà mọi webhook phải trả lời

> 📖 **Ví von.** Khách trả tiền qua MoMo. Bạn không đứng cạnh khách. MoMo **gọi điện báo**:
> "đơn MOMO-abc trả 500k xong rồi nhé."
>
> 1. **Ai đang gọi vậy?** Làm sao biết không phải kẻ giả danh?
> 2. **Nếu gọi 3 lần thì sao?** Có giao hàng 3 lần không?
> 3. **Nghe xong mà ngã ra bất tỉnh trước khi ghi sổ thì sao?**

| Câu hỏi | Tên kỹ thuật | Code |
|---|---|---|
| Ai đang gọi? | HMAC signature | `verifyMomoWebhookSignature` |
| Gọi 3 lần? | Inbox pattern | `insertInboxMessageTx` + CAS |
| Ghi sổ nửa chừng? | Transaction + outbox | `ApplyWebhookResult` |

### 5.2. Thanh toán MoMo có HAI nhịp

```
NHỊP 1 — Khách bấm "Thanh toán"  (CÓ JWT)
  POST /api/v1/payments  →  INSERT payments, status='pending', trả checkout_url
  (khách nhảy sang app MoMo)

        ······· 10 giây? 5 phút? ·······

NHỊP 2 — MoMo gọi ngược  (KHÔNG có JWT — MoMo đâu biết token của khách)
  POST /api/v1/payments/webhooks/momo  →  pending → completed + outbox
```

Chỗ quyết định, [payment_processing.go:154](../../services/payment-service/internal/service/payment/payment_processing.go:154):

```go
payment := &model.Payment{ /* ... */ Status: model.PaymentStatusCompleted }

if payment.GatewayProvider == "momo" {
	payment.Status = model.PaymentStatusPending      // ◄── HÃM lại
	payment.GatewayOrderID = buildMomoGatewayOrderID(payment.ID)
	payment.CheckoutURL = buildMomoCheckoutURL(s.momoReturnURL, payment.GatewayOrderID)
}

var outbox *model.OutboxMessage
if payment.Status == model.PaymentStatusCompleted {
	outbox, err = buildPaymentOutboxMessage(ctx, enriched, userEmail)   // ◄── momo: outbox = nil
}
```

Với MoMo, `outbox` để `nil` — **chưa báo cho ai cả**. Nếu bắn event ngay ở nhịp 1,
order-service sẽ đánh dấu "đã trả" khi khách còn chưa mở app.

### 5.3. Route webhook không có JWT — và vì sao đó không phải lỗi

[payment_handler.go:42](../../services/payment-service/internal/handler/payment/payment_handler.go:42):

```go
payments.Use(middleware.JWTAuth(jwtSecret))                        // có khóa
adminPayments.Use(middleware.RequireRole(RoleAdmin, RoleStaff))    // khóa 2 lớp

webhooks := e.Group("/api/v1/payments/webhooks")
webhooks.POST("/momo", h.HandleMomoWebhook)                        // KHÔNG khóa gì
```

api-gateway cũng vậy ([payment_handler.go:38](../../api-gateway/internal/handler/payment_handler.go:38)).
Nghĩa là **bất kỳ ai trên Internet cũng POST được vào đây**. Toàn bộ phòng thủ dồn vào
một hàm: `verifyMomoWebhookSignature`.

Chi tiết thứ hai: webhook **không có `c.Validate()`**, và `MomoWebhookRequest` **không có
tag `validate`** nào. Vì với request của khách ta có quyền ra luật; với webhook thì
**không có quyền ra luật cho MoMo** — việc của ta là kiểm chữ ký rồi tự quyết định.

### 5.4. HMAC — ba chi tiết đắt giá

[payment_helpers.go:142](../../services/payment-service/internal/service/payment/payment_helpers.go:142):

```go
func verifyMomoWebhookSignature(secret string, req dto.MomoWebhookRequest) bool {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return false                             // ◄── (a) FAIL CLOSED
	}

	payload := strings.Join([]string{
		strings.TrimSpace(req.PaymentID),
		strings.TrimSpace(req.GatewayOrderID),
		strings.TrimSpace(req.GatewayTransactionID),
		formatMoney(req.Amount),                 // ◄── (b) "%.2f"
		fmt.Sprintf("%d", req.ResultCode),
	}, "|")

	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(payload))
	expected := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(strings.TrimSpace(req.Signature)))  // (c)
}
```

- **(a) Fail closed.** Thiếu secret → từ chối tất cả, không phải cho qua tất cả. Một lần
  quên set biến môi trường không được biến hệ thống thành cửa mở toang.
- **(b) `formatMoney` = `%.2f`.** `float64` in ra có thể là `500000` hoặc `500000.0000001`.
  Hai bên phải chuẩn hóa **cùng một cách** thì chữ ký mới khớp. Lỗi kinh điển khi tích hợp cổng thanh toán.
- **(c) `hmac.Equal` chứ không phải `==`.** So sánh chuỗi bằng `==` dừng ngay khi gặp byte
  khác → sai ở ký tự đầu trả về *nhanh hơn* sai ở ký tự thứ 30. Đo thời gian hàng triệu lần
  có thể dò ra chữ ký (**timing attack**). `hmac.Equal` chạy hết, thời gian không đổi.

Kẻ tấn công cũng **không sửa được số tiền**: đổi `amount` là chữ ký sai ngay.

### 5.5. Sáu chốt chặn, thứ tự không ngẫu nhiên

```
webhook tới
  ├─① Payment có thật không?     findWebhookPayment      → nil ? 404
  ├─② Có phải đơn MoMo không?    GatewayProvider != momo → 404  (cùng lỗi ①: tránh dò ID)
  ├─③ CHỮ KÝ đúng không?         verifyMomoWebhook…      → 401  ★ trước mọi thay đổi state
  ├─④ Còn 'pending' không?       Status != pending       → trả 200 + state hiện tại
  ├─⑤ Số tiền khớp không?        roundMoney(...)         → 400
  └─⑥ ApplyWebhookResult (inbox + CAS + outbox, 1 transaction)
```

Chốt ④ rất đáng chú ý, [payment_refunds.go:265](../../services/payment-service/internal/service/payment/payment_refunds.go:265):

```go
if payment.Status != model.PaymentStatusPending {
	payments, listErr := s.repo.ListByOrderID(ctx, payment.OrderID)
	// ...
	requestLog.Info("payment webhook treated as idempotent replay", ...)
	return enrichPayment(payment, payments), nil     // ◄── 200 OK, KHÔNG phải lỗi
}
```

> **Quy tắc nhớ đời:** với webhook, *"tôi đã xử lý chuyện này rồi"* là **thành công**,
> không phải lỗi. Trả 4xx/5xx thì cổng thanh toán hiểu là "chưa nhận được" và **gọi lại mãi mãi**.

### 5.6. `ApplyWebhookResult` — ba pattern chồng lên nhau

```go
tx, _ := r.db.BeginTx(ctx, nil)
defer tx.Rollback()

// ── LỚP 1: INBOX ──────────────────────────────
inserted, err := r.insertInboxMessageTx(ctx, tx, inbox)
if err != nil { return false, err }
if !inserted { return true, nil }        // đã xử lý rồi → thoát (defer rollback)

// ── LỚP 2: COMPARE-AND-SET ────────────────────
result, err := tx.ExecContext(ctx, `
	UPDATE payments SET ... status = $3, ...
	WHERE id = $14 AND status = 'pending'
`, paymentUpdateArgs(payment)...)
rowsAffected, _ := result.RowsAffected()
if rowsAffected == 0 {
	tx.Commit()
	return false, nil
}

// ── LỚP 3: OUTBOX ─────────────────────────────
r.insertOutboxMessageTx(ctx, tx, outbox)
return false, tx.Commit()
```

**Inbox** ([payment_repository.go:562](../../services/payment-service/internal/repository/payment/payment_repository.go:562)):

```go
result, err := tx.ExecContext(ctx, `
	INSERT INTO inbox_messages (consumer, message_id, routing_key, created_at)
	VALUES ($1, $2, $3, $4)
	ON CONFLICT (consumer, message_id) DO NOTHING       // ◄── mấu chốt
`, ...)
rowsAffected, _ := result.RowsAffected()
return rowsAffected > 0, nil     // true = tin mới, false = đã thấy rồi
```

```sql
CREATE TABLE IF NOT EXISTS inbox_messages (
    consumer    VARCHAR(80)  NOT NULL,
    message_id  VARCHAR(120) NOT NULL,
    routing_key VARCHAR(120) NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (consumer, message_id)      -- luật sắt nằm ở đây
);
```

> 📖 **Ví von.** Inbox là **cuốn sổ ghi tên khách đã vào cửa**. Điều then chốt: cuốn sổ này
> là PRIMARY KEY của PostgreSQL, **không phải biến trong RAM**. Server restart, chạy 5 bản
> sao — cuốn sổ vẫn là một và vẫn đúng.

Khóa là `(consumer, message_id)` chứ không chỉ `message_id`, để sau này thêm
`vnpay-webhook`, `zalopay-webhook` mỗi cái có sổ riêng.

`message_id` được **băm từ chính nội dung tin** ([payment_helpers.go:273](../../services/payment-service/internal/service/payment/payment_helpers.go:273)),
không do MoMo cấp → cùng nội dung gửi 100 lần ra cùng một ID. Gọi là
**content-addressed dedupe** — không cần cổng thanh toán hợp tác.

### 5.7. Đã có Inbox rồi, cần CAS làm gì nữa?

Chúng chặn **hai kịch bản khác nhau**:

| | Inbox chặn được | CAS chặn được |
|---|---|---|
| MoMo gửi lại **y hệt** tin cũ | ✅ trùng `message_id` | ✅ status đã khác `pending` |
| MoMo gửi tin **khác nội dung** cho payment đã xong | ❌ hash khác → lọt | ✅ status đã khác `pending` |
| Hai request **song song** cùng nội dung | ⚠️ tùy timing | ✅ chỉ 1 thắng |

> 📖 Inbox là bảo vệ nhớ mặt khách. CAS là ổ khóa trên cánh cửa. Bảo vệ có thể bị lừa
> bằng cách thay áo — ổ khóa thì không.

**Ba kết cục của `ApplyWebhookResult`:**

| Tình huống | Trả về | Inbox | Payment | Outbox | Commit? |
|---|---|---|---|---|---|
| Tin mới, payment pending | `(false, nil)` | ghi | **đổi** | ghi | ✅ |
| Tin đã xử lý rồi | `(true, nil)` | trùng | không | không | ❌ rollback |
| Tin mới, payment hết pending | `(false, nil)` | ghi | không | **không** | ✅ |

Dòng cuối **cố ý không ghi outbox**: không đổi trạng thái thì không có gì để báo.

### 🔍 Một điểm đáng ngờ để bạn tự soi

`ApplyWebhookResult` trả `(false, nil)` ở **hai** trường hợp (dòng 1 và 3 của bảng trên).
Nhưng `HandleMomoWebhook` xử lý chúng như nhau:

```go
// Nhánh duplicate == true: ĐỌC LẠI TỪ DB
if duplicate {
	payments, _ := s.repo.ListByOrderID(ctx, payment.OrderID)
	current := payment
	for _, candidate := range payments {
		if candidate.ID == payment.ID { current = candidate; break }
	}
	return enrichPayment(current, payments), nil
}

// Nhánh còn lại: trả thẳng biến trong RAM
return enriched, nil          // ◄── enriched đã bị gán Status=completed ở dòng 297
```

Ở trường hợp `rowsAffected == 0`, DB **không hề được cập nhật**, nhưng client vẫn nhận
`status: completed`. Đây là một **TOCTOU** khác: giữa chốt ④ (đọc status) và lệnh UPDATE
có khe hở cho webhook song song chen vào.

**Bài tập:** dựng timeline hai webhook dẫn tới tình huống này, rồi đề xuất cách sửa
(gợi ý: làm giống nhánh `duplicate`).

### ✅ Quiz buổi 5

1. Vì sao route `/webhooks/momo` không có `JWTAuth`, và cái gì thay vai trò của JWT?
2. Nếu sửa thành `if secret == "" { return true }` "để test cho tiện" — hậu quả cụ thể là gì?
3. Vì sao webhook lặp trả **200** thay vì **409**?
4. MoMo đổi `gateway_transaction_id` rồi gửi lại cho payment **đã completed** — inbox có chặn được không? Cái gì chặn?
5. Ở nhánh `rowsAffected == 0`, code **commit** thay vì rollback. Nó cố tình giữ lại cái gì, và giữ lại có lợi gì?
6. (Khó) Trả lời phần 🔍 ở trên.

---

## Buổi 6 — Outbox relay worker

**File chính:** [payment_events.go:109](../../services/payment-service/internal/service/payment/payment_events.go:109)
và [payment_repository.go:394](../../services/payment-service/internal/repository/payment/payment_repository.go:394).

### 6.1. Vì sao có bảng outbox?

> 📖 **Ví von.** Bạn ghi sổ kế toán (PostgreSQL) **và** gọi điện báo kho (RabbitMQ). Hai
> việc này không gộp làm một được. Ghi sổ xong mà điện thoại chết → kho không biết. Gọi kho
> xong mà ghi sổ hỏng → kho giao hàng cho đơn không tồn tại. Đây là **dual-write problem**.
>
> Outbox giải bằng mẹo đơn giản đến mức thanh lịch: **đừng gọi kho nữa — ghi luôn "cần gọi
> kho" vào chính cuốn sổ kế toán.** Giờ chỉ còn một lần ghi, transaction lo hết. Việc gọi
> điện để **relay worker** làm sau.

### 6.2. Hai cách viết worker sai

**Sai #1 — đọc rồi bắn:**

```go
// KHÔNG PHẢI CODE TRONG REPO — để đối chiếu
rows := db.Query(`SELECT * FROM outbox_events WHERE published_at IS NULL`)
for _, msg := range rows {
    publish(msg)
    db.Exec(`UPDATE outbox_events SET published_at = NOW() WHERE id = $1`, msg.ID)
}
```

```
      t=0ms                    t=1ms
Replica A ─ SELECT → [msg#42] ─ publish#42 ─►┐
Replica B ─ SELECT → [msg#42] ─ publish#42 ─►┤ khách nhận 3 email
Replica C ─ SELECT → [msg#42] ─ publish#42 ─►┘
```

**Sai #2 — dùng map trong RAM để nhớ "tôi đang xử lý cái này".** Mỗi container có RAM riêng;
ba container là ba map rỗng chẳng liên quan. Restart là mất sạch.

> **Nguyên tắc:** khi nhiều tiến trình cần thống nhất, **trạng thái chia sẻ phải nằm ở nơi
> dùng chung** — PostgreSQL. Không bao giờ là biến trong process.

### 6.3. Khung xương worker

```go
func (s *PaymentService) StartOutboxRelay(ctx context.Context) {
	if s.amqpCh == nil {
		s.log.Warn("RabbitMQ channel not available, payment outbox relay is disabled")
		return                                              // ◄── (a) fail soft
	}

	ticker := time.NewTicker(paymentOutboxPollInterval)     // 1 giây
	defer ticker.Stop()

	for {
		if err := s.flushOutboxBatch(ctx); err != nil && ctx.Err() == nil {
			s.log.Warn("payment outbox relay batch failed", zap.Error(err))   // (b)
		}
		select {
		case <-ctx.Done():                                  // ◄── (c)
			return
		case <-ticker.C:
		}
	}
}
```

- **(a)** Không có RabbitMQ thì worker tự tắt nhưng **service vẫn chạy**. Outbox row vẫn
  được ghi vào DB. Khi broker sống lại, đống row cũ được bắn hết — **không mất event nào**.
  Đây là phần thưởng của outbox: broker chết không làm chết nghiệp vụ.
- **(b)** `ctx.Err() == nil` — lúc shutdown mọi query trả lỗi "context canceled", đó là
  chuyện *bình thường*. Thiếu vế này, mỗi lần tắt service log phun ra WARN giả.
  **Dấu hiệu của người đã từng vận hành thật.**
- **(c)** "Ngủ 1 giây, **nhưng** có lệnh tắt thì dậy ngay."

### 6.4. `ClaimPendingOutbox` — mổ xẻ câu SQL

```sql
WITH candidates AS (
    SELECT id
    FROM outbox_events
    WHERE published_at IS NULL          -- ① chưa gửi
      AND available_at <= NOW()         -- ② tới giờ được phép gửi
    ORDER BY created_at ASC             -- ③ cũ trước
    LIMIT $1                            -- ④ mỗi lần tối đa 50
    FOR UPDATE SKIP LOCKED              -- ⑤ ★ giành phần
)
UPDATE outbox_events AS oe
SET attempts     = oe.attempts + 1,                        -- ⑥
    available_at = NOW() + ($2 * INTERVAL '1 second'),      -- ⑦ ★ thuê 30 giây
    updated_at   = NOW()
FROM candidates
WHERE oe.id = candidates.id
RETURNING oe.id, oe.aggregate_type, ...                     -- ⑧
```

Câu này làm **bốn việc trong một lần đi DB**: tìm → khóa → đánh dấu đã nhận → lấy nội dung.
Không có khe hở cho ai chen vào giữa.

### 6.5. Điểm cốt lõi: ⑤ và ⑦ bảo vệ hai khoảng thời gian KHÁC NHAU

**⑤ `FOR UPDATE SKIP LOCKED` — bảo vệ trong một phần nghìn giây.**

`FOR UPDATE` = khóa dòng. Bình thường B gặp dòng A đang khóa sẽ **đứng chờ**. Thêm
`SKIP LOCKED` thì B **bỏ qua, nhảy sang dòng khác**.

```
             ┌──────────────────────────────────┐
             │ outbox: #41  #42  #43  #44  #45  │
             └──────────────────────────────────┘
   Replica A ── khóa #41,#42 ─► nhận [41,42]
   Replica B ── thấy 41,42 bị khóa → NHẢY QUA ─► nhận [43,44]
   Replica C ── thấy 41..44 bị khóa → NHẢY QUA ─► nhận [45]
```

Ba replica **chia nhau việc, không giẫm chân, không ai xếp hàng**. Càng thêm replica càng
nhanh. `FOR UPDATE` thường (không `SKIP LOCKED`) sẽ biến 3 replica thành hàng dọc chờ nhau
— thêm máy cũng không nhanh hơn.

**⑦ `available_at` — bảo vệ trong 30 giây tiếp theo.**

> **Câu hỏi then chốt:** row lock được nhả ngay khi transaction commit. Câu `UPDATE` trên
> commit xong là hết khóa — nhưng lúc đó A **mới chỉ nhận** message, chưa gửi đi RabbitMQ.
> Vậy 10ms sau, replica B chạy claim, cái gì ngăn nó lấy đúng dòng #42?

Chính là ⑦. `available_at` đã bị đẩy lên tương lai 30 giây → điều kiện ② sai → B không thấy.

```
t=0s   A claim #42  →  available_at = 30s, A bắt đầu publish
       ┌─────────── 30 giây "thuê" ───────────┐
       │  B, C chạy claim → KHÔNG thấy #42    │
       └──────────────────────────────────────┘
t=30s  hết hạn thuê → #42 lại hiện ra cho bất kỳ ai
```

**Vì sao lease phải tự hết hạn thay vì đánh dấu vĩnh viễn?** Vì A có thể **chết ngay sau
khi claim**. Đánh dấu vĩnh viễn thì dòng đó kẹt mãi. Lease hết hạn = **hệ thống tự lành**.

| | `FOR UPDATE SKIP LOCKED` | `available_at` lease |
|---|---|---|
| Bảo vệ khoảng nào | Trong lúc chạy query | Sau khi query xong, suốt 30s |
| Chống chuyện gì | Hai replica cùng **giành** một dòng | Replica khác **cướp** dòng đang xử lý |
| Ai quản lý | PostgreSQL tự động | Code chủ động ghi |
| Nếu tiến trình chết | Khóa nhả ngay | Chờ hết 30s rồi ai cũng lấy được |

> 📖 `SKIP LOCKED` là lúc **bốc phiếu ở quầy** — mỗi người một phiếu, không trùng, không chờ.
> `available_at` là **hạn của cái phiếu** — cầm phiếu thì 30 phút không ai được nhận việc đó.
> Quá hạn không quay lại thì quầy phát lại cho người khác.

**④ `LIMIT 50`:** không có nó, A khóa hết 10.000 dòng, B và C thất nghiệp. Lô nhỏ giúp
nhiều replica cùng chạy, và một message lỗi không kéo theo 9.999 cái khác.

### 6.6. Partial index — chi tiết ẩn rất đáng học

```sql
CREATE INDEX IF NOT EXISTS idx_outbox_events_pending
ON outbox_events (available_at, created_at)
WHERE published_at IS NULL;          -- ◄── mệnh đề WHERE trong index
```

`outbox_events` phình ra mãi mãi — sau một năm có thể vài triệu dòng, **99,99% đã published**.
Index thường sẽ chứa cả vài triệu dòng đó → to, chậm, tốn đĩa. **Partial index chỉ chứa
những dòng chưa gửi** — thường chỉ vài chục. Query chạy nhanh như nhau dù bảng có 1 triệu
hay 100 triệu dòng.

### 6.7. Vòng lặp xử lý và backoff

```go
func (s *PaymentService) flushOutboxBatch(ctx context.Context) error {
	for {                                                   // ◄── vòng lặp trong
		messages, err := s.repo.ClaimPendingOutbox(ctx, 50, 30*time.Second)
		if err != nil { return err }
		if len(messages) == 0 { return nil }

		for _, message := range messages {
			publishCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			err := s.publishOutboxMessage(publishCtx, message)
			cancel()
			if err != nil {
				backoff := time.Duration(minInt(message.Attempts, 5)) * time.Second
				s.repo.MarkOutboxFailed(ctx, message.ID, err.Error(), time.Now().Add(backoff))
				continue
			}
			s.repo.MarkOutboxPublished(ctx, message.ID, time.Now())
		}
	}
}
```

**Vì sao có vòng `for` trong khi ngoài đã có ticker?** Claim tối đa 50/lần. Nếu tồn 500
message, ticker 1 giây mất 10 giây mới xử hết. Vòng lặp trong **rút cạn rồi mới nghỉ**.

**Có lặp vô tận không?** Không — và lý do rất hay: RabbitMQ chết, cả 50 fail,
`MarkOutboxFailed` đẩy `available_at = now + 1s`. Quay lại claim → điều kiện ② sai với cả 50
→ trả 0 message → `return nil`. **Cơ chế backoff đồng thời là cơ chế thoát vòng lặp.**

**`MarkOutboxFailed` ghi đè lease 30s bằng 1–5 giây** — cố ý: message đã chắc chắn thất bại
thì không có lý do bắt chờ đủ 30s. Lease dài chỉ dành cho lúc *không biết chuyện gì đang xảy ra*.

Lưu ý: `backoff = min(attempts, 5)` giây là **linear backoff**, không phải exponential.
Nếu RabbitMQ chết nửa tiếng, worker vẫn đập cửa mỗi 5 giây. Đây là điểm có thể cải thiện.

### 6.8. Trả lời: 3 bản sao có bắn event trùng không?

**Tầng 1 — điều kiện bình thường: KHÔNG.** `SKIP LOCKED` + lease đảm bảo mỗi thời điểm
chỉ một replica cầm một dòng.

**Tầng 2 — nhưng không đảm bảo tuyệt đối.** Hai kịch bản có thật:

```
KỊCH BẢN A — chết đúng khe hở
t=0.0s  Replica A: claim #42 ✓        (available_at = 30s)
t=0.1s  Replica A: publish #42 ✓      ← RabbitMQ ĐÃ NHẬN
t=0.1s  ☠  container A bị OOM-kill, chưa kịp MarkOutboxPublished
        →  published_at VẪN NULL
t=30s   lease hết hạn
t=31s   Replica B: claim #42 ✓ → publish #42 ✓    ← NHẬN LẦN 2

KỊCH BẢN B — quá chậm
publish treo > 30s → lease hết hạn TRONG KHI A vẫn đang gửi → B nhảy vào gửi tiếp
```

> **Kết luận phải khắc vào đầu:** outbox relay cho bạn **at-least-once**, **không bao giờ
> exactly-once**. Muốn "đúng một lần" phải kết hợp **at-least-once ở người gửi +
> idempotent ở người nhận**.

### 6.9. Khép vòng: đầu nhận

Lúc publish, [payment_events.go:186](../../services/payment-service/internal/service/payment/payment_events.go:186):

```go
headers := amqp.Table{"x-event-id": message.ID}
amqp.Publishing{
	MessageId:    message.ID,          // ◄── chính là outbox_events.id
	DeliveryMode: amqp.Persistent,     // ◄── RabbitMQ ghi xuống đĩa
	Headers:      headers,
}
```

Hai lần gửi ở kịch bản A mang **cùng `MessageId`** → sợi dây để đầu nhận nhận ra hàng trùng.

Đầu nhận, [event_handler.go:103](../../services/notification-service/internal/handler/event_handler.go:103):

```go
claimStatus, err := h.inboxStore.Claim(ctx, meta.MessageID, h.processingTTL)
switch claimStatus {
case inbox.AlreadyProcessed:
	requestLog.Info("skipped duplicate notification event")
	_ = msg.Ack(false)          // ◄── báo "xong rồi", KHÔNG gửi email
	return
case inbox.AlreadyClaimed:
	_ = msg.Nack(false, true)   // ◄── có thằng đang làm, trả lại queue
	return
}
```

`notification-service` dùng **Redis** (nó không có DB riêng), đảm bảo nguyên tử bằng
**Lua script** ([redis_store.go:86](../../services/notification-service/internal/inbox/redis_store.go:86)):

```lua
if redis.call("EXISTS", KEYS[1]) == 1 then    -- đã xử lý xong rồi?
    return 2                                   -- AlreadyProcessed
end
if redis.call("SET", KEYS[2], "1", "NX", "PX", ARGV[1]) then   -- NX = chỉ set nếu chưa có
    return 1                                   -- Claimed
end
return 3                                       -- AlreadyClaimed
```

Redis chạy Lua **nguyên khối, không ai chen ngang** — đúng vai trò transaction đóng ở Postgres.

**Toàn cảnh:**

```
┌─ payment-service ────────────────────┐
│ transaction {                         │
│   UPDATE payments (pending→completed) │  ← state
│   INSERT outbox_events                │  ← event, CÙNG transaction   [Buổi 4,5]
│ } commit                              │
└──────────────┬───────────────────────┘
      relay worker  SKIP LOCKED + lease                              [Buổi 6]
      ⚠ AT-LEAST-ONCE — có thể gửi lặp
               ▼
        ┌──────────────┐
        │  RabbitMQ    │  ⚠ cũng at-least-once
        └──────┬───────┘
               ▼
┌─ notification-service ───────────────┐
│ inbox.Claim(MessageId) ← Lua/Redis   │  ← lọc trùng                 [Buổi 5,6]
└──────────────────────────────────────┘
        = hiệu quả như EXACTLY-ONCE
```

> **Câu tổng kết bộ ba buổi 4–5–6:** không tầng nào một mình đảm bảo "đúng một lần".
> Transaction lo state+event không lệch. Relay lo event không mất. Inbox lo event không lặp.
> **Ba thứ cộng lại mới ra kết quả đúng.**

### ✅ Quiz buổi 6

1. `SKIP LOCKED` và `available_at` bảo vệ **khoảng thời gian nào**? Thiếu một trong hai thì hỏng ở đâu?
2. Bỏ `SKIP LOCKED`, chỉ để `FOR UPDATE`: có bắn trùng không? Nếu không thì hỏng ở chỗ nào khác?
3. Vì sao index có `WHERE published_at IS NULL`? Sau 2 năm production, bỏ mệnh đề đó thì sao?
4. Kể lại kịch bản A bằng lời của bạn, rồi chỉ **chính xác dòng code nào** ở notification-service cứu khách khỏi 2 email.
5. Chứng minh `flushOutboxBatch` luôn thoát được, kể cả khi RabbitMQ chết hoàn toàn.
6. (Khó) `MarkOutboxPublished` dùng `relayCtx` — sẽ bị huỷ lúc shutdown. Publish thành công t=0, `relayCancel()` t=0.001s, `MarkOutboxPublished` fail. Chuyện gì xảy ra khi restart? Bug hay hành vi chấp nhận được? Bảo vệ quan điểm.
7. (Thực hành) `make compose-up`, tạo payment MoMo, rồi:
   ```sql
   SELECT id, routing_key, attempts, available_at, published_at FROM outbox_events ORDER BY created_at DESC LIMIT 5;
   SELECT consumer, message_id, routing_key FROM inbox_messages ORDER BY created_at DESC LIMIT 5;
   ```
   Bắn webhook hai lần cùng payload. Mô tả khác biệt giữa lần 1 và lần 2 ở cả hai bảng.

---

## Buổi 7A — Bảo mật

**File chính:** [pkg/middleware/auth.go](../../pkg/middleware/auth.go),
[pkg/middleware/rate_limit.go](../../pkg/middleware/rate_limit.go),
[login_protection.go](../../services/user-service/internal/handler/user/login_protection.go),
[user_auth.go](../../services/user-service/internal/service/account/user_auth.go).

### 7A.1. Ba câu hỏi khác nhau mà người mới hay gộp làm một

| Câu hỏi | Tên | Code |
|---|---|---|
| Bạn **là ai**? | Authentication (xác thực) | `JWTAuth` |
| Bạn **được làm gì**? | Authorization (phân quyền) | `RequireRole` |
| Bạn **gọi nhiều quá không**? | Rate limiting | `NewRedisBackedRateLimiter` |

Ba thứ độc lập. Một token hợp lệ (✅ authn) vẫn có thể bị chặn vì không phải admin
(❌ authz) hoặc vì gọi 1000 lần/giây (❌ rate limit).

### 7A.2. JWT — vì sao không cần hỏi DB mỗi request

[auth.go:25](../../pkg/middleware/auth.go:25):

```go
type JWTClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims        // ◄── chứa exp, iat, iss... theo chuẩn
}
```

> 📖 **Ví von.** JWT là **tấm vé xem phim có dấu mộc**. Nhân viên soát vé không cần gọi
> điện về phòng vé để hỏi "vé này thật không" — chỉ cần nhìn con dấu. Con dấu chỉ rạp mới
> làm được (secret), và trên vé đã ghi sẵn "ghế A5, suất 19h" (claims).

Đó là lý do comment trong repo viết: *"We include UserID and Role so downstream handlers
don't need to hit the User Service on every request."* Nếu không, mỗi request tới
order-service sẽ phải gọi user-service một lần → thêm độ trễ, thêm điểm chết.

**Cái giá phải trả:** vé đã phát ra thì **không thu hồi được** cho tới lúc hết hạn. Đây là
đánh đổi cố hữu của JWT, và là lý do access token phải có hạn ngắn.

### 7A.3. Chi tiết bảo mật quan trọng nhất trong file: algorithm confusion

[auth.go:66](../../pkg/middleware/auth.go:66):

```go
token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
	// SECURITY: Verify the signing method to prevent algorithm confusion attacks.
	if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
		return nil, echo.NewHTTPError(http.StatusUnauthorized, "unexpected signing method")
	}
	return []byte(secret), nil
})
```

**Đây là 3 dòng cứu cả hệ thống.** Giải thích cho người mới:

JWT tự khai báo thuật toán ký của nó trong phần header: `{"alg": "HS256"}`. Nếu thư viện
**tin lời khai đó**, kẻ tấn công sửa thành `{"alg": "none"}` và bỏ chữ ký đi — thư viện sẽ
kết luận "token không cần chữ ký, hợp lệ!". Hắn tự tạo token `role: admin` cho mình.

Biến thể khác: đổi từ RS256 (bất đối xứng) sang HS256 (đối xứng) rồi **dùng public key làm
secret** — public key thì ai cũng có.

Đoạn code trên chặn cả hai bằng cách nói: *"tôi chỉ chấp nhận HMAC, bất kể token khai gì."*

> **Nguyên tắc:** **không bao giờ tin metadata do người gửi cung cấp để quyết định cách
> xác minh chính người gửi đó.** Cùng tinh thần với `verifyMomoWebhookSignature` fail-closed
> ở buổi 5.

### 7A.4. `RequireRole` — set 0 byte và fail closed

[auth.go:99](../../pkg/middleware/auth.go:99):

```go
func RequireRole(roles ...string) echo.MiddlewareFunc {
	allowed := make(map[string]struct{}, len(roles))     // ◄── build MỘT LẦN
	for _, role := range roles {
		allowed[strings.ToLower(role)] = struct{}{}
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims := GetUserClaims(c)
			if claims == nil {
				return c.JSON(http.StatusUnauthorized, ...)     // ◄── fail closed
			}
			if _, ok := allowed[strings.ToLower(claims.Role)]; !ok {
				return c.JSON(http.StatusForbidden, ...)
			}
			return next(c)
		}
	}
}
```

Ba điểm:

1. `allowed` được dựng **ngoài** closure → chỉ chạy một lần lúc đăng ký route, không phải
   mỗi request. Đây là closure dùng đúng cách.
2. `claims == nil` → **401**, không phải cho qua. Nếu ai đó quên gắn `JWTAuth` trước
   `RequireRole`, hệ thống **từ chối** thay vì mở toang.
3. **401 vs 403 khác nhau:** 401 = "tôi không biết bạn là ai"; 403 = "tôi biết bạn là ai,
   và bạn không được phép". Nhầm lẫn hai cái này làm client không biết nên login lại hay báo lỗi.

Thứ tự bắt buộc, [payment_handler.go:36](../../services/payment-service/internal/handler/payment/payment_handler.go:36):

```go
adminPayments.Use(middleware.JWTAuth(jwtSecret))                       // 1. bạn là ai
adminPayments.Use(middleware.RequireRole(RoleAdmin, RoleStaff))        // 2. bạn được làm gì
```

Đảo thứ tự → `RequireRole` chạy khi chưa có claims → luôn 401 → route chết.

### 7A.5. Rate limiter: token bucket trên Redis

[rate_limit.go:201](../../pkg/middleware/rate_limit.go:201):

```lua
local data = redis.call("HMGET", key, "tokens", "last_refill")
local tokens = tonumber(data[1])
local last_refill = tonumber(data[2])

if tokens == nil then tokens = burst end
if last_refill == nil then last_refill = now end

local elapsed = math.max(0, now - last_refill)
local refill = elapsed * rate / 1000              -- ◄── thời gian trôi = xu được thêm
tokens = math.min(burst, tokens + refill)         -- ◄── không vượt trần

local allowed = 0
local retry_after = 0
if tokens >= requested then
	tokens = tokens - requested
	allowed = 1
else
	retry_after = math.ceil((requested - tokens) / rate * 1000)
end

redis.call("HMSET", key, "tokens", tokens, "last_refill", now)
redis.call("PEXPIRE", key, ttl)
return {allowed, math.floor(tokens), retry_after}
```

> 📖 **Ví von — thùng xu.** Bạn có cái thùng chứa tối đa `burst` đồng xu. Mỗi giây có `rate`
> xu tự rơi vào. Mỗi request tiêu 1 xu. Hết xu → bị chặn, và hệ thống nói luôn "chờ bao lâu
> thì có xu" (`retry_after`).
>
> Ưu điểm so với "đếm số request mỗi phút": cho phép **bùng nổ ngắn** (khách vừa mở app,
> gọi 10 API cùng lúc — vẫn qua nếu thùng đầy) nhưng **chặn được kẻ gọi đều đặn 100 req/s**.

Vì sao phải là Lua? Vì đọc-tính-ghi phải **nguyên tử**. Nếu làm 3 lệnh Redis riêng, hai
request song song sẽ cùng đọc "còn 1 xu" và cùng được qua. Cùng vấn đề TOCTOU của buổi 4 —
**lần thứ ba bạn gặp nó trong khóa này**.

**Định danh ai bị giới hạn** ([rate_limit.go:151](../../pkg/middleware/rate_limit.go:151)):

```go
func extractRateLimitIdentifier(c echo.Context) (string, error) {
	if claims := GetUserClaims(c); claims != nil && claims.UserID != "" {
		return claims.UserID, nil       // ◄── đã login: theo user
	}
	return c.RealIP(), nil              // ◄── chưa login: theo IP
}
```

Hợp lý: theo user chính xác hơn (một user đổi IP vẫn bị đếm), nhưng chưa login thì chỉ có IP.

**Điểm đánh đổi đáng bàn — fail OPEN:**

```go
allowed, retryAfter, err := limiter.Allow(c.Request().Context(), identifier)
if err != nil {
	log.Warn("Redis rate limiter request failed, falling back to in-memory limiter", ...)
	return fallbackHandler(c)        // ◄── Redis chết → dùng limiter trong RAM
}
```

Redis chết thì **vẫn cho request đi qua** (với limiter local yếu hơn). Đây là **fail open** —
ngược với `verifyMomoWebhookSignature` fail closed ở buổi 5.

**Vì sao khác nhau?** Vì hậu quả khác nhau:

| | Fail closed | Fail open |
|---|---|---|
| Chữ ký webhook | ✅ Sai một lần = mất tiền | ❌ |
| Rate limiter | ❌ Redis chết = cả web sập | ✅ Redis chết = hơi dễ bị spam |

> **Nguyên tắc:** chọn fail-open hay fail-closed theo **hậu quả của việc đoán sai**, không
> theo thói quen. Cơ chế bảo vệ **tính đúng đắn** → fail closed. Cơ chế bảo vệ **tài nguyên**
> → thường fail open.

### 7A.6. Bcrypt — chậm là tính năng

[user_auth.go:65](../../services/user-service/internal/service/account/user_auth.go:65):

```go
hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
```

[user_auth.go:131](../../services/user-service/internal/service/account/user_auth.go:131):

```go
if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
	return nil, ErrInvalidCredentials
}
```

Ba điều người mới cần hiểu:

1. **Không bao giờ lưu mật khẩu gốc.** Lưu hash — hàm một chiều, không đảo ngược được.
2. **Không dùng SHA-256 cho mật khẩu.** SHA-256 *quá nhanh* — GPU thử hàng tỷ mật khẩu/giây.
   Bcrypt được thiết kế **cố tình chậm**. Cost 12 nghĩa là `2^12 = 4096` vòng lặp,
   khoảng ~250ms/lần. Người dùng chờ 250ms không sao; kẻ brute-force thì chết.
3. **Bcrypt tự sinh salt** và nhúng luôn vào chuỗi hash. Salt làm hai user cùng mật khẩu
   `123456` vẫn ra hash khác nhau → không dùng bảng tra sẵn (rainbow table) được.

**Chi tiết tinh tế trong `Login`:** cả "không tìm thấy user" lẫn "sai mật khẩu" đều trả
**cùng một** `ErrInvalidCredentials`. Nếu tách ra ("email không tồn tại" / "sai mật khẩu"),
kẻ tấn công dò được **email nào đã đăng ký** — gọi là **user enumeration**. Cùng tinh thần
với chốt ①② ở buổi 5.

### 7A.7. Pepper — và một đính chính

Có một hiểu nhầm phổ biến cần làm rõ: trong repo này, **pepper KHÔNG dùng cho mật khẩu**.
Mật khẩu chỉ dùng bcrypt (đã có salt sẵn). Pepper được dùng cho **mã OTP**,
[email_verification.go:365](../../services/user-service/internal/service/account/email_verification.go:365):

```go
func (s *UserService) hashEmailOTPCode(emailAddress string, otpCode string) string {
	payload := fmt.Sprintf("%s:%s:%s",
		s.emailVerificationCfg.SecretPepper,      // ◄── pepper
		normalizeEmail(emailAddress),             // ◄── ràng OTP vào đúng email
		strings.TrimSpace(otpCode))
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:])
}
```

**Salt vs Pepper:**

| | Salt | Pepper |
|---|---|---|
| Lưu ở đâu | Cùng chỗ với hash (trong DB) | **Ngoài DB** — biến môi trường/secret |
| Mỗi bản ghi | Khác nhau | Giống nhau |
| Chống gì | Rainbow table | **Kẻ đã lấy được cả database** |

Ý tưởng: hacker dump được bảng OTP cũng **không brute-force được**, vì OTP chỉ có 6 chữ số
(1 triệu khả năng — SHA-256 thử hết trong tích tắc). Thiếu pepper thì không thử được.

Và vì sao SHA-256 ở đây lại chấp nhận được trong khi mật khẩu thì không? Vì OTP **sống vài
phút, có giới hạn số lần thử** (`MaxAttempts`), và có pepper. Mật khẩu thì sống nhiều năm.

### 7A.8. Chống brute-force login

[login_protection.go](../../services/user-service/internal/handler/user/login_protection.go):

```go
const (
	defaultMaxLoginFailures  = 5
	defaultLoginLockDuration = 15 * time.Minute
	defaultLoginAttemptTTL   = 24 * time.Hour
)
```

Khóa **theo hai chiều** cùng lúc ([login_protection.go:134](../../services/user-service/internal/handler/user/login_protection.go:134)):

```go
func loginAttemptKeys(req dto.LoginRequest, ip string) []string {
	keys := []string{}
	if identifier := normalizeLoginIdentifier(req); identifier != "" {
		keys = append(keys, "identifier:"+identifier)     // ◄── theo tài khoản
	}
	if trimmedIP := strings.TrimSpace(ip); trimmedIP != "" {
		keys = append(keys, "ip:"+trimmedIP)              // ◄── theo IP
	}
	return uniqueAttemptKeys(keys)
}
```

- Khóa **theo tài khoản**: chặn kẻ dò mật khẩu của một nạn nhân từ 1000 IP khác nhau.
- Khóa **theo IP**: chặn kẻ dò 1000 tài khoản khác nhau từ một máy (**credential stuffing**).

Thiếu một trong hai là thủng. Và `normalizeLoginIdentifier` chuẩn hóa email về chữ thường,
số điện thoại về chỉ còn chữ số — nếu không, kẻ tấn công đổi `User@Mail.com` →
`user@mail.com` là có bộ đếm mới.

**Điểm yếu cần biết:** state nằm trong `map` + `sync.Mutex` → **trong RAM một tiến trình**.
Chạy 3 replica thì mỗi cái đếm riêng → thực tế cho phép 15 lần thử thay vì 5. Đây chính là
"cách sai #2" đã nói ở buổi 6. Sửa đúng: chuyển sang Redis như rate limiter.

### ✅ Quiz buổi 7A

1. Phân biệt authentication / authorization / rate limiting bằng ví dụ ở `/api/v1/admin/payments`.
2. Algorithm confusion attack là gì? Chỉ ra 3 dòng code chặn nó và giải thích.
3. Vì sao `RequireRole` trả 401 khi `claims == nil` thay vì cho qua? Đảo thứ tự middleware thì sao?
4. 401 và 403 khác nhau thế nào? Client nên xử lý mỗi cái ra sao?
5. Vì sao token bucket phải viết bằng Lua? Liên hệ với TOCTOU ở buổi 4.
6. Rate limiter fail **open**, chữ ký webhook fail **closed**. Giải thích vì sao cả hai đều đúng.
7. Vì sao không dùng SHA-256 cho mật khẩu, nhưng lại dùng được cho OTP?
8. Salt và pepper khác nhau chỗ nào? Pepper chống được kịch bản tấn công nào mà salt không chống được?
9. `LoginAttemptProtector` khóa theo cả `identifier` lẫn `ip`. Mô tả một cuộc tấn công mà chỉ khóa theo `ip` sẽ không chặn được.
10. (Khó) Chạy 3 replica user-service thì `LoginAttemptProtector` yếu đi thế nào? Viết lại bằng Redis cần những gì?

---

## Buổi 7B — Chịu tải ở gateway

**File chính:** [service_proxy.go](../../api-gateway/internal/proxy/service_proxy.go),
[service_proxy_request.go](../../api-gateway/internal/proxy/service_proxy_request.go).

### 7B.1. Vì sao gateway phải "ngu"

Comment ngay đầu [service_proxy.go:15](../../api-gateway/internal/proxy/service_proxy.go:15) nói thẳng:

> *"The API gateway remains a thin transport layer that forwards requests without importing
> downstream domain models or re-implementing service logic."*

Bằng chứng kiểm chứng được: cả `api-gateway` chỉ có **917 dòng Go** cho **6 service**. Và
handler của nó trông thế này ([payment_handler.go:23](../../api-gateway/internal/handler/payment_handler.go:23)):

```go
payments := e.Group("/api/v1/payments")
payments.Use(appmw.JWTAuth(jwtSecret))
payments.POST("", h.forward)              // ◄── chỉ forward
payments.GET("/history", h.forward)       // ◄── chỉ forward
payments.GET("/:id", h.forward)           // ◄── chỉ forward
```

Không một dòng nghiệp vụ. Chỉ khai báo "đường này có cần JWT không" rồi chuyển tiếp.

**Vì sao "ngu" lại tốt?** Bốn lý do rất thực tế:

1. **Gateway là điểm chết chung.** Nó sập thì cả 6 service không ai gọi được. Càng ít code
   càng ít bug.
2. **Logic sẽ bị lệch.** Nếu gateway kiểm "amount phải > 0" và payment-service cũng kiểm,
   một ngày nào đó ai đó sửa một chỗ. Giờ hệ thống có **hai sự thật**.
3. **Deploy bị ràng buộc.** Thêm field vào payment → phải deploy cả gateway. Mất hết lợi
   ích của microservices.
4. **Vi phạm Dependency Rule (buổi 3).** Gateway import model của payment-service = tầng
   ngoài kéo tầng trong theo.

> 📖 **Ví von.** Gateway là **lễ tân toà nhà**: kiểm thẻ ra vào (JWT), chỉ đường (routing),
> chặn người vào quá đông (rate limit), và **báo là tầng 5 đang mất điện** (circuit breaker).
> Lễ tân **không** ký hợp đồng thay cho phòng kinh doanh.

**Ranh giới:** gateway được quyền lo *transport* (auth, routing, retry, rate limit, tracing),
không được lo *domain* (giá, tồn kho, trạng thái đơn).

### 7B.2. Circuit breaker — vấn đề nó giải quyết

[service_proxy.go:59](../../api-gateway/internal/proxy/service_proxy.go:59):

```go
circuitBreaker: gobreaker.NewCircuitBreaker[*http.Response](gobreaker.Settings{
	Name:        baseURL,
	MaxRequests: 3,
	Interval:    30 * time.Second,
	Timeout:     20 * time.Second,
	ReadyToTrip: func(counts gobreaker.Counts) bool {
		return counts.ConsecutiveFailures >= 5
	},
}),
```

**Vấn đề nếu KHÔNG có nó:** `product-service` chết. Mỗi request tới gateway sẽ chờ hết
timeout 30 giây rồi mới báo lỗi. 1000 request/giây × 30 giây = **30.000 kết nối đang treo**
trong gateway. Gateway hết file descriptor và **chết theo**. Rồi client retry, càng nặng.

Đây gọi là **cascading failure** — một service chết kéo sập cả hệ thống.

> 📖 **Ví von — cầu dao điện trong nhà.** Chập điện ở một ổ cắm: cầu dao **ngắt** để lửa
> không lan ra cả nhà. Sau một lúc bạn thử bật lại — nếu vẫn chập, nó ngắt tiếp; nếu ổn thì
> nhà có điện trở lại. Circuit breaker là **cầu dao cho lời gọi mạng**.

**Ba trạng thái:**

```
        5 lần lỗi liên tiếp
CLOSED ─────────────────────► OPEN
  ▲     (ReadyToTrip)          │
  │                            │ chờ Timeout = 20s
  │                            ▼
  └──────────────────────── HALF-OPEN
      3 request thử thành công   │
      (MaxRequests)              │ có lỗi
                                 └──► quay lại OPEN

CLOSED    = bình thường, cho đi hết
OPEN      = ngắt. TRẢ LỖI NGAY LẬP TỨC, không gọi downstream
HALF-OPEN = thử dè dặt tối đa 3 request xem đã hồi chưa
```

Giá trị lớn nhất của trạng thái OPEN: **fail fast**. Trả lỗi trong 1ms thay vì treo 30 giây.
Gateway giữ được tài nguyên, và **service đang ốm được nghỉ để hồi phục** thay vì bị dồn thêm request.

`Interval: 30s` là chu kỳ reset bộ đếm khi đang CLOSED — 5 lỗi rải rác trong 3 giờ không
làm ngắt cầu dao; phải là **5 lỗi liên tiếp**.

Chú ý `Name: baseURL` — **mỗi service một cầu dao riêng**. `product-service` chết không
được làm `user-service` bị ngắt. Nếu dùng chung một breaker thì đó là bug thiết kế nghiêm trọng.

### 7B.3. Retry chọn lọc — chi tiết hay nhất buổi này

[service_proxy_request.go:251](../../api-gateway/internal/proxy/service_proxy_request.go:251):

```go
func shouldRetry(method string, err error, attempt int, attempts int) bool {
	if attempt >= attempts-1 {
		return false                        // ① hết lượt
	}

	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
	default:
		return false                        // ② ★ CHỈ retry method an toàn
	}

	var netErr interface{ Timeout() bool }
	if errors.As(err, &netErr) {
		return true                         // ③ lỗi timeout mạng
	}

	return errors.Is(err, gobreaker.ErrOpenState) || errors.Is(err, gobreaker.ErrTooManyRequests)
}
```

**Điểm ② là bài học lớn nhất.** Vì sao không retry `POST`?

```
Client → POST /api/v1/payments  (trừ 500k)
Gateway → payment-service ✓ đã xử lý xong, đã trừ tiền
        ← response bị mất trên đường về (timeout mạng)
Gateway: "timeout, thử lại nhé"
Gateway → payment-service ✓ TRỪ TIỀN LẦN HAI
```

Gateway **không thể phân biệt** "server chưa nhận được" với "server làm rồi nhưng response
mất". Với `GET` thì retry vô hại (**idempotent** — đọc 2 lần vẫn ra kết quả đó). Với `POST`
thì retry là **nhân đôi tác dụng phụ**.

> **Nguyên tắc:** *chỉ tự động retry những thao tác idempotent.* Muốn retry `POST` an toàn
> thì phải có **idempotency key** — đúng thứ bạn học ở buổi 4 và 5. Đó là lý do
> `ProcessPayment` nhận header `Idempotency-Key`: nó cho phép **client** retry an toàn, việc
> mà gateway không dám tự làm.

Điểm ③ dùng `errors.As` với một **interface ẩn danh**:

```go
var netErr interface{ Timeout() bool }
if errors.As(err, &netErr) { return true }
```

Đọc là: *"trong chuỗi lỗi đã bọc, có cái nào có method `Timeout() bool` không?"* Kỹ thuật
Go rất gọn — không cần biết kiểu cụ thể, chỉ cần biết nó **có hành vi** đó (đúng tinh thần
interface ngầm định ở buổi 1).

Và cả `ErrOpenState` cũng được retry — vì cầu dao có thể vừa chuyển sang HALF-OPEN.

### 7B.4. Body chỉ đọc được một lần

[service_proxy_request.go:185](../../api-gateway/internal/proxy/service_proxy_request.go:185):

```go
func cloneRetryableRequest(req *http.Request) (*http.Request, error) {
	clonedReq := req.Clone(req.Context())
	if req.GetBody == nil {
		return clonedReq, nil
	}
	body, err := req.GetBody()        // ◄── tạo LẠI body từ đầu
	if err != nil {
		return nil, err
	}
	clonedReq.Body = body
	return clonedReq, nil
}
```

`req.Body` là một **stream chỉ đọc được một lần**. Attempt 1 đọc hết → attempt 2 gặp body
rỗng. `GetBody` là hàm "tua lại từ đầu" mà `net/http` cung cấp khi biết body.

Đây là loại bug rất khó phát hiện: retry chạy đúng nhưng gửi request **rỗng**, và chỉ xảy
ra khi có lỗi mạng — không bao giờ gặp lúc dev.

### 7B.5. Backoff và connection pool

```go
time.Sleep(time.Duration(attempt+1) * 150 * time.Millisecond)   // 150ms, 300ms
```

Chờ giữa các lần thử để service ốm có thời gian thở. Đây là **linear backoff** (giống outbox
ở buổi 6). Với `maxRetries = 2` thì tổng chờ chỉ 450ms — chấp nhận được.

```go
client: &http.Client{
	Timeout: 30 * time.Second,
	CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse          // ◄── KHÔNG tự đi theo redirect
	},
	Transport: appobs.WrapHTTPTransport(&http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
	}),
}
```

- **`CheckRedirect`**: mặc định Go tự đi theo 302. Gateway **không được** làm vậy — luồng
  OAuth cần redirect đến tận trình duyệt. Gateway phải trả nguyên 302 về cho client.
- **Connection pool**: mở TCP + TLS mới tốn hàng chục ms. Giữ 100 kết nối rảnh để tái dùng.
  Không có pool, gateway sẽ tạo/hủy hàng nghìn kết nối mỗi giây.
- **`client` được tạo MỘT lần** trong `NewServiceProxy` và tái dùng. Tạo `http.Client` mỗi
  request là bug hiệu năng kinh điển — mất sạch pool.

### 7B.6. Bốn lớp phòng thủ, xếp đúng thứ tự

```
Client
  │
  ▼  Nginx (edge)
  ▼  api-gateway
     ├─ ① Rate limiter (Redis)   chặn kẻ gọi quá nhiều       ← BẢO VỆ MÌNH
     ├─ ② JWTAuth                chặn kẻ không có vé
     ├─ ③ Circuit breaker        ngắt khi downstream ốm      ← BẢO VỆ DOWNSTREAM
     └─ ④ Retry (chỉ GET)        cứu lỗi mạng thoáng qua
  ▼
Service
```

Thứ tự có ý nghĩa: rate limit và auth **chặn sớm nhất có thể** (không tiêu tài nguyên cho
request rác). Circuit breaker và retry nằm sát chỗ gọi mạng.

### ✅ Quiz buổi 7B

1. Nêu 4 lý do gateway không được chứa business logic. Lý do nào nghiêm trọng nhất, vì sao?
2. Mô tả cascading failure khi không có circuit breaker, có con số cụ thể.
3. Vẽ 3 trạng thái circuit breaker và điều kiện chuyển giữa chúng theo đúng config trong repo.
4. Vì sao `Name: baseURL` (mỗi service một breaker) là bắt buộc? Dùng chung thì hỏng thế nào?
5. **Vì sao không retry `POST`?** Dựng timeline cụ thể với `/api/v1/payments`.
6. Muốn retry `POST` an toàn thì cần gì? Liên hệ với buổi 4 và 5.
7. `GetBody` giải quyết vấn đề gì? Không có nó thì retry sai ra sao — và vì sao dev không bao giờ gặp bug này?
8. Vì sao gateway đặt `CheckRedirect` trả `http.ErrUseLastResponse`?
9. (Khó) Circuit breaker đang OPEN, `shouldRetry` vẫn trả `true` cho `ErrOpenState`. Có mâu thuẫn không? Lập luận cả hai chiều.

---

## Buổi 7C — Testing

**File chính:** [payment_service_test.go](../../services/payment-service/internal/service/payment/payment_service_test.go),
[cart_repository_integration_test.go](../../services/cart-service/internal/repository/cart/cart_repository_integration_test.go).

### 7C.1. Phần thưởng của Clean Architecture chính là ở đây

Buổi 1 nói: service phụ thuộc **interface**, không phụ thuộc Redis/gRPC cụ thể. Lúc đó nghe
trừu tượng. Buổi này là lúc thu hoạch:

```go
svc := NewPaymentService(repo, orderLookup, nil, zap.NewNop(), "secret", "https://example.com/return")
```

`repo` là một struct trong RAM. `orderLookup` là một struct trong RAM. `nil` là chỗ của
RabbitMQ. Test này chạy **không cần PostgreSQL, không cần RabbitMQ, không cần order-service**
— và chạy trong **vài mili-giây**.

> Nếu `PaymentService` tự gọi `sql.Open()` bên trong, dòng test trên là bất khả thi. **Kiến
> trúc tốt không phải để đẹp — nó là để test được.**

### 7C.2. Fake, không phải mock

[payment_service_test.go:20](../../services/payment-service/internal/service/payment/payment_service_test.go:20):

```go
type fakePaymentRepo struct {
	payments           []*model.Payment
	createdOutbox      *model.OutboxMessage
	idempotencyRecords map[string]*model.PaymentIdempotencyRecord
}

func (r *fakePaymentRepo) Create(_ context.Context, payment *model.Payment, outbox *model.OutboxMessage) error {
	copyValue := *payment
	r.payments = append([]*model.Payment{&copyValue}, r.payments...)
	r.createdOutbox = outbox
	return nil
}

func (r *fakePaymentRepo) GetByID(_ context.Context, id string) (*model.Payment, error) {
	for _, payment := range r.payments {
		if payment.ID == id {
			copyValue := *payment        // ◄── bài học buổi 2
			return &copyValue, nil
		}
	}
	return nil, nil
}
```

Đây là **fake**: một cài đặt thật, đơn giản, có state — không phải mock ghi lại lời gọi.

| | Mock | Fake |
|---|---|---|
| Cách dùng | Khai báo "hàm X phải được gọi 1 lần" | Viết một cài đặt đơn giản trong RAM |
| Test kiểm tra | **Cách làm** | **Kết quả** |
| Refactor code | Test vỡ dù hành vi đúng | Test vẫn xanh |

Fake làm test **bền hơn**: đổi cách cài đặt bên trong `ProcessPayment` mà kết quả vẫn đúng
thì test vẫn xanh. Đó chính là điều bạn muốn.

Chú ý `copyValue := *payment` — trực tiếp áp dụng bài học slice/con trỏ ở buổi 2. Nếu trả
con trỏ gốc, code test sửa nó là sửa luôn "DB giả".

Dấu `_` ở `_ context.Context` nghĩa là "tham số này có, nhưng tôi không dùng" — Go bắt bạn
nói rõ thay vì để tên biến thừa.

### 7C.3. Ba test này chứng minh đúng ba pattern đã học

**① Tính toán số dư** — `TestProcessPaymentDefaultsToOutstandingAmount` ([:202](../../services/payment-service/internal/service/payment/payment_service_test.go:202)):

Dựng sẵn lịch sử: đơn 120đ, đã trả 50đ, đã hoàn 10đ → thực trả 40đ → còn nợ 80đ.

```go
payment, err := svc.ProcessPayment(ctx, "user-1", "user@example.com", "Bearer token", "",
	dto.ProcessPaymentRequest{OrderID: "order-1", PaymentMethod: "manual"})   // KHÔNG truyền Amount

if payment.Amount != 80 { t.Fatalf(...) }             // tự lấy đúng phần còn nợ
if payment.OutstandingAmount != 0 { t.Fatalf(...) }
if repo.createdOutbox == nil {
	t.Fatal("expected completed payment to enqueue an outbox message")   // ◄── kiểm outbox!
}
```

Dòng cuối rất đáng chú ý: test **khẳng định outbox message được tạo**. Đây chính là hợp
đồng của buổi 4–6 được đóng đinh bằng test. Nếu ai đó vô tình xóa dòng tạo outbox,
test này đỏ ngay.

**② Idempotency** — hai test ở [:266](../../services/payment-service/internal/service/payment/payment_service_test.go:266) và [:304](../../services/payment-service/internal/service/payment/payment_service_test.go:304):

```go
// Cùng key + CÙNG payload → trả lại payment cũ, KHÔNG tạo mới
first, _  := svc.ProcessPayment(ctx, ..., "checkout-order-1", req{Amount: 120})
replayed, _ := svc.ProcessPayment(ctx, ..., "checkout-order-1", req{Amount: 120})
if len(repo.payments) != 1 { t.Fatalf("expected 1 persisted payment, got %d", len(repo.payments)) }
if replayed.ID != first.ID { t.Fatalf(...) }

// Cùng key + KHÁC payload → phải BÁO LỖI
_, err := svc.ProcessPayment(ctx, ..., "checkout-order-1", req{Amount: 60})
if !errors.Is(err, ErrIdempotencyKeyConflict) { t.Fatalf(...) }
```

Cặp test này thể hiện đúng ngữ nghĩa idempotency: *"cùng key + cùng nội dung = lặp lại;
cùng key + khác nội dung = client dùng sai, phải la lên."* Cái thứ hai quan trọng không kém
— nếu thiếu, client tái dùng key cho request khác sẽ nhận nhầm kết quả cũ.

**③ Webhook** — `TestHandleMomoWebhookCompletesPendingPayment` ([:414](../../services/payment-service/internal/service/payment/payment_service_test.go:414)):

```go
req := dto.MomoWebhookRequest{
	PaymentID: "payment-1", GatewayOrderID: "MOMO-payment-1",
	GatewayTransactionID: "txn-123", Amount: 25, ResultCode: 0,
}
req.Signature = signatureForTest("top-secret", req)      // ◄── ký y như MoMo

payment, err := svc.HandleMomoWebhook(context.Background(), req)

if payment.Status != model.PaymentStatusCompleted { t.Fatalf(...) }
if !payment.SignatureVerified { t.Fatal(...) }
if payment.OutstandingAmount != 75 { t.Fatalf(...) }     // 100 - 25
```

`signatureForTest` tính HMAC giống hệt production. **Đây là điểm cần cảnh giác:** nếu hàm
ký trong test và hàm verify trong production cùng sai một kiểu, test vẫn xanh mà thực tế
MoMo không gọi được. Bài học: test tự sinh chữ ký chỉ chứng minh **tính nhất quán nội bộ**,
không chứng minh **tương thích với bên ngoài**. Cái sau cần contract test hoặc sandbox thật.

### 7C.4. Test hàm thuần — rẻ nhất, nên viết nhiều nhất

[payment_repository_test.go](../../services/payment-service/internal/repository/payment/payment_repository_test.go):

```go
func TestPaymentCreateArgsKeepRequiredStringsNonNil(t *testing.T) {
	payment := &model.Payment{ ID: "payment-1", /* các field optional để trống */ }
	args := paymentCreateArgs(payment)

	for _, index := range []int{10, 11, 12, 14} {
		value, ok := args[index].(string)
		if !ok { t.Fatalf("expected arg %d to be a string, got %T", index, args[index]) }
		if value != "" { t.Fatalf("expected arg %d to be an empty string, got %q", index, value) }
	}
	if args[7] != nil { t.Fatalf("expected nullable reference payment id to remain nil, got %#v", args[7]) }
}
```

Test này **không đụng DB**, chỉ kiểm một hàm chuyển struct → mảng tham số SQL. Nhưng nó bắt
được một lớp bug rất khó chịu: cột `NOT NULL` mà truyền `nil` → Postgres từ chối lúc runtime;
cột nullable mà truyền `""` → lưu chuỗi rỗng thay vì NULL.

> **Bài học:** tách phần **tính toán thuần** ra khỏi phần **I/O**, rồi test phần thuần thật
> kỹ. Nó nhanh, không cần hạ tầng, và bắt được nhiều bug hơn bạn tưởng.

### 7C.5. Testcontainers — khi buộc phải có hạ tầng thật

Fake không kiểm được: SQL có đúng cú pháp không, `ON CONFLICT DO NOTHING` có chạy thật không,
`FOR UPDATE SKIP LOCKED` có hành xử như bạn nghĩ không. Những thứ đó **phải chạy trên DB thật**.

[cart_repository_integration_test.go:16](../../services/cart-service/internal/repository/cart/cart_repository_integration_test.go:16):

```go
func TestRedisCartRepositoryIntegration(t *testing.T) {
	skipIfDockerUnavailable(t)                     // ◄── ①

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "redis:7-alpine",
			ExposedPorts: []string{"6379/tcp"},
			WaitingFor:   wait.ForLog("Ready to accept connections").
			                   WithStartupTimeout(30 * time.Second),   // ◄── ②
		},
		Started: true,
	})
	if err != nil { t.Fatalf("failed to start redis container: %v", err) }
	defer func() { _ = container.Terminate(ctx) }()       // ◄── ③

	host, _ := container.Host(ctx)
	port, _ := container.MappedPort(ctx, "6379/tcp")      // ◄── ④ port NGẪU NHIÊN

	client := redis.NewClient(&redis.Options{Addr: host + ":" + port.Port()})
	defer client.Close()

	repo := NewCartRepository(client)                     // ◄── repo THẬT, Redis THẬT
	// ... Save → Get → Delete ...
}
```

Bốn chi tiết quyết định test có dùng được lâu dài hay không:

1. **`skipIfDockerUnavailable`** — máy không có Docker thì **skip**, không **fail**. Test
   phải chạy được ở mọi nơi; hạ tầng thiếu là hoàn cảnh, không phải lỗi code.
2. **`wait.ForLog(...)`** — chờ đúng dòng log "Ready to accept connections". Không dùng
   `time.Sleep(5*time.Second)` — vừa chậm vừa **flaky** (máy chậm thì 5 giây chưa đủ).
3. **`defer container.Terminate(ctx)`** — dọn sạch. Thiếu dòng này, chạy test 50 lần là 50
   container rác.
4. **`container.MappedPort`** — testcontainers gán **port ngẫu nhiên**, nên chạy 10 test
   song song không đụng nhau, và không xung đột với Redis bạn đang chạy ở cổng 6379.

Repo có 4 test loại này: cart (Redis), user + product (Postgres), order (RabbitMQ).

### 7C.6. Kim tự tháp test trong repo này

```
              ┌───────────────┐
              │  Integration  │  4 file, testcontainers, giây → phút
              │  (Docker)     │  kiểm SQL/Redis/AMQP thật
            ┌─┴───────────────┴─┐
            │   Service tests    │  ~20 file, fake, mili-giây
            │   (business logic) │  kiểm nghiệp vụ, idempotency, webhook
        ┌───┴────────────────────┴───┐
        │      Pure function tests    │  nhanh nhất, không I/O
        │  (args builder, shouldRetry)│
        └─────────────────────────────┘
```

Càng lên cao càng chậm, càng khó dựng, càng dễ flaky → **càng ít**. Đây là hình dạng đúng.
Hình dạng sai là "cây kem ốc quế": ít unit test, cả đống test end-to-end chạy 40 phút và
đỏ ngẫu nhiên.

### 7C.7. Cách chạy

Nhắc lại từ CLAUDE.md: mỗi service là **module Go riêng**, phải `cd` vào rồi mới test.

```bash
make ci                       # fmt + tidy + vet + test — chạy trước khi coi PR là "ổn"
make test                     # go test ./... cho từng module

cd services/payment-service && go test ./...                        # 1 service
cd services/payment-service && go test ./internal/service/payment/  # 1 package
cd services/payment-service && go test ./internal/service/payment/ -run TestHandleMomoWebhook -v
go test ./... -race                                                 # phát hiện data race
```

`-race` rất đáng dùng: nó phát hiện đúng loại bug ở buổi 2 (concurrent map writes) và buổi 4
(race điều kiện), những thứ chạy bình thường 999/1000 lần.

### 7C.8. Những gì repo này CHƯA test — và đó là bài tập của bạn

Đối chiếu với các pattern đã học, có mấy chỗ đáng chú ý:

| Pattern | Đã có test? | Ghi chú |
|---|---|---|
| Idempotency của `ProcessPayment` | ✅ 2 test | tốt |
| Webhook completes payment | ✅ 1 test | chỉ đường thành công |
| Webhook chữ ký **sai** | ❌ | nên có |
| Webhook **lặp** (inbox chặn) | ❌ | fake trả `false` cứng, không mô phỏng được |
| `ClaimPendingOutbox` + `SKIP LOCKED` | ❌ | cần testcontainers Postgres |
| Race 2 replica cùng claim | ❌ | cần test đồng thời |

Chú ý dòng thứ tư: `fakePaymentRepo.ApplyWebhookResult` **luôn trả `false`** cho tham số
`duplicate` ([payment_service_test.go:165](../../services/payment-service/internal/service/payment/payment_service_test.go:165)).
Nghĩa là toàn bộ nhánh chống-lặp của buổi 5 **chưa từng được test**. Fake quá đơn giản thì
test sẽ bỏ sót đúng phần khó nhất.

### ✅ Quiz buổi 7C

1. Vì sao `NewPaymentService(repo, orderLookup, nil, ...)` chạy được mà không cần DB? Liên hệ với buổi 1.
2. Fake khác mock thế nào? Vì sao repo này chọn fake?
3. Vì sao `fakePaymentRepo.GetByID` phải `copyValue := *payment`? Liên hệ buổi 2.
4. `TestProcessPaymentDefaultsToOutstandingAmount` kiểm `repo.createdOutbox != nil`. Nó bảo vệ hợp đồng nào của buổi 4–6?
5. Vì sao cần **cả hai** test idempotency (cùng payload / khác payload)? Thiếu cái thứ hai thì bug gì lọt lưới?
6. `signatureForTest` tính HMAC y như production. Điểm mù của cách test này là gì?
7. Bốn chi tiết trong test testcontainers: skip, wait, terminate, mapped port — bỏ mỗi cái đi thì hỏng thế nào?
8. Vì sao `wait.ForLog` tốt hơn `time.Sleep(5*time.Second)`?
9. `-race` phát hiện được loại bug nào? Cho ví dụ từ buổi 2.
10. (Thực hành) Viết `TestHandleMomoWebhookRejectsInvalidSignature`. Gợi ý: tạo `req` rồi gán `req.Signature = "sai-bet"`, kỳ vọng `ErrInvalidWebhookSignature`.
11. (Khó) `fakePaymentRepo.ApplyWebhookResult` luôn trả `duplicate = false`. Sửa fake thế nào để test được nhánh inbox chặn hàng lặp? Rồi viết test đó.

---

## Buổi 8 — Redis Caching

Buổi 5–6 học Redis trong vai **hàng đợi/khử trùng lặp**. Buổi này học vai còn lại của nó:
**cache**. Repo đã có sẵn một implementation chất lượng cao ở
`services/product-service/internal/repository/product/product_review_cache.go` — ta mổ nó.

### Vấn đề

Mỗi lần khách mở trang sản phẩm, backend chạy hai query:

```sql
SELECT AVG(rating), COUNT(*) FROM product_reviews WHERE product_id = 'abc';
SELECT * FROM product_reviews WHERE product_id = 'abc' ORDER BY created_at DESC LIMIT 10;
```

Sản phẩm hot có 50.000 review, 1.000 người xem/phút → PostgreSQL quét-tính-sắp xếp **1.000
lần/phút cho cùng một kết quả y hệt**.

📖 Nhận xét then chốt: review **đọc rất nhiều, ghi rất ít** — tỷ lệ lệch cỡ 10.000:1. Đó là
chữ ký của dữ liệu đáng cache.

📖 **Ví von:** cache là **ly cà phê pha sẵn để trên bàn**. Pha mất 3 phút, rót mất 2 giây. Đổi
lại hai rắc rối — cà phê **nguội** (cần TTL) và **đổi loại hạt thì bình cũ thành sai** (cần
invalidation). Toàn bộ buổi này xoay quanh hai rắc rối đó.

| | PostgreSQL | Redis |
|---|---|---|
| Lưu ở đâu | đĩa cứng (bền) | RAM (nhanh, dễ mất) |
| Tốc độ đọc | mili-giây | **micro-giây** (~100–1000× nhanh hơn) |
| Vai trò | **nguồn sự thật** | **bản sao tạm** |
| Mất dữ liệu | thảm họa | chấp nhận được (tính lại từ DB) |

🎯 **Nguyên tắc sống còn: cache không bao giờ là nguồn sự thật.** Mất sạch Redis thì hệ thống
chỉ **chậm đi**, không được **sai đi**.

### Cache-Aside — mẫu đọc

`services/product-service/internal/service/product_review_service.go:378`:

```go
func (s *ProductReviewService) loadReviewSummary(ctx context.Context, productID string) (*model.ProductReviewSummary, error) {
	if s.cache != nil {
		summary, hit, err := s.cache.GetSummary(ctx, productID)
		if err != nil {
			// ② Redis lỗi → CHỈ cảnh báo, KHÔNG return
			s.warnCacheFailure(ctx, "failed to get product review summary from cache", productID, err)
			appobs.IncEvent(productReviewMetricsService, "review_summary_cache_fallback", appobs.OutcomeSystemError)
		} else if hit {
			// ③ HIT → trả luôn, không đụng PostgreSQL
			appobs.IncEvent(productReviewMetricsService, "review_summary_cache_hit", appobs.OutcomeSuccess)
			return summary, nil
		} else {
			// ④ MISS → ghi nhận rồi đi tiếp
			appobs.IncEvent(productReviewMetricsService, "review_summary_cache_miss", appobs.OutcomeSuccess)
		}
	}

	summary, err := s.repo.GetReviewSummary(ctx, productID)   // ⑤ nguồn sự thật
	if err != nil {
		return nil, err
	}

	if s.cache != nil {                                       // ⑥ nhét vào cache cho lần sau
		if err := s.cache.SetSummary(ctx, productID, summary); err != nil {
			s.warnCacheFailure(ctx, "failed to set product review summary cache", productID, err)
		}
	}
	return summary, nil
}
```

```
   Request ──▶ ① hỏi cache
                  │
       HIT ✓ ─────┴───── MISS ✗
         │                 │
   ③ trả (~0.2ms)    ⑤ query PostgreSQL (~20ms)
                           │
                     ⑥ ghi vào cache → trả
```

📖 Gọi là **cache-aside** ("cache đứng bên cạnh") vì cache **không nằm trên đường đi bắt buộc**:
app tự hỏi, tự query DB khi miss, tự nhét lại. Ưu điểm lớn nhất — **cache chết thì hệ thống vẫn
chạy**.

### Ba trạng thái, không phải hai

```go
GetSummary(ctx, productID) (*model.ProductReviewSummary, bool, error)
//                            ▲dữ liệu               ▲hit  ▲lỗi
```

Biến thể của **comma-ok idiom** (buổi 2). Phải phân biệt:

| Tình huống | `hit` | `err` | Xử lý |
|---|---|---|---|
| Có trong cache | `true` | `nil` | trả luôn |
| **Miss** (chưa cache) | `false` | `nil` | im lặng query DB |
| **Redis lỗi** | `false` | lỗi | **log + metric** rồi query DB |

```go
value, err := c.client.Get(ctx, c.summaryKey(productID)).Result()
if err == redis.Nil {          // ← "key không tồn tại", KHÔNG phải lỗi
	return nil, false, nil
}
if err != nil {                // ← lỗi thật
	return nil, false, fmt.Errorf("failed to get product review summary cache: %w", err)
}
```

📖 `redis.Nil` là **sentinel error** (buổi 1) — đúng cách `redisCartRepository.Get` xử lý ở
buổi 1. Gộp miss với lỗi = mất khả năng biết Redis đang chết.

### Thiết kế khóa

```go
func (c *RedisProductReviewCache) summaryKey(productID string) string {
	return fmt.Sprintf("product-review:summary:%s", productID)
}
func (c *RedisProductReviewCache) firstPageKey(productID string, limit int) string {
	return fmt.Sprintf("product-review:list:%s:limit:%d", productID, limit)
}
```

```
product-review : summary : abc123
    ▲              ▲         ▲
    │              │         └── định danh cụ thể
    │              └──────────── loại dữ liệu
    └─────────────────────────── namespace
```

🎯 **`limit` nằm trong key.** Vì "10 review đầu" ≠ "20 review đầu". Quy tắc tổng quát: **cache
key phải là hàm của TẤT CẢ đầu vào ảnh hưởng tới đầu ra** (filter, sort, page, limit, và
`userID` nếu kết quả khác nhau theo người dùng).

### Invalidation qua Observer

`services/product-service/internal/service/product_review_observer.go:57`:

```go
type productReviewCacheInvalidationObserver struct{ cache ProductReviewCache }

func (o productReviewCacheInvalidationObserver) Handle(ctx context.Context, event ProductReviewEvent) error {
	return o.cache.Invalidate(ctx, event.ProductID)
}
```

Thay vì `CreateReview` tự gọi đủ thứ việc phụ, nó **phát một sự kiện**; ai quan tâm tự đăng ký:

```go
// ❌ nhét vào service core → càng ngày càng phình
...runInTx(); s.cache.Invalidate(); s.metrics.Inc(); s.searchIndex.Update()

// ✅ repo làm
...runInTx(); s.observers.Notify(ctx, event)
```

Thêm việc phụ = thêm observer, **không sửa `CreateReview`** → Open/Closed Principle.

🎯 **Nối buổi 1 và 3:** `ProductReviewCache` là interface khai ở **tầng service**
(`product_review_service.go:48`), implementation Redis ở tầng repository. Đây là bản **chuẩn
mực hơn** `CartRepository` đã bàn ở buổi 3 — consumer sở hữu hợp đồng, mũi tên phụ thuộc hướng
đúng vào trong.

### 🎩 Index Set — xóa hàng loạt mà không dùng `KEYS`

Một sản phẩm có nhiều key list (`limit:5`, `limit:10`, `limit:20`) + key summary. Khi có review
mới phải xóa hết. Làm sao biết key nào tồn tại?

❌ `KEYS product-review:list:abc:*` — **quét toàn bộ keyspace và chặn Redis**. Redis xử lý
**đơn luồng**, nên một lệnh chậm làm *mọi* client khác đứng hình: giỏ hàng, rate limiter, dedupe
notification đều dùng chung Redis này. **Không bao giờ dùng `KEYS` trong production.**

✅ Repo **tự ghi sổ**:

```go
func (c *RedisProductReviewCache) SetFirstPage(ctx, productID string, limit int, reviews []*model.ProductReview) error {
	pageKey  := c.firstPageKey(productID, limit)
	indexKey := c.firstPageIndexKey(productID)

	pipe := c.client.TxPipeline()
	pipe.Set(ctx, pageKey, payload, c.ttl)   // ① lưu dữ liệu
	pipe.SAdd(ctx, indexKey, pageKey)        // ② ghi tên key vào "mục lục"
	pipe.Expire(ctx, indexKey, c.ttl)        // ③ mục lục cũng có hạn
	_, err := pipe.Exec(ctx)
}

func (c *RedisProductReviewCache) Invalidate(ctx context.Context, productID string) error {
	pageKeys, _ := c.client.SMembers(ctx, indexKey).Result()   // ① đọc mục lục
	keys := append([]string{c.summaryKey(productID), indexKey}, pageKeys...)
	return c.client.Del(ctx, keys...).Err()                    // ② xóa một phát
}
```

📖 Đây là **mục lục cuốn sách**: thay vì lật từng trang tìm chỗ cần xé, mở mục lục thấy ngay
"trang 5, 10, 20". Độ phức tạp từ *O(toàn bộ database)* xuống *O(số key của riêng sản phẩm đó)*.

⚠️ **`TxPipeline` ≠ transaction SQL.** Nó gộp nhiều lệnh vào **một chuyến mạng** và chạy liền
mạch không bị chen, nhưng Redis **không có rollback** — một lệnh lỗi thì các lệnh khác vẫn chạy.

### TTL — lưới an toàn

Đã có invalidation chủ động rồi, vì sao vẫn cần TTL? Vì invalidation **có thể sót**:
- ai đó sửa dữ liệu thẳng trong DB bằng script → observer không chạy;
- lệnh `Invalidate` lỗi mạng và chỉ được log rồi bỏ qua;
- lập trình viên thêm đường ghi mới mà **quên gắn observer**.

🎯 TTL biến một bug "vĩnh viễn" thành bug "kéo dài tối đa N phút". **Luôn đặt TTL cho mọi key
cache**, kể cả khi tin invalidation của mình hoàn hảo.

| TTL | Ưu | Nhược |
|---|---|---|
| Ngắn (30s) | dữ liệu tươi | ít hit, DB vẫn nặng |
| Dài (1h) | hit cao | ôi lâu nếu sót invalidation |

### Graceful degradation

Redis sập hoàn toàn → API **vẫn đúng, chỉ chậm hơn**. Vì cache là thứ *tăng tốc*, không phải
*bắt buộc*. Bắt request fail chỉ vì ghi cache hỏng = tự biến Redis thành **điểm chết đơn lẻ**.

⚠️ Nhưng "degrade" **không phải** "nuốt lỗi": code vẫn `warnCacheFailure` + tăng metric
`cache_fallback` với outcome `SystemError` → vẫn nhìn thấy trên dashboard. Đúng tinh thần
`CLAUDE.md`: *graceful degradation là chủ đích, không phải nuốt lỗi*.

### Đo hit rate

```go
appobs.IncEvent(..., "review_summary_cache_hit", ...)
appobs.IncEvent(..., "review_summary_cache_miss", ...)
appobs.IncEvent(..., "review_summary_cache_fallback", ...)
```

**Hit Rate = hit / (hit + miss)** — chỉ số quan trọng nhất.

| Hit rate | Ý nghĩa |
|---|---|
| > 90% | cache đang làm tốt |
| 50–80% | ổn, cân nhắc tăng TTL |
| < 30% | 🚩 gần như vô dụng — TTL quá ngắn, invalidate quá nhiều, hoặc key thiết kế sai |

🎯 Cache **không đo được = không biết có tác dụng hay không**.

### Bốn mẫu caching

| Mẫu | Cách chạy | Đánh đổi |
|---|---|---|
| **Cache-aside** (repo dùng) | app tự hỏi → miss thì tự query → tự nhét | ✅ đơn giản, cache chết vẫn chạy |
| Read-through | app chỉ nói với cache; cache tự lấy DB | ❌ cache thành đường bắt buộc |
| Write-through | ghi cache + DB đồng bộ | ✅ luôn tươi ❌ ghi chậm |
| Write-behind | ghi cache trước, DB sau | ❌ **mất dữ liệu** nếu cache sập |

👉 Cache-aside đúng cho repo vì nó giữ nguyên *"PostgreSQL là nguồn sự thật"*. Write-behind sẽ
biến Redis (RAM) thành nơi giữ dữ liệu thật một khoảng thời gian — vi phạm nguyên tắc đó.

### Cache stampede (gap thật của repo)

```
t=0.000s  cache của sản phẩm hot hết hạn
t=0.001s  Request 1 → miss → query DB (200ms)
t=0.002s  Request 2 → miss (R1 chưa kịp ghi cache) → query DB
   ...
t=0.200s  → 1.000 query GIỐNG HỆT NHAU cùng đập vào PostgreSQL
```

Trớ trêu: **cache sinh ra để bảo vệ DB, nhưng đúng lúc hết hạn lại dồn tải cực đại vào DB** — và
đúng vào lúc đông khách nhất. Nếu DB chậm lại, cửa sổ miss rộng ra → càng nhiều request dồn vào
→ **vòng xoáy sụp đổ**.

Ba cách chống (repo **chưa** làm — bài tập tốt):
1. **Khóa phân tán** (`SETNX`) — chỉ 1 request đi query, số còn lại đợi kết quả đó.
2. **Jitter** — TTL `300s ± ngẫu nhiên 30s` để các key không hết hạn cùng giây.
3. **Làm mới sớm** — còn 10% thời gian sống thì chủ động refresh, các request khác vẫn dùng bản cũ.

### Khi nào KHÔNG nên cache

| Tình huống | Vì sao |
|---|---|
| Dữ liệu đổi liên tục | invalidate suốt → hit rate thấp |
| **Phải chính xác tuyệt đối** | số dư ví, tồn kho lúc trừ hàng |
| Query vốn đã nhanh | thêm phức tạp mà không lợi |
| Dữ liệu riêng từng người | hit rate ~0, tốn RAM |
| Chưa đo được vấn đề | **đừng tối ưu khi chưa biết chỗ nào chậm** |

🎯 Để ý repo **không cache** giá và tồn kho lúc đặt hàng — `quoteOrder` (buổi 4) luôn hỏi
`product-service` lấy sự thật mới nhất. Thà chậm còn hơn bán sai giá.

### ✅ Quiz buổi 8

1. `GetSummary` trả `(data, hit, err)`. Vì sao không gộp thành `(data, err)`?
2. `redis.Nil` được trả về với `err = nil`. Vì sao "không tìm thấy key" không bị coi là lỗi?
3. Vì sao `limit` phải nằm trong cache key? Nêu một biến thể của lỗi này gây lỗ hổng **bảo mật**.
4. Vì sao repo dùng index set thay vì `KEYS product-review:list:abc:*`? Liên hệ đặc tính đơn luồng của Redis.
5. Đã có invalidation chủ động, vì sao vẫn cần TTL? Nêu 3 tình huống invalidation sót.
6. `SetSummary` lỗi nhưng code vẫn `return summary, nil`. Vì sao đúng? Điều gì phân biệt nó với "nuốt lỗi"?
7. `ProductReviewCache` khai ở package `service`, implementation ở `repository`. So sánh với `CartRepository` ở buổi 3 — bản nào chuẩn hơn và vì sao?
8. Giải thích cache stampede và vì sao nó trớ trêu. Vì sao jitter là biện pháp rẻ nhất?
9. `TxPipeline` khác transaction PostgreSQL (buổi 4) ở điểm nào?
10. (Khó) Thiết kế cách chống stampede bằng `SETNX` cho `loadReviewSummary`. Request thua khóa nên làm gì — đợi, hay trả dữ liệu cũ?

---

## Phụ lục — Tra nhanh

### Các pattern độ tin cậy và nơi chúng sống

| Pattern | File | Buổi |
|---|---|---|
| Transaction bundle | `order_repository_orders.go` → `createOrderTx` | 4 |
| Compare-and-set (kho) | `product_repository.go` → `UpdateStock` | 4 |
| Compare-and-set (webhook) | `payment_repository.go` → `ApplyWebhookResult` | 5 |
| Row lock | `order_repository_commerce.go` → `lockAndConsumeCoupon` | 4 |
| Idempotency key | `payment_processing.go`, `order_lifecycle.go` | 4, 5 |
| Inbox (Postgres) | `payment_repository.go` → `insertInboxMessageTx` | 5 |
| Inbox (Redis/Lua) | `notification-service/internal/inbox/redis_store.go` | 6 |
| Outbox relay | `payment_events.go` → `StartOutboxRelay` | 6 |
| Lease claim | `payment_repository.go` → `ClaimPendingOutbox` | 6 |
| HMAC webhook | `payment_helpers.go` → `verifyMomoWebhookSignature` | 5, 7A |
| Token bucket | `pkg/middleware/rate_limit.go` | 7A |
| Circuit breaker | `api-gateway/internal/proxy/service_proxy.go` | 7B |

### Năm nguyên tắc xuyên suốt cả khóa

1. **Lớp phòng thủ cuối cùng phải nằm trong database**, dưới dạng ràng buộc không code nào
   đi vòng được (UNIQUE, PRIMARY KEY, `WHERE` trong UPDATE). Kiểm tra ở tầng application
   luôn có khe hở TOCTOU.
2. **Đừng đọc → quyết định → ghi.** Hãy để DB vừa quyết định vừa ghi trong một câu, rồi hỏi
   `RowsAffected()`.
3. **Trạng thái chia sẻ giữa nhiều tiến trình không bao giờ được nằm trong RAM.**
4. **At-least-once + idempotent consumer = hiệu quả exactly-once.** Không tầng nào một mình
   làm được.
5. **Fail closed hay fail open là lựa chọn có chủ đích**, quyết định bằng hậu quả của việc
   đoán sai — không phải bằng thói quen.

---

# ĐÁP ÁN

> Đọc phần này **sau khi** đã tự trả lời. Đáp án ở đây là đáp án mẫu, không phải đáp án
> duy nhất — nếu bạn lập luận khác mà vẫn đúng, càng tốt.

## Đáp án buổi 3

**1.** *Dependency Rule:* mã nguồn ở vòng trong không được biết bất cứ điều gì về vòng ngoài.
Cụ thể: entity không biết use case, use case không biết framework, và mọi mũi tên `import`
chỉ được hướng vào trong.

**2.** Vì `echo.Context` là kiểu của **framework HTTP**. Nhận nó vào service nghĩa là:
(a) không test được service nếu không dựng một HTTP request giả; (b) không tái dùng service
cho gRPC/CLI/worker; (c) đổi Echo sang Gin phải sửa cả tầng nghiệp vụ. Service nên nhận
`ctx context.Context` + các giá trị đã bóc sẵn (`userID string`, DTO).

**3.** *Mass assignment* là khi bind thẳng JSON của client vào entity, cho phép client ghi
đè những field mà nó không có quyền. Ví dụ: nếu `POST /api/v1/payments` bind vào
`model.Payment`, kẻ tấn công gửi `{"status":"completed","signature_verified":true}` là tự
đánh dấu mình đã trả tiền. DTO `ProcessPaymentRequest` chỉ có 3 field nên không thể.

**4.** Không vi phạm. Import của `order_lifecycle.go` chỉ gồm stdlib, `zap`, `uuid`,
`pkg/observability`, và các package `internal/{client,dto,model,repository}` của chính
service. Không có `echo`, không có `database/sql` — đúng hướng phụ thuộc.

**5.** `ProductCatalog` đúng chuẩn hơn: nó được khai báo ở tầng **dùng** (service), nên tầng
service hoàn toàn không phụ thuộc package nào bên ngoài để mô tả nhu cầu của mình.
`CartRepository` nằm ở package `repository`, nên `service` phải `import repository` — mũi tên
phụ thuộc vẫn tồn tại, chỉ là trỏ vào một interface thay vì struct. Mất tính thuần khiết,
**giữ được** lợi ích chính là test fake được. Thoả hiệp chấp nhận được ở service nhỏ.

### Chữa sâu buổi 3 — lỗi hay gặp

> Phần này bổ sung cho đáp án ở trên: mỗi câu thêm một tầng *vì sao sâu hơn* và *cái bẫy mà
> phần lớn người học rơi vào*. Nếu bạn trả lời đúng ý chính nhưng chưa nói được phần 🔍, tức là
> bạn hiểu **luật** nhưng chưa hiểu **lý do sinh ra luật**.

**Câu 1 — Dependency Rule.**
🔍 *Sâu hơn:* luật này không phải quy ước thẩm mỹ, nó bắt nguồn từ **tốc độ thay đổi**. Vòng
trong đổi chậm (khái niệm "đơn hàng" 10 năm không đổi), vòng ngoài đổi nhanh (Echo, Redis, MoMo).
Bắt thứ chậm phụ thuộc thứ nhanh nghĩa là mỗi lần đổi thư viện lại phải sửa nghiệp vụ.
⚠️ *Lỗi hay gặp:* trả lời "để code sạch". Chưa đủ — phải nêu được **hệ quả kinh tế**: đổi hạ tầng
không lan vào business logic, và test được business logic mà không dựng hạ tầng.

**Câu 2 — vì sao service không nhận `echo.Context`.**
🔍 *Sâu hơn:* `echo.Context` không chỉ là "một kiểu dữ liệu", nó là **cái cổng vào toàn bộ thế
giới HTTP** — có `Request()`, `Response()`, `Param()`, `Bind()`. Nhận nó vào service tức là mở
cửa cho người viết sau tiện tay gọi `c.JSON(...)` ngay trong tầng nghiệp vụ, và thế là tầng đó
chết cứng với HTTP.
⚠️ *Lỗi hay gặp:* nghĩ rằng chỉ cần "không dùng tới nó" là an toàn. Không — **có sẵn trong tay
là sẽ có người dùng**. Chặn từ chữ ký hàm mới là chặn thật.

**Câu 3 — mass assignment.**
🔍 *Sâu hơn:* gốc rễ là **entity mô tả thứ hệ thống biết, DTO mô tả thứ client được phép nói**.
Hai tập này gần như không bao giờ trùng nhau. Mỗi field trong entity mà client không được đặt
(`status`, `signature_verified`, `created_at`, `user_id`) đều là một lỗ hổng nếu bind thẳng.
⚠️ *Lỗi hay gặp:* tin rằng thêm validation là đủ. Validation kiểm **giá trị hợp lệ**, không kiểm
**field có được phép xuất hiện hay không**. Chỉ DTO hẹp mới làm được việc đó.

**Câu 4 — kiểm tra `order_lifecycle.go` có vi phạm không.**
🔍 *Sâu hơn:* kỹ năng thật ở đây là **đọc khối `import` như đọc bản đồ phụ thuộc**. Đây là cách
review nhanh nhất: không cần đọc logic, chỉ nhìn import là biết file có đứng đúng tầng không.
⚠️ *Lỗi hay gặp:* chỉ nhìn tên package của repo mà bỏ qua thư viện bên thứ ba. `zap` và `uuid`
là *tiện ích trung lập* nên chấp nhận được; `echo`, `database/sql`, `go-redis`, `amqp` là *hạ
tầng* nên không được. Ranh giới nằm ở chỗ: thư viện đó có buộc bạn vào một **giao thức/cơ chế
lưu trữ** cụ thể không.

**Câu 5 — `ProductCatalog` vs `CartRepository`.**
🔍 *Sâu hơn:* đây là ví dụ về **"clean vừa đủ"**. Câu hỏi đúng khi review không phải "interface
đặt đúng chỗ sách dạy chưa?" mà là **"lợi ích cốt lõi còn không?"** — với `CartRepository`, lợi
ích *test bằng fake* và *đổi storage không sửa service* **vẫn còn**. Mất tính thuần khiết, giữ
được giá trị.
⚠️ *Lỗi hay gặp:* hai thái cực — (1) khăng khăng mọi interface phải ở tầng use case, biến
codebase thành rừng abstraction; (2) coi "interface nào cũng như nhau", bỏ luôn việc phân biệt.
Người có nghề nhận ra sự khác biệt **và** biết khi nào nó đáng để đánh đổi. Xem thêm buổi 8:
`ProductReviewCache` là bản chuẩn mực của cùng mẫu này.

## Đáp án buổi 4

**1.** TOCTOU = Time Of Check To Time Of Use, khe hở giữa lúc kiểm tra và lúc dùng kết quả:

```
kho còn 1 cái
t=0ms  A: SELECT stock → 1   → "còn hàng"
t=1ms  B: SELECT stock → 1   → "còn hàng"   ← B kiểm tra trên dữ liệu đã cũ
t=2ms  A: UPDATE stock = 0
t=3ms  B: UPDATE stock = -1                 ← bán quá kho
```

**2.** Vì `tx` là **phiên transaction đang mở**. Dùng `r.db` sẽ mở một kết nối khác, nằm
**ngoài** transaction: coupon bị trừ lượt vĩnh viễn kể cả khi đơn hàng rollback, và row lock
`FOR UPDATE` không còn tác dụng vì hai phiên khác nhau. Tệ hơn: hai phiên có thể **deadlock**
chờ nhau.

**3.** CAS khi điều kiện đủ đơn giản để viết trong `WHERE` và ta muốn tốc độ (trừ kho, đổi
trạng thái). `FOR UPDATE` khi cần đọc ra rồi chạy nhiều luật nghiệp vụ trong Go trước khi
ghi (coupon: còn hạn? đủ min order? còn lượt?). Ví dụ mới: trừ số ghế còn trống của một suất
chiếu → CAS. Duyệt hạn mức tín dụng dựa trên lịch sử 6 tháng → `FOR UPDATE`.

**4.** Chỉ **lớp 2 (UNIQUE constraint)** cứu được. Lớp 1 đọc bảng idempotency trước, nhưng hai
request đồng thời đều đọc thấy "chưa có" rồi cùng đi tiếp — đúng TOCTOU của câu 1. UNIQUE
constraint được PostgreSQL thực thi ở thời điểm ghi, nên chỉ một request thắng; request thua
nhận unique violation, bắt lỗi đó rồi đọc lại bản ghi của người thắng.

**5.** Không hại. Sau `Commit()`, transaction đã kết thúc; `Rollback()` trả về
`sql.ErrTxDone` và không làm gì cả. Giá trị của việc đặt `defer` ngay sau `BeginTx` là: mọi
đường thoát khỏi hàm (return sớm vì lỗi, panic) đều được dọn dẹp, không cần nhớ gọi rollback
ở từng nhánh.

**6.** Kịch bản: trừ kho ở product-service ✓ → tạo đơn ở order-service ✗ → gọi
`restoreOrderItemsStock` để trả kho, nhưng đúng lúc đó product-service restart / mạng đứt →
lời gọi hoàn kho thất bại. Kho bị "giam" số lượng của một đơn không tồn tại.
Cách phát hiện: job đối soát định kỳ so tổng `stock` + tổng số lượng đang được giữ trong các
đơn `pending` với số lượng gốc; hoặc metric đếm số lần `restoreOrderItemsStock` fail và cảnh
báo khi > 0. Bản chất: **đã bỏ transaction phân tán thì phải có cơ chế dọn rác**.

### Chữa sâu buổi 4 — lỗi hay gặp

**Câu 1 — TOCTOU.**
🔍 *Sâu hơn:* điều làm TOCTOU đáng sợ là nó **không tái hiện được khi debug**. Chạy tay từng
request thì luôn đúng; chỉ sai khi có tải thật. Nên không thể dựa vào test thủ công để phát hiện
— phải nhận ra bằng **cách đọc code**: hễ thấy mẫu `đọc → quyết định → ghi` trên dữ liệu dùng
chung là phải hỏi ngay "giữa hai bước này có ai chen vào được không?".
⚠️ *Lỗi hay gặp:* tưởng rằng bọc cả ba bước trong một transaction là đủ. **Không** — transaction
cho *atomicity* (tất cả hoặc không gì), không tự động cho *isolation* đủ mạnh để chặn hai phiên
cùng đọc giá trị cũ. Phải thêm `FOR UPDATE` hoặc gộp điều kiện vào `WHERE`.

**Câu 2 — vì sao phải dùng `tx` chứ không phải `r.db`.**
🔍 *Sâu hơn:* `*sql.DB` là một **connection pool**, không phải một kết nối. Gọi `r.db.Exec` giữa
chừng transaction sẽ **mượn một kết nối khác** từ pool — một phiên hoàn toàn độc lập, không thấy
dữ liệu chưa commit của transaction đang chạy, và không bị ràng buộc bởi rollback của nó.
⚠️ *Lỗi hay gặp:* nghĩ rằng "cùng một struct repository thì cùng một transaction". Không có gì
đảm bảo điều đó — **transaction nằm ở biến `tx`, không nằm ở struct**. Đây là lý do mọi hàm
`*Tx` trong repo đều nhận `tx *sql.Tx` làm tham số tường minh.

**Câu 3 — CAS vs `FOR UPDATE`.**
🔍 *Sâu hơn:* tiêu chí quyết định là **"có bao nhiêu logic nằm giữa lúc đọc và lúc ghi"**. Nếu
điều kiện viết được trọn trong `WHERE` → CAS (nhẹ, không giữ khóa, không rủi ro deadlock). Nếu
phải đọc ra rồi chạy nhiều luật trong Go, và mỗi luật cần trả **mã lỗi riêng** cho người dùng →
`FOR UPDATE`.
⚠️ *Lỗi hay gặp:* mặc định dùng `FOR UPDATE` cho mọi thứ vì "chắc ăn hơn". Khóa bi quan làm
giảm thông lượng và mở ra khả năng **deadlock** khi hai transaction khóa nhiều dòng theo thứ tự
khác nhau. Dùng khóa là chọn *đánh đổi*, không phải chọn *an toàn hơn*.

**Câu 4 — hai request đồng thời cùng `Idempotency-Key`.**
🔍 *Sâu hơn:* điểm cốt lõi là **nơi nào có thể phân xử tranh chấp**. Tầng ứng dụng không thể —
hai goroutine đọc cùng lúc đều thấy "chưa có". Chỉ **database** mới có điểm đồng bộ hóa duy nhất
(unique index). Nguyên tắc tổng quát: *khi cần chọn đúng một người thắng giữa nhiều tiến trình,
hãy để tầng lưu trữ phân xử, đừng tự phân xử ở tầng ứng dụng.*
⚠️ *Lỗi hay gặp:* bắt được unique violation rồi **trả lỗi 409 cho client**. Sai — client chỉ
đang retry một cách hợp lệ, nó xứng đáng nhận **đúng đơn hàng đã tạo**. Phải đọc lại bản ghi của
người thắng và trả về, đúng như repo làm.

**Câu 5 — `defer tx.Rollback()` sau khi đã `Commit()`.**
🔍 *Sâu hơn:* mấu chốt là `Rollback()` trên transaction đã kết thúc trả `sql.ErrTxDone` — một
**no-op an toàn**. Điều này biến `defer tx.Rollback()` thành mẫu "đặt một lần, đúng mãi mãi",
kể cả khi ai đó thêm một nhánh `return` mới sáu tháng sau.
⚠️ *Lỗi hay gặp:* viết `defer func() { if err != nil { tx.Rollback() } }()` — phức tạp hơn mà
lại dễ sai (biến `err` bị che bởi biến cùng tên ở scope trong). Cứ rollback vô điều kiện là
đúng và đơn giản nhất.

**Câu 6 — compensation thất bại.**
🔍 *Sâu hơn:* bài học lớn nhất của buổi 4 nằm ở đây: **bỏ transaction phân tán thì phải trả giá
bằng cơ chế dọn rác**. Saga không làm hệ thống nhất quán *ngay*, nó chỉ hứa nhất quán *cuối
cùng* — và lời hứa đó chỉ có giá trị nếu thật sự có job đối soát chạy.
⚠️ *Lỗi hay gặp:* viết compensation rồi coi như xong, không đo. Tối thiểu phải có **metric đếm
số lần compensation thất bại** và cảnh báo khi > 0. Không đo thì "eventual consistency" trên
thực tế là "never consistent, nhưng không ai biết".

## Đáp án buổi 5

**1.** Vì MoMo là server của một công ty khác — nó không có JWT của khách hàng bạn, bắt nó gửi
JWT là vô nghĩa. Thay cho JWT là **chữ ký HMAC**: MoMo và bạn cùng biết một secret, MoMo ký
nội dung, bạn ký lại và so. Điểm cần nhớ: route này ai trên Internet cũng POST được (đã kiểm
chứng ở cả `payment-service` lẫn `api-gateway`), nên `verifyMomoWebhookSignature` là lớp
phòng thủ **duy nhất**.

**2.** Toàn bộ hệ thống thanh toán thành cửa mở. Bất kỳ ai cũng POST được
`{"payment_id":"...","result_code":0}` với chữ ký rỗng và tự đánh dấu đơn của mình đã trả
tiền → nhận hàng miễn phí. Và điều nguy hiểm nhất: **triệu chứng không xuất hiện** cho tới
khi có người khai thác, vì luồng bình thường vẫn chạy đúng.

**3.** Vì cổng thanh toán hiểu 4xx/5xx là "bên kia chưa nhận được" và sẽ **gọi lại mãi**.
Trả 200 nghĩa là "tôi nhận rồi, dừng gửi". Với webhook, *"tôi đã xử lý chuyện này rồi"* là
**thành công**, không phải lỗi.

**4.** Inbox **không** chặn được: `message_id` được băm từ nội dung, đổi
`gateway_transaction_id` là ra hash khác nên `ON CONFLICT` không kích hoạt. Cái chặn là
**compare-and-set** `WHERE id = $14 AND status = 'pending'` — payment đã completed nên
`rowsAffected = 0`. (Trước đó còn có chốt ④ ở tầng service, nhưng chốt đó có khe hở TOCTOU;
CAS mới là lớp cuối.)

**5.** Nó cố tình giữ lại **inbox row**. Lợi ích: delivery này đã được ghi nhận là "đã xử lý",
nên nếu cổng gửi lại đúng payload đó lần nữa, lần sau bị chặn ngay ở bước inbox — rẻ hơn
(không cần chạy tới CAS). Rollback thì sẽ mất ghi nhận đó.

**6.** Timeline:

```
t=0ms   Webhook A (result_code=0) tới. Chốt ④ đọc status = pending  ✓ đi tiếp
t=1ms   Webhook B (result_code=49, txn khác) tới. Chốt ④ cũng đọc pending ✓ đi tiếp
t=2ms   B chạy ApplyWebhookResult trước → inbox ghi, CAS khớp → status = failed
t=3ms   A chạy ApplyWebhookResult → inbox ghi (hash khác nên không trùng)
                                  → CAS KHÔNG khớp (status đã là failed) → rowsAffected = 0
t=3ms   A nhận (false, nil) → rơi vào nhánh "thành công" → trả `enriched` (completed)
```

Client của A nhận `status: completed` trong khi DB nói `failed`.

*Cách sửa:* làm giống nhánh `duplicate` — đọc lại từ DB rồi trả state thật.
**Đã sửa trong repo (2026-07-26):** `ApplyWebhookResult` giờ trả `unchanged = true` cho cả hai
trường hợp không đổi được state, và `HandleGatewayWebhook` reload từ DB ở cả hai. Có test
`TestHandleMomoWebhookReportsStoredStateWhenCompareAndSetMisses` khoá lại hành vi này.

### Chữa sâu buổi 5 — lỗi hay gặp

**Câu 1 — vì sao webhook không dùng JWT mà dùng HMAC.**
🔍 *Sâu hơn:* khác biệt nằm ở **ai là chủ thể xác thực**. JWT trả lời "người dùng nào đang gọi?";
HMAC webhook trả lời "lời gọi này có thật sự đến từ đối tác không, và nội dung có bị sửa trên
đường không?". Đây là *authentication of the sender + integrity of the payload*, không phải
*authorization of a user*.
⚠️ *Lỗi hay gặp:* so chữ ký bằng `==` thay vì `hmac.Equal`. So chuỗi thường thoát sớm ở byte đầu
khác nhau → lộ thông tin qua **thời gian phản hồi** (timing attack). Luôn dùng so sánh
constant-time.

**Câu 2 — hậu quả nếu bỏ verify chữ ký.**
🔍 *Sâu hơn:* điều nguy hiểm nhất không phải lỗ hổng, mà là **lỗ hổng không có triệu chứng**.
Luồng hợp lệ vẫn chạy đúng 100%, test vẫn xanh, monitoring vẫn im lặng — cho tới ngày có người
khai thác. Đây là loại bug mà **chỉ code review và test tấn công** mới bắt được, không phải
observability.
⚠️ *Lỗi hay gặp:* tin rằng "URL webhook bí mật nên không ai biết". Bảo mật bằng che giấu không
phải bảo mật: URL rò qua log, qua proxy, qua ảnh chụp màn hình, qua repo public.

**Câu 3 — vì sao trả 200 cho delivery trùng.**
🔍 *Sâu hơn:* phải phân biệt **"lỗi của bạn"** với **"tình huống bạn đã xử lý xong"**. Với
webhook, ngữ nghĩa của mã trạng thái là *hợp đồng điều khiển việc gửi lại* của đối tác, không
phải mô tả nội bộ của bạn. "Tôi đã xử lý rồi" = thành công = 200.
⚠️ *Lỗi hay gặp:* trả 409 Conflict cho delivery trùng vì thấy "nghe hợp lý". Cổng thanh toán sẽ
hiểu là thất bại và **gửi lại mãi**, tạo bão retry — đúng thứ inbox pattern sinh ra để tránh.

**Câu 4 — cái gì thật sự chặn khi `gateway_transaction_id` đổi.**
🔍 *Sâu hơn:* đây là bài học về **phòng thủ nhiều lớp và biết lớp nào chịu trách nhiệm gì**.
Inbox chặn *delivery giống hệt nhau*; CAS chặn *chuyển trạng thái sai*. Chúng bảo vệ hai thứ
khác nhau, và câu hỏi này cố tình tạo tình huống lớp đầu **không** áp dụng để xem bạn có biết
lớp cuối là gì không.
⚠️ *Lỗi hay gặp:* trả lời "inbox chặn" vì thấy inbox là cơ chế chống trùng. Sai — `message_id`
băm từ nội dung, nội dung đổi thì hash đổi, `ON CONFLICT` không kích hoạt. **Chốt cuối luôn là
điều kiện `AND status = 'pending'` trong câu UPDATE.**

**Câu 5 — vì sao giữ lại inbox row.**
🔍 *Sâu hơn:* đây là tối ưu **chi phí xử lý delivery lặp trong tương lai**: chặn ở bước inbox
(một lần đọc index) rẻ hơn nhiều so với chạy tiếp xuống CAS. Nó cho thấy inbox row mang ý nghĩa
*"đã tiếp nhận"*, tách khỏi *"đã đổi được trạng thái"* — hai sự kiện khác nhau.
⚠️ *Lỗi hay gặp:* nghĩ rằng "không đổi được state thì nên rollback cho sạch". Rollback sẽ **xóa
mất bằng chứng đã tiếp nhận**, khiến lần gửi lại tiếp theo phải làm lại toàn bộ.

**Câu 6 — hai webhook đua nhau, client nhận state sai.**
🔍 *Sâu hơn:* đây là bug **thật** đã được sửa trong repo ngày 2026-07-26, và nó minh họa một mẫu
lỗi rất phổ biến: **`rowsAffected = 0` bị hiểu nhầm là "thành công, không có gì thay đổi"** trong
khi ý nghĩa thật là *"thế giới đã khác với giả định của tôi"*. Mọi chỗ dùng CAS đều phải trả lời
câu hỏi "nếu không khớp thì sao?" — và câu trả lời gần như luôn là **đọc lại trạng thái thật**.
⚠️ *Lỗi hay gặp:* sửa bằng cách thêm khóa hoặc transaction mạnh hơn. Không cần — chỉ cần **reload
từ DB rồi trả state thật**, đúng như bản sửa trong repo. Bug nằm ở chỗ *báo cáo kết quả*, không
nằm ở chỗ *ghi dữ liệu* (dữ liệu vốn đã đúng nhờ CAS).

## Đáp án buổi 6

**1.** `SKIP LOCKED` bảo vệ **trong lúc câu query đang chạy** (vài trăm micro-giây): nhiều
replica cùng gọi `ClaimPendingOutbox` không bốc trùng dòng. `available_at` bảo vệ **30 giây
sau đó**, khi row lock đã được nhả bởi commit nhưng replica vẫn đang publish.
Thiếu `SKIP LOCKED` → hoặc bốc trùng (nếu bỏ luôn `FOR UPDATE`), hoặc các replica xếp hàng
chờ nhau. Thiếu lease → replica B claim lại ngay dòng A vừa nhận, **event bị gửi hai lần**.

**2.** Không bắn trùng — `FOR UPDATE` vẫn khoá đúng. Nhưng hỏng ở **thông lượng**: B và C
phải **đứng chờ** A nhả khoá thay vì nhảy sang dòng khác. Ba replica biến thành hàng dọc,
thêm máy không nhanh hơn, và một transaction chậm chặn tất cả. Đó là lý do `SKIP LOCKED` tồn tại.

**3.** Vì bảng `outbox_events` chỉ tăng, và 99,99% dòng trong đó đã `published_at IS NOT NULL`
— tức là **không bao giờ được query nữa**. Partial index chỉ chứa dòng chưa gửi (thường vài
chục), nên nhỏ và luôn nằm trong RAM.
Bỏ mệnh đề đó, sau 2 năm index chứa vài triệu entry: tốn đĩa, chậm hơn khi ghi (mỗi INSERT
phải cập nhật index lớn), và cache hit rate tệ đi.

**4.** Xem mục 6.8 kịch bản A. Dòng cứu khách là
[event_handler.go:113](../../services/notification-service/internal/handler/event_handler.go:113):

```go
case inbox.AlreadyProcessed:
    requestLog.Info("skipped duplicate notification event")
    _ = msg.Ack(false)      // Ack mà KHÔNG gửi email
    return
```

Nhận ra hàng trùng nhờ `MessageId` = `outbox_events.id`, giống nhau ở cả hai lần publish.

**5.** RabbitMQ chết → cả 50 message publish fail → mỗi cái được `MarkOutboxFailed` đẩy
`available_at = now + 1..5s`. Vòng lặp quay lại `ClaimPendingOutbox`, điều kiện
`available_at <= NOW()` **sai với toàn bộ 50 dòng** → trả về 0 message → `return nil`.
Cơ chế backoff đồng thời là điều kiện dừng.

**6.** Khi restart: `published_at` vẫn NULL → relay claim lại → **publish lần thứ hai**.
Đây là **hành vi chấp nhận được, không phải bug** — vì hệ thống đã tuyên bố hợp đồng
at-least-once, và consumer (`notification-service`) có inbox dedupe để hấp thụ. Sửa thành
"đúng một lần" ở tầng này là bất khả thi: luôn tồn tại một khe hở giữa "publish xong" và
"ghi nhận đã publish", dù bạn đặt nó ở đâu.
*Có thể cải thiện* bằng cách dùng `context.Background()` với timeout ngắn cho
`MarkOutboxPublished` thay vì `relayCtx`, để lúc shutdown vẫn kịp ghi nhận — giảm tần suất,
không loại bỏ được.

**7.** Kết quả mong đợi:

| | `outbox_events` | `inbox_messages` |
|---|---|---|
| Lần 1 | thêm 1 dòng `payment.completed`, `attempts` tăng dần rồi `published_at` có giá trị | thêm 1 dòng `momo-webhook` |
| Lần 2 | **không** thêm dòng nào | **không** thêm dòng nào (`ON CONFLICT DO NOTHING`) |

Nếu lần 2 lại thêm dòng outbox → inbox không hoạt động, khách sẽ nhận hai email.

## Đáp án buổi 7A

**1.** Với `POST /api/v1/admin/payments/:id/refunds`:
- *Authentication* — `JWTAuth` xác minh token có chữ ký hợp lệ, chưa hết hạn → biết đây là user `u-123`.
- *Authorization* — `RequireRole(admin, staff)` kiểm `claims.Role`; user thường có token hợp lệ vẫn nhận **403**.
- *Rate limiting* — dù là admin thật, gọi 200 lần/giây vẫn bị **429**.
Ba tầng độc lập: qua tầng này không có nghĩa qua tầng kia.

**2.** JWT khai báo thuật toán ký trong header của chính nó (`{"alg":"HS256"}`). Nếu thư viện
tin lời khai đó, kẻ tấn công đổi thành `{"alg":"none"}` và xoá chữ ký → token "hợp lệ" mà
không cần secret; hoặc đổi RS256 → HS256 rồi ký bằng public key (thứ ai cũng có). Ba dòng chặn:

```go
if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
	return nil, echo.NewHTTPError(http.StatusUnauthorized, "unexpected signing method")
}
```

Chúng nói: *chỉ chấp nhận HMAC, bất kể token khai gì* — không để dữ liệu của kẻ tấn công
quyết định cách xác minh chính kẻ đó.

**3.** Vì `claims == nil` nghĩa là **middleware auth chưa chạy** (ai đó quên gắn `JWTAuth`).
Cho qua trong tình huống đó biến route admin thành route công khai. Fail closed = mất tính
năng thì thấy ngay, còn mở toang thì không ai biết.
Đảo thứ tự (`RequireRole` trước `JWTAuth`): `RequireRole` chạy khi context chưa có claims →
luôn 401 → route chết hoàn toàn. Ít nhất nó **hỏng an toàn**, không hỏng nguy hiểm.

**4.** **401 Unauthorized** = "tôi không biết bạn là ai" (thiếu token / token sai / hết hạn) →
client nên **đăng nhập lại** hoặc refresh token. **403 Forbidden** = "tôi biết bạn là ai, và
bạn không đủ quyền" → đăng nhập lại vô ích, client nên hiện thông báo. Nhầm hai cái này khiến
frontend rơi vào vòng lặp refresh token vô tận.

**5.** Vì token bucket phải **đọc số xu → tính refill → trừ → ghi lại**. Ba lệnh Redis riêng
lẻ có khe hở: hai request song song cùng đọc "còn 1 xu", cùng thấy đủ, cùng được qua → limit
bị vượt. Redis chạy Lua script nguyên khối, không lệnh nào chen ngang được — đúng vai trò mà
transaction đóng ở PostgreSQL. Đây là TOCTOU lần thứ ba trong khóa (sau tồn kho ở buổi 4 và
webhook ở buổi 5).

**6.** Vì hậu quả của việc đoán sai khác nhau. Chữ ký sai một lần = **mất tiền, không hồi
phục được** → thà từ chối nhầm giao dịch thật còn hơn chấp nhận nhầm giao dịch giả. Redis chết
mà chặn hết request = **toàn bộ website sập** vì một thành phần phụ trợ; còn cho qua thì tệ
nhất là bị spam trong lúc Redis hồi phục (và vẫn còn limiter in-memory yếu hơn đỡ). Quy tắc:
bảo vệ **tính đúng đắn** → fail closed; bảo vệ **tài nguyên** → thường fail open.

**7.** Mật khẩu: sống nhiều năm, người dùng đặt yếu, kẻ tấn công có thể thử offline không giới
hạn. SHA-256 quá nhanh (GPU thử hàng tỷ/giây) nên phải dùng bcrypt — **cố tình chậm** (cost 12
≈ 250ms/lần), kèm salt tự sinh.
OTP: chỉ 6 chữ số nhưng **sống vài phút**, có `MaxAttempts` giới hạn số lần thử online, và
được trộn **pepper** nằm ngoài DB. Ba thứ đó bù cho việc SHA-256 nhanh. Nếu bỏ pepper thì
SHA-256 cho OTP là sai, vì 1 triệu khả năng brute-force trong tích tắc.

**8.** *Salt* lưu **cùng chỗ** với hash (trong DB), **mỗi bản ghi một giá trị khác nhau**,
chống **rainbow table** (bảng tra hash dựng sẵn) và chống việc hai user cùng mật khẩu ra cùng hash.
*Pepper* lưu **ngoài DB** (biến môi trường / secret manager), **dùng chung cho mọi bản ghi**,
chống kịch bản mà salt bó tay: **kẻ tấn công đã dump được toàn bộ database**. Có salt nhưng
không có pepper, hắn vẫn brute-force offline được; thiếu pepper thì hắn không thể tính hash nào cả.

**9.** *Credential stuffing:* kẻ tấn công có danh sách 100.000 cặp email/mật khẩu rò rỉ từ
site khác, thử mỗi cặp **đúng một lần** từ một máy. Khóa theo `identifier` không chặn được
(mỗi tài khoản chỉ sai 1 lần, chưa tới ngưỡng 5). Chỉ khóa theo `ip` mới chặn — và ngược lại,
khóa theo `ip` không chặn được kẻ dò một tài khoản từ 1000 IP. Cần **cả hai**.

**10.** State nằm trong `map` + `sync.Mutex` = **RAM của một tiến trình**. Ba replica có ba
map độc lập, và load balancer rải request → mỗi replica chỉ thấy ~1/3 số lần thất bại.
Thực tế cho phép ~15 lần thử thay vì 5, và restart là mất sạch bộ đếm.
Viết lại bằng Redis cần: (a) key `login-attempt:identifier:<value>` và `login-attempt:ip:<ip>`;
(b) `INCR` + `EXPIRE` nguyên tử — hoặc Lua script nếu cần đọc-quyết-ghi như token bucket;
(c) key khóa riêng với TTL = `lockDuration`; (d) quyết định fail-open hay fail-closed khi Redis
chết (ở đây nên **fail open** về limiter in-memory, giống rate limiter — chặn hết đăng nhập vì
Redis chết là tệ hơn).

## Đáp án buổi 7B

**1.** (a) Gateway là **điểm chết chung** — thêm code là thêm rủi ro cho cả 6 service.
(b) Logic **bị lệch** khi kiểm hai nơi → hệ thống có hai sự thật.
(c) **Deploy bị ràng buộc** — đổi domain phải deploy gateway, mất lợi ích microservices.
(d) **Vi phạm Dependency Rule** — gateway phải import model của service.
Nghiêm trọng nhất là **(b)**, vì (a)(c)(d) gây đau đớn nhưng nhìn thấy được, còn (b) tạo ra
bug âm thầm: gateway cho qua thứ service từ chối (hoặc ngược lại) và không ai biết cho tới
khi có dữ liệu sai.

**2.** `product-service` chết, `http.Client` có `Timeout: 30s`. Gateway nhận 1000 req/s, mỗi
request treo 30 giây → **30.000 kết nối và goroutine đang chờ** cùng lúc. Gateway cạn file
descriptor / RAM và chết. Client thấy gateway chết thì retry → nhân đôi tải. Kết quả: một
service chết kéo sập toàn hệ thống — **cascading failure**.

**3.** Theo đúng config trong repo (`MaxRequests: 3`, `Interval: 30s`, `Timeout: 20s`,
`ReadyToTrip: ConsecutiveFailures >= 5`):

```
CLOSED  ──[5 lỗi LIÊN TIẾP]──►  OPEN
OPEN    ──[sau 20 giây]─────►  HALF-OPEN
HALF-OPEN ──[3 request thành công]──► CLOSED
HALF-OPEN ──[bất kỳ 1 lỗi]────────►  OPEN
```

`Interval: 30s` reset bộ đếm khi đang CLOSED → lỗi rải rác không làm ngắt cầu dao.

**4.** Vì mỗi backend hỏng độc lập. `Name: baseURL` tạo một breaker riêng cho mỗi service.
Dùng chung một breaker: `product-service` chết 5 lần liên tiếp → breaker OPEN → **mọi request
tới user-service, order-service, cart-service cũng bị từ chối ngay lập tức** dù chúng hoàn toàn
khoẻ mạnh. Đó là biến circuit breaker — thứ sinh ra để **chặn** cascading failure — thành
nguyên nhân **gây ra** nó.

**5.** Vì gateway không phân biệt được "server chưa nhận" với "server làm rồi, response mất":

```
t=0ms    Gateway → POST /api/v1/payments (trừ 500k)
t=50ms   payment-service xử lý xong, ĐÃ TRỪ TIỀN, ghi outbox, commit
t=51ms   response 201 bị mất trên đường về (đứt mạng / timeout)
t=30s    Gateway: "timeout" → shouldRetry?
         Nếu cho retry POST → gửi lại → TRỪ TIỀN LẦN HAI
```

`GET` retry vô hại vì idempotent; `POST` retry là nhân đôi tác dụng phụ.

**6.** Cần **idempotency key** — client tự sinh một key và gửi kèm header `Idempotency-Key`,
server dùng key đó để nhận ra request lặp và trả lại kết quả cũ (buổi 4: 2 lớp check +
UNIQUE constraint; buổi 5: `ProcessPayment` nhận header này). Điểm mấu chốt: **client** biết
"đây là lần thử lại của cùng một ý định", còn gateway thì không — nên việc retry `POST` phải
do client làm, không phải gateway.

**7.** `req.Body` là `io.ReadCloser` — **stream đọc một lần**. Attempt 1 đọc hết, attempt 2
nhận body rỗng → gửi request rỗng lên backend. `GetBody()` là hàm "tua lại từ đầu" mà
`net/http` gắn sẵn khi biết nội dung body.
Dev không bao giờ gặp vì retry chỉ kích hoạt khi có **lỗi mạng/timeout** — thứ không xảy ra
trên localhost. Bug chỉ xuất hiện ở production, đúng lúc hệ thống đang có sự cố.

**8.** Vì mặc định `http.Client` **tự đi theo** redirect 302 và chỉ trả về response cuối. Với
luồng OAuth, cái 302 **chính là thứ cần tới trình duyệt** để chuyển người dùng sang trang
đăng nhập của Google. Nếu gateway tự đi theo, trình duyệt không bao giờ nhận được redirect và
luồng đăng nhập hỏng. `http.ErrUseLastResponse` bảo client: "trả nguyên 302 cho tôi".

**9.** Không mâu thuẫn, và đây là lý do:
*Chiều ủng hộ:* `ErrOpenState` trả về **tức thì** (không tốn kết nối downstream). Giữa hai
attempt có `time.Sleep(150ms, 300ms)`, và breaker có thể đã chuyển sang HALF-OPEN trong lúc đó
— retry là một cơ hội rẻ để bắt được khoảnh khắc hồi phục.
*Chiều phản đối:* với `Timeout: 20s` của breaker, tổng thời gian retry chỉ 450ms nên xác suất
breaker kịp đổi trạng thái gần như bằng 0 → 2 lần retry thừa, chỉ thêm độ trễ cho client.
*Kết luận thực dụng:* chi phí gần bằng 0 (không chạm mạng), lợi ích nhỏ nhưng khác 0 → giữ lại
là hợp lý. Nếu muốn chặt chẽ thì nên bỏ `ErrOpenState` khỏi `shouldRetry` và fail fast luôn.

## Đáp án buổi 7C

**1.** Vì `PaymentService` phụ thuộc vào **interface** (`repository.PaymentRepository`,
`OrderLookup`), không phải struct cụ thể — đúng Dependency Inversion của buổi 1. Test truyền
vào `fakePaymentRepo` (slice trong RAM) và `fakeOrderLookup`. Nếu service tự gọi `sql.Open()`
trong constructor thì không có chỗ nào để chèn fake vào.

**2.** *Mock* kiểm tra **cách làm** ("hàm Create phải được gọi đúng 1 lần với tham số X").
*Fake* là một cài đặt đơn giản có state thật, và test kiểm tra **kết quả**. Repo chọn fake vì
test bền hơn: đổi cách cài đặt bên trong `ProcessPayment` (gọi thêm một truy vấn, đổi thứ tự)
mà kết quả vẫn đúng thì test vẫn xanh. Mock sẽ đỏ dù hành vi không sai — đó là test cản trở
refactor thay vì bảo vệ nó.

**3.** Vì `r.payments` chứa **con trỏ**. Trả thẳng `payment` nghĩa là caller cầm chính con trỏ
mà "DB giả" đang giữ; caller sửa field nào là sửa luôn dữ liệu gốc, không cần gọi `Update`.
Test sẽ pass nhầm (vì state tự thay đổi) hoặc fail bí ẩn. Đây đúng là bài học aliasing của
buổi 2, và nó cũng làm fake **giống DB thật hơn** — DB thật trả về bản sao, không trả con trỏ.

**4.** Nó bảo vệ hợp đồng: *"payment completed thì BẮT BUỘC phải có một outbox message được
ghi trong cùng transaction"* — nền tảng của outbox pattern (buổi 4 và 6). Nếu ai đó vô tình
xoá hoặc đặt sai điều kiện dòng `buildPaymentOutboxMessage`, hệ thống sẽ im lặng **không gửi
email/không sync order** và không ai biết cho tới khi khách phàn nàn. Test này biến lỗi câm
thành lỗi đỏ.

**5.** Hai test kiểm hai nửa của cùng một định nghĩa. *Cùng payload* → phải trả bản cũ
(idempotent). *Khác payload* → phải báo `ErrIdempotencyKeyConflict`.
Thiếu cái thứ hai: client tái dùng nhầm một key (ví dụ hardcode `"checkout"`) cho hai đơn
khác nhau sẽ **nhận về kết quả của đơn trước** — tưởng đã trả tiền cho đơn B trong khi thực
tế chỉ có đơn A tồn tại. Lỗi này rất khó truy vì mọi thứ đều trả 200.

**6.** Điểm mù: `signatureForTest` tính HMAC theo **cùng công thức** với production. Nếu công
thức đó sai so với tài liệu của MoMo (sai thứ tự field, sai dấu phân cách, sai cách format số
tiền), **test vẫn xanh** vì hai bên cùng sai một kiểu — nhưng webhook thật sẽ luôn bị từ chối.
Test này chỉ chứng minh **tính nhất quán nội bộ**, không chứng minh **tương thích với bên
ngoài**. Cái sau cần contract test với payload mẫu do cổng cung cấp, hoặc gọi sandbox thật.

**7.**
- Bỏ `skipIfDockerUnavailable` → test **fail** trên máy không có Docker và trong CI không có
  Docker socket. Hạ tầng thiếu là hoàn cảnh, không phải lỗi code → phải skip.
- Bỏ `wait.ForLog` → test kết nối vào container chưa sẵn sàng → **flaky**: xanh trên máy nhanh,
  đỏ ngẫu nhiên trên máy chậm hoặc CI đang tải cao.
- Bỏ `container.Terminate` → container rác tích tụ, chạy 50 lần là 50 container còn sống, cạn
  RAM/port.
- Bỏ `MappedPort`, hardcode `6379` → xung đột với Redis đang chạy trên máy dev, và không chạy
  song song nhiều test được.

**8.** `time.Sleep` là **đoán mò**: 5 giây có thể thừa (chậm test vô ích) hoặc thiếu (máy chậm
→ đỏ ngẫu nhiên). `wait.ForLog("Ready to accept connections")` chờ **đúng tín hiệu có thật**:
xong sớm thì đi tiếp ngay, chưa xong thì chờ tiếp tới `WithStartupTimeout(30s)`. Vừa nhanh hơn
vừa ổn định hơn.

**9.** `-race` phát hiện **data race**: hai goroutine truy cập cùng một biến, ít nhất một là
ghi, không có đồng bộ. Ví dụ từ buổi 2: nếu `LoginAttemptProtector.RecordFailure` quên
`p.mu.Lock()`, nhiều request đăng nhập đồng thời sẽ ghi vào `p.attempts` cùng lúc → chương
trình chết với `fatal error: concurrent map writes`, nhưng chỉ khoảng 1/1000 lần. `-race`
biến thứ ngẫu nhiên đó thành lỗi tất định, báo rõ hai stack trace đang tranh nhau.

**10.** Đã viết trong repo — xem `TestHandleMomoWebhookRejectsInvalidSignature` ở
[payment_service_test.go](../../services/payment-service/internal/service/payment/payment_service_test.go).
Điểm cần assert **không chỉ** là lỗi trả về, mà còn là **state không đổi**: payment vẫn
`pending` và `repo.createdOutbox == nil`. Một test chỉ kiểm error message sẽ bỏ sót trường hợp
code từ chối request nhưng đã kịp ghi state.

**11.** Sửa fake để nó **mô phỏng đúng ba bước của repository thật** thay vì trả cứng `false`:
(a) một `map[string]struct{}` đóng vai `inbox_messages` với khóa `consumer|message_id`, trả
`true` khi trùng; (b) đọc payment đang lưu và chỉ update khi `status == pending` (compare-and-set);
(c) chỉ ghi outbox khi bước (b) khớp.
Đã làm trong repo — xem `fakePaymentRepo.ApplyWebhookResult` và ba test
`TestHandleMomoWebhookSkipsDuplicateInboxDelivery`,
`TestHandleMomoWebhookReportsStoredStateWhenCompareAndSetMisses`,
`TestHandleVNPayWebhookRejectsTamperedAmount`.

> **Bài học chung của câu 11:** fake đơn giản quá thì test bỏ sót đúng phần khó nhất. Fake nên
> mô phỏng **những ràng buộc** của hệ thống thật (unique key, compare-and-set), không chỉ
> đường đi thành công.

## Đáp án buổi 8

**1.** Cần phân biệt **ba** trạng thái chứ không phải hai: *hit* (có dữ liệu), *miss* (chưa
cache — bình thường), *lỗi hạ tầng* (Redis sập). Miss thì im lặng query DB; lỗi thì phải **log
cảnh báo + tăng metric `cache_fallback`**. Gộp thành `(data, err)` khiến hai trạng thái này
không phân biệt được (cả hai đều `data == nil`).
🔍 *Sâu hơn:* hệ quả vận hành — nếu gộp, Redis có thể chết cả tuần mà **không ai biết**, hệ
thống chỉ âm thầm chậm đi.
⚠️ *Lỗi hay gặp:* coi `data == nil` là miss. Khi Redis sập bạn cũng được `nil`.

**2.** Vì **cache miss là trạng thái vận hành bình thường** — lần đầu ai đó xem một sản phẩm thì
đương nhiên chưa có cache. `redis.Nil` là **sentinel error** (buổi 1) mà go-redis dùng để báo
"key không tồn tại", và code dịch nó thành `hit = false, err = nil`.
🔍 *Sâu hơn:* nếu coi miss là lỗi, log ngập cảnh báo giả → đội vận hành học cách phớt lờ cảnh
báo → bỏ sót lỗi thật. Cảnh báo chỉ có giá trị khi nó hiếm.
⚠️ *Lỗi hay gặp:* viết `if err != nil { return nil, err }` ngay đầu mà quên tách `redis.Nil` →
mọi cache miss thành lỗi 500 trả cho người dùng.

**3.** Vì kết quả **phụ thuộc `limit`** — "10 review đầu" ≠ "20 review đầu". Dùng chung key thì
người xin 20 có thể nhận bản cache 10. Quy tắc: **key phải là hàm của mọi đầu vào ảnh hưởng đầu
ra**.
🔍 *Biến thể gây lỗ hổng bảo mật:* cache dữ liệu **theo người dùng** mà quên đưa `userID` vào key
→ **người dùng A nhận dữ liệu riêng tư của người dùng B**. Đây là sự cố có thật ở nhiều công ty
lớn, và là dạng nguy hiểm nhất của lỗi này.
⚠️ *Lỗi hay gặp:* nhớ `page`/`limit` nhưng quên `role` — admin và khách xem cùng endpoint nhưng
kết quả khác nhau.

**4.** Vì `KEYS` **quét toàn bộ keyspace**. Redis xử lý lệnh **đơn luồng**, nên một lệnh chậm
làm *mọi* client khác đứng hình — mà Redis này còn dùng chung cho giỏ hàng, rate limiter và
dedupe notification. Index set đổi độ phức tạp từ *O(toàn bộ DB)* xuống *O(số key của sản phẩm
đó)*.
🔍 *Sâu hơn:* đây là ví dụ điển hình của bug "chỉ xuất hiện ở production" — local có 50 key nên
`KEYS` chạy tức thì; production có triệu key nên nó gây sự cố toàn hệ thống.
⚠️ *Lỗi hay gặp:* thay `KEYS` bằng `SCAN` rồi coi như xong. `SCAN` không chặn nhưng vẫn duyệt
toàn bộ keyspace; index set vẫn tốt hơn khi bạn kiểm soát được lúc ghi.

**5.** TTL là **lưới an toàn** vì invalidation có thể sót. Ba tình huống: (a) ai đó sửa dữ liệu
thẳng trong DB bằng script, không qua code nên observer không chạy; (b) lệnh `Invalidate` lỗi
mạng và chỉ được log rồi bỏ qua; (c) lập trình viên thêm **đường ghi mới** mà quên gắn observer.
🔍 *Sâu hơn:* TTL biến bug "vĩnh viễn" thành bug "kéo dài tối đa N phút" — khác biệt giữa sự cố
nghiêm trọng và phiền toái nhỏ. Tình huống (c) là phổ biến nhất trong thực tế.
⚠️ *Lỗi hay gặp:* tin tuyệt đối vào invalidation nên không đặt TTL. Chỉ cần một đường ghi bị sót
là dữ liệu ôi thiu **mãi mãi**, và cực khó phát hiện vì chỉ sai với vài sản phẩm.

**6.** Vì cache là thành phần **tăng tốc, không bắt buộc** — `summary` đã lấy đúng từ PostgreSQL
rồi, ghi cache hỏng không làm kết quả sai. Phân biệt với nuốt lỗi: code vẫn `warnCacheFailure`
**và** tăng metric `cache_fallback` với outcome `SystemError` → sự cố hiện trên dashboard, chỉ
là người dùng không bị ảnh hưởng.
🔍 *Sâu hơn:* bắt request fail vì cache hỏng là **tự biến Redis thành điểm chết đơn lẻ** — thêm
Redis để hệ thống khỏe hơn nhưng lại làm nó dễ chết hơn.
⚠️ *Lỗi hay gặp:* hai thái cực đều sai — `return err` (biến cache thành bắt buộc), hoặc
`_ = s.cache.Set(...)` (mất khả năng quan sát). Đúng là **ở giữa**.

**7.** `ProductReviewCache` **chuẩn hơn**: nó khai ở tầng **dùng** (`service`), nên service không
phải import package nào bên ngoài để mô tả nhu cầu của mình — mũi tên phụ thuộc hướng trọn vào
trong. `CartRepository` khai ở package `repository`, nên `service` phải `import repository`; mũi
tên vẫn tồn tại, chỉ trỏ vào interface thay vì struct.
🔍 *Sâu hơn:* cả hai đều **giữ được lợi ích chính** (test bằng fake, đổi implementation không sửa
service), nên `CartRepository` là thoả hiệp chấp nhận được. Nhưng khi cần một bản mẫu để học,
`ProductReviewCache` mới là bản đúng sách.
⚠️ *Lỗi hay gặp:* kết luận `CartRepository` "sai". Nó không sai — nó **kém thuần khiết hơn**.
Biết phân biệt hai điều đó là dấu hiệu của người review có nghề.

**8.** **Cache stampede:** khi key hot hết hạn, hàng loạt request đồng thời cùng miss và cùng lao
vào DB một truy vấn giống hệt nhau, vì chưa ai kịp ghi cache lại. Trớ trêu vì **cache sinh ra để
bảo vệ DB nhưng đúng khoảnh khắc hết hạn lại dồn tải cực đại vào DB** — và điều đó xảy ra đúng
lúc lưu lượng cao nhất (key càng hot càng nhiều request cùng miss).
🔍 *Sâu hơn:* nếu DB chậm lại vì quá tải, cửa sổ miss rộng ra → càng nhiều request dồn vào →
**vòng xoáy sụp đổ**. **Jitter rẻ nhất** vì chỉ cần sửa một dòng tính TTL, không cần thêm khóa,
không thêm trạng thái, không thêm điểm hỏng — mà đã phá được kịch bản tệ nhất là *hàng loạt key
hết hạn cùng một giây* (rất hay xảy ra sau khi deploy hoặc flush cache).
⚠️ *Lỗi hay gặp:* đặt TTL cố định giống hệt nhau cho hàng loạt key tạo cùng lúc.

**9.** `TxPipeline` gộp nhiều lệnh vào **một chuyến mạng** và đảm bảo chúng chạy **liền mạch
không bị lệnh khác chen giữa**. Nhưng Redis **không có rollback**: nếu một lệnh lỗi, các lệnh
khác vẫn có hiệu lực. Transaction PostgreSQL (buổi 4) cho **atomicity thật** — tất cả hoặc
không gì, nhờ `Rollback()`.
🔍 *Sâu hơn:* vì vậy không được dùng `TxPipeline` để giữ invariant kiểu "hai key phải luôn khớp
nhau". Muốn nguyên tử thật trong Redis phải dùng **script Lua** (chạy trọn vẹn, đơn luồng) —
đúng cách `NewRedisBackedRateLimiter` làm token bucket ở buổi 7A.
⚠️ *Lỗi hay gặp:* thấy chữ "Tx" rồi suy ra có rollback.

**10.** Thiết kế: khi miss, thử `SETNX cache-lock:<key> <token> EX 5`. Ai đặt được khóa thì đi
query DB rồi ghi cache và xóa khóa. Ai **không** đặt được thì **không nên đợi vô hạn**.
🔍 *Trả lời cho câu hỏi "đợi hay trả dữ liệu cũ":* tốt nhất là **trả dữ liệu cũ** (kỹ thuật
*stale-while-revalidate*) — giữ lại bản cache cũ với TTL dài hơn TTL logic, request thua khóa
trả ngay bản cũ thay vì xếp hàng. Nếu không có bản cũ (cache lạnh hoàn toàn), mới đợi ngắn
(vài chục ms) rồi thử đọc lại cache một lần. Với dữ liệu review, cũ vài giây hoàn toàn chấp
nhận được, còn để người dùng đợi thì không.
⚠️ *Lỗi hay gặp:* (a) quên `EX` cho khóa → tiến trình chết giữa chừng là khóa kẹt vĩnh viễn,
mọi request treo; (b) xóa khóa bằng `DEL` mà không kiểm token → xóa nhầm khóa của người khác đã
giành được sau khi khóa của mình hết hạn (phải xóa bằng script Lua so token, đúng như mẫu
compare-and-delete).
