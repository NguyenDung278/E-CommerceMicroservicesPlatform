# Annotated: `pkg/middleware/auth.go`

Source gốc: `pkg/middleware/auth.go`

## 1. File này dạy bạn điều gì?

Đây là một trong những file quan trọng nhất của toàn project nếu bạn muốn hiểu authentication và authorization trong backend Go.

File này dạy bạn:

- middleware là gì,
- JWT được parse và verify như thế nào,
- claim được đưa vào request context ra sao,
- role-based authorization được làm ở đâu,
- vì sao security check phải nhất quán giữa các service.

## 2. Vai trò của file trong hệ thống

Nhiều service cần xác thực user. Thay vì mỗi service tự viết logic parse JWT riêng, project gom logic này vào shared middleware.

Lợi ích:

- giảm lặp code,
- tránh mỗi service xử lý token một kiểu,
- dễ sửa tập trung khi có vấn đề bảo mật.

## 3. Annotate theo block dòng

### Dòng 1-14: package và import

File dùng:

- `net/http` để trả status code đúng,
- `strings` để xử lý header `Authorization`,
- `github.com/golang-jwt/jwt/v5` để parse JWT,
- `github.com/labstack/echo/v4` để viết middleware cho Echo.

Điều nên học:

- Middleware thường nằm ở package dùng chung.
- Chọn thư viện JWT phổ biến, ổn định sẽ giúp giảm rủi ro tự viết sai logic crypto.

### Dòng 16-19: role constants

```go
const (
    RoleAdmin = "admin"
    RoleUser  = "user"
)
```

Dùng constant thay vì hardcode string ở nhiều nơi.

Tại sao tốt?

- giảm typo,
- dễ grep,
- dễ thay đổi quy ước role về sau.

### Dòng 21-29: `JWTClaims`

```go
type JWTClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}
```

Đây là custom claims của project.

Điểm quan trọng:

- `UserID`, `Email`, `Role` là claims riêng của domain.
- `jwt.RegisteredClaims` là bộ claims chuẩn như `exp`, `iat`.

Tại sao nhúng `RegisteredClaims`?

- không cần tự định nghĩa lại `ExpiresAt`, `IssuedAt`,
- dùng đúng chuẩn của thư viện JWT,
- code gọn hơn.

Điều nên học:

- embedding là đặc điểm Go rất đáng chú ý.
- custom claims nên chứa đúng dữ liệu downstream thật sự cần.

### Dòng 31-42: chữ ký của `JWTAuth`

```go
func JWTAuth(secret string) echo.MiddlewareFunc
```

Đây là hàm factory tạo middleware.

Ý tưởng:

- middleware cần biết `secret`,
- nhưng `secret` chỉ có khi app boot xong config,
- nên ta tạo middleware từ config runtime.

Đây là pattern rất hay trong Go: function trả về function.

### Dòng 43-51: lấy `Authorization` header

```go
authHeader := c.Request().Header.Get("Authorization")
if authHeader == "" {
    return c.JSON(http.StatusUnauthorized, ...)
}
```

Đoạn này là "cửa vào" của auth middleware.

Nếu không có header, request bị chặn ngay.

Điều nên học:

- fail early làm flow dễ hiểu hơn,
- middleware auth không để request đi sâu hơn nếu đã thiếu dữ liệu xác thực.

### Dòng 53-59: validate format `Bearer <token>`

```go
parts := strings.SplitN(authHeader, " ", 2)
if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
    ...
}
```

Đây là bước kiểm tra giao thức, không phải kiểm tra chữ ký token.

Tại sao cần?

- tránh parse những header rác,
- đảm bảo client đang gửi đúng chuẩn mong đợi.

`SplitN(..., 2)` là chi tiết đáng học:

- chỉ tách tối đa 2 phần,
- đơn giản hơn và tránh tách quá nhiều không cần thiết.

### Dòng 61-71: parse và verify JWT

```go
claims := &JWTClaims{}
token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
    if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
        return nil, echo.NewHTTPError(http.StatusUnauthorized, "unexpected signing method")
    }
    return []byte(secret), nil
})
```

Đây là phần quan trọng nhất của file.

Ý nghĩa của từng bước:

- tạo `claims` để thư viện unmarshal dữ liệu token vào đó,
- gọi `ParseWithClaims` để parse + verify,
- truyền vào callback để chỉ định key dùng verify chữ ký.

Điểm bảo mật rất quan trọng nằm ở đoạn:

```go
if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok
```

Nó chặn algorithm confusion attack.

Nếu không check `token.Method`, attacker có thể lợi dụng việc server parse token bằng thuật toán khác với điều bạn mong đợi.

Điều nên học:

- Security trong JWT không chỉ là "parse token".
- Bạn phải biết token được ký bằng gì và verify đúng kiểu gì.

### Dòng 73-77: reject token invalid hoặc expired

```go
if err != nil || !token.Valid {
    return c.JSON(http.StatusUnauthorized, ...)
}
```

Hai điều đang được kiểm tra:

- parse có lỗi không,
- token có hợp lệ không.

Thư viện đã dùng `RegisteredClaims` để check expiry.

Điều nên học:

- `exp` không phải do bạn tự if thủ công ở đây,
- thư viện làm phần đó khi parse claims đúng cách.

### Dòng 79-83: gắn claims vào context

```go
c.Set("user", claims)
return next(c)
```

Đây là điểm nối giữa authentication và business layer.

Ý nghĩa:

- middleware đã xác thực xong,
- handler phía sau chỉ việc lấy `claims` ra dùng,
- không cần parse lại token.

Điều nên học:

- Middleware thường enrich context rồi chuyển tiếp flow.
- Đây là kiểu rất phổ biến trong web backend.

### Dòng 88-95: helper `GetUserClaims`

Đây là helper nhỏ nhưng rất đáng học.

Thay vì để handler nào cũng tự viết:

```go
claims, ok := c.Get("user").(*JWTClaims)
```

project gom nó thành helper.

Lợi ích:

- gọn hơn,
- dễ đọc hơn,
- giảm lặp code.

### Dòng 97-122: `RequireRole`

Đây là authorization layer theo role.

Nó không xác thực lại token. Nó dựa vào việc `JWTAuth` đã chạy trước đó.

Flow:

1. Nhận danh sách role cho phép.
2. Tạo `allowed map` để lookup nhanh.
3. Lấy claims từ context.
4. Nếu không có claims thì trả `401`.
5. Nếu role không nằm trong `allowed` thì trả `403`.
6. Nếu hợp lệ thì cho request đi tiếp.

Điểm rất quan trọng:

- `401 Unauthorized` ở đây hiểu là chưa xác thực hợp lệ.
- `403 Forbidden` là đã biết bạn là ai nhưng bạn không có quyền.

Đây là phân biệt rất quan trọng trong backend security.

## 4. Tư duy backend rút ra từ file này

- Authentication và authorization là 2 việc khác nhau.
- Shared middleware làm hệ thống nhất quán hơn.
- JWT claims nên chứa đủ dữ liệu để downstream quyết định nhanh, nhưng không nên nhét quá nhiều.
- Security tốt đến từ nhiều lớp check nhỏ đúng chỗ.

## 5. Khái niệm bạn nên nhớ sau khi đọc file này

- Middleware
- JWT claims
- Signature verification
- Expiration
- Context enrichment
- Role-based authorization
- `401` vs `403`

## 6. Câu hỏi tự kiểm tra

1. Vì sao phải check `token.Method`?
2. Vì sao `JWTAuth` và `RequireRole` là hai middleware khác nhau?
3. Vì sao claims được gắn vào context thay vì handler tự parse token lại?
4. Khi nào nên trả `401`, khi nào nên trả `403`?
5. Nếu mỗi service tự viết logic parse JWT riêng, rủi ro là gì?
