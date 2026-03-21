# Line-by-Line Annotated: `pkg/middleware/auth.go`

Source gốc: `pkg/middleware/auth.go`

Tài liệu này đi sâu hơn bản annotate thường. Mục tiêu là giúp bạn đọc file như một backend engineer đang phân tích từng quyết định bảo mật trong code.

## Cách đọc file này

1. Mở song song file source thật.
2. Đọc từng cụm dòng nhỏ.
3. Sau mỗi cụm, tự trả lời:
   - cụm này đang bảo vệ điều gì?
   - nếu bỏ cụm này đi, lỗ hổng nào sẽ xuất hiện?
   - cụm này là authentication hay authorization?

## Toàn cảnh trước khi đi vào từng dòng

File này có 3 trách nhiệm:

1. Định nghĩa dữ liệu auth dùng chung bằng `JWTClaims`.
2. Tạo middleware `JWTAuth` để xác thực token.
3. Tạo middleware `RequireRole` để phân quyền theo role.

Đây là một ví dụ rất đúng về việc tách:

- xác thực danh tính,
- và kiểm tra quyền truy cập.

## Dòng 1-6: package comment và package declaration

```go
// Package middleware provides reusable Echo middleware for all microservices.
...
package middleware
```

Ở đây comment không chỉ mô tả "đây là package middleware". Nó còn nói lý do tồn tại:

- nhiều service đều cần auth,
- logic JWT phải nhất quán,
- nếu tách rời mỗi service tự làm sẽ rất dễ lệch nhau.

Đây là một bài học quan trọng khi đọc source:

- comment tốt không chỉ nói code làm gì,
- mà nói lý do kiến trúc phía sau.

`package middleware` cho biết file này không gắn chặt vào một service riêng nào. Nó là shared package.

## Dòng 8-14: import

```go
import (
    "net/http"
    "strings"

    "github.com/golang-jwt/jwt/v5"
    "github.com/labstack/echo/v4"
)
```

Chỉ nhìn import là bạn đã đoán được luồng xử lý:

- `net/http` để trả status code,
- `strings` để tách header `Authorization`,
- `jwt/v5` để parse và verify token,
- `echo` để viết middleware web.

Một thói quen rất tốt khi học source Go là:

- luôn nhìn import trước,
- vì import cho bạn biết file này đang “nói chuyện” với lớp công nghệ nào.

## Dòng 16-19: role constants

```go
const (
    RoleAdmin = "admin"
    RoleUser  = "user"
)
```

Đây là constant domain đơn giản nhưng có giá trị dài hạn.

Vì sao không viết thẳng string `"admin"` ở nhiều nơi?

- dễ typo,
- khó grep,
- khó refactor,
- mỗi chỗ có thể viết khác nhau.

Trong Go, việc gom literal quan trọng thành constant là thói quen rất tốt, nhất là ở auth/permission.

## Dòng 21-29: struct `JWTClaims`

```go
type JWTClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}
```

### Ý nghĩa kiến trúc

Đây là data contract giữa:

- nơi sinh token,
- middleware xác thực token,
- và handler cần biết user hiện tại là ai.

### Giải thích từng field

`UserID`:

- là ID nội bộ của user trong hệ thống,
- giúp handler/service biết request này thuộc ai.

`Email`:

- hữu ích cho một số use case đọc nhanh từ claims,
- tránh phải query lại user-service chỉ để biết email.

`Role`:

- dùng cho authorization theo vai trò,
- ví dụ admin route hoặc user route.

`jwt.RegisteredClaims`:

- là phần claims chuẩn của JWT như `exp`, `iat`,
- Go dùng embedding để “nhúng” struct này vào struct của mình.

### Bài học Go rất đáng nhớ

Embedding trong Go không phải inheritance kiểu OOP cổ điển. Nó là cách tái sử dụng field/method theo kiểu composition.

## Dòng 31-42: hàm `JWTAuth(secret string)`

```go
func JWTAuth(secret string) echo.MiddlewareFunc
```

Chữ ký hàm này rất đáng học.

Nó cho thấy:

- middleware cần runtime config là `secret`,
- nhưng Echo cần một `MiddlewareFunc`,
- nên ta viết một factory function: nhận config trước, trả middleware sau.

Đây là closure pattern trong Go.

### Tư duy nên học

Backend Go rất hay dùng kiểu:

- hàm ngoài nhận dependency,
- hàm trong thực hiện logic request.

Điều này vừa đơn giản vừa testable.

## Dòng 43-45: bắt đầu chuỗi wrapper middleware

```go
return func(next echo.HandlerFunc) echo.HandlerFunc {
    return func(c echo.Context) error {
```

Đây là hình dạng đặc trưng của Echo middleware.

Bạn có thể đọc nó theo cách rất đơn giản:

- nhận handler tiếp theo,
- trả về một handler mới,
- handler mới làm việc trước,
- rồi mới quyết định có cho request đi tiếp hay không.

Đây là khái niệm “wrapping the next handler”.

## Dòng 45-51: đọc `Authorization` header

```go
authHeader := c.Request().Header.Get("Authorization")
if authHeader == "" {
    return c.JSON(http.StatusUnauthorized, map[string]string{
        "error": "missing authorization header",
    })
}
```

### Dòng `Get("Authorization")`

Middleware lấy đúng header chuẩn mà bearer token thường nằm trong đó.

### Vì sao check rỗng ngay lập tức?

Đây là kiểu fail fast:

- request thiếu dữ liệu xác thực,
- không có lý do gì đi tiếp xuống các bước tốn công hơn,
- cũng không nên để handler business nhìn thấy request này.

### Vì sao trả `401`?

Vì đây là tình huống chưa xác thực được danh tính.

Đây chưa phải bài toán quyền truy cập. Đây là bài toán “anh chưa chứng minh anh là ai”.

## Dòng 53-59: check format `Bearer <token>`

```go
parts := strings.SplitN(authHeader, " ", 2)
if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
    return c.JSON(http.StatusUnauthorized, map[string]string{
        "error": "invalid authorization header format",
    })
}
```

### Vì sao dùng `SplitN(..., 2)`?

Vì header bearer thực chất chỉ có hai phần:

1. scheme
2. token

Ta chỉ cần tối đa 2 phần là đủ. Đây là cách viết gọn và đúng mục tiêu.

### Vì sao dùng `strings.ToLower(parts[0])`?

Để chấp nhận các biến thể hoa/thường như `Bearer`, `bearer`, `BEARER`.

Đây là chi tiết nhỏ nhưng cho thấy code cẩn thận với input thực tế.

### Nếu bỏ bước này thì sao?

Bạn có thể truyền một header rác vào parser token, làm flow khó hiểu hơn và log/debug tệ hơn.

## Dòng 61: lấy `tokenString`

```go
tokenString := parts[1]
```

Một dòng rất nhỏ, nhưng đây là chỗ chuyển từ transport format sang dữ liệu cốt lõi mà middleware sẽ verify.

Bạn nên để ý khi học source:

- nhiều dòng ngắn là “điểm chuyển tầng” rất quan trọng,
- từ HTTP header sang JWT raw string là một ví dụ.

## Dòng 63-71: parse và verify token

```go
claims := &JWTClaims{}
token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
    if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
        return nil, echo.NewHTTPError(http.StatusUnauthorized, "unexpected signing method")
    }
    return []byte(secret), nil
})
```

Đây là phần quan trọng nhất toàn file.

### Dòng `claims := &JWTClaims{}`

Thư viện cần một object để unmarshal claims vào.

Ở đây dùng pointer vì:

- parser sẽ điền dữ liệu vào object đó,
- sau này handler cũng sẽ dùng chính object này.

### `jwt.ParseWithClaims(...)`

Hàm này làm nhiều việc cùng lúc:

- parse token string,
- đọc claims,
- verify chữ ký,
- kiểm tra token hợp lệ theo logic của thư viện.

### Callback `func(token *jwt.Token) ...`

Callback này trả về key dùng để verify chữ ký.

Nhưng trước khi trả key, code làm một việc rất quan trọng:

```go
if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok
```

### Vì sao bước này cực quan trọng?

Đây là lớp bảo vệ chống algorithm confusion.

Nếu bạn chỉ parse token và trả secret bừa bãi mà không kiểm tra signing method, có thể mở ra rủi ro chấp nhận token với thuật toán không mong muốn.

### Vì sao trả `[]byte(secret)`?

Vì HMAC verification cần secret dạng bytes.

### Bài học lớn

JWT security không phải chỉ là:

- “có secret là xong”.

Mà còn là:

- verify đúng thuật toán,
- verify đúng claims,
- reject đúng các token không hợp lệ.

## Dòng 73-77: reject token invalid

```go
if err != nil || !token.Valid {
    return c.JSON(http.StatusUnauthorized, map[string]string{
        "error": "invalid or expired token",
    })
}
```

### `err != nil`

Cho biết có lỗi parse hoặc verify nào đó.

### `!token.Valid`

Là lớp check tổng quát của thư viện sau khi parse xong.

### Vì sao message gộp chung `"invalid or expired token"`?

Đây là một cách nói đủ rõ với client nhưng không phơi bày quá nhiều chi tiết nội bộ.

Điều này cũng giúp response đơn giản và nhất quán hơn.

## Dòng 79-83: attach claims vào context

```go
c.Set("user", claims)
return next(c)
```

Đây là đoạn “handoff” cực kỳ quan trọng.

Middleware xác thực xong rồi thì:

- không cần tự xử lý business,
- mà gắn dữ liệu user vào request context,
- rồi chuyển quyền điều khiển cho handler kế tiếp.

### Vì sao key là `"user"`?

Đây là convention của project.

Handler về sau chỉ cần:

```go
claims := c.Get("user").(*middleware.JWTClaims)
```

Hoặc dùng helper `GetUserClaims`.

### Bài học nên nhớ

Middleware tốt thường:

- chặn request không hợp lệ,
- enrich context cho request hợp lệ.

## Dòng 88-95: helper `GetUserClaims`

```go
func GetUserClaims(c echo.Context) *JWTClaims {
    if claims, ok := c.Get("user").(*JWTClaims); ok {
        return claims
    }
    return nil
}
```

Đây là helper rất Go-like:

- nhỏ,
- rõ,
- tránh lặp code,
- trả `nil` an toàn nếu không có claims.

### Vì sao không panic nếu không có claims?

Vì helper nên phòng thủ một chút. Một số route có thể không đi qua auth middleware, hoặc thứ tự middleware có thể sai.

Trả `nil` giúp caller tự quyết định cách xử lý tiếp.

## Dòng 97-102: build `allowed` map trong `RequireRole`

```go
allowed := make(map[string]struct{}, len(roles))
for _, role := range roles {
    allowed[strings.ToLower(role)] = struct{}{}
}
```

### Vì sao dùng `map[string]struct{}`

Đây là idiom rất phổ biến trong Go để biểu diễn set.

`struct{}` gần như không tốn bộ nhớ cho value.

### Vì sao lowercase role?

Để so sánh role không bị lỗi vì khác hoa/thường.

Đây là chuẩn hóa input từ đầu để logic phía sau đơn giản hơn.

## Dòng 104-111: lấy claims trong `RequireRole`

```go
claims := GetUserClaims(c)
if claims == nil {
    return c.JSON(http.StatusUnauthorized, map[string]string{
        "error": "missing user claims",
    })
}
```

Ở đây middleware phân quyền giả định rằng auth middleware phải chạy trước.

Nếu claims không có:

- hoặc route không qua `JWTAuth`,
- hoặc thứ tự middleware sai,
- hoặc context bị set không đúng.

Trả `401` ở đây hợp lý vì request chưa ở trạng thái “đã xác thực đầy đủ”.

## Dòng 113-117: check role

```go
if _, ok := allowed[strings.ToLower(claims.Role)]; !ok {
    return c.JSON(http.StatusForbidden, map[string]string{
        "error": "insufficient permissions",
    })
}
```

Đây là bước authorization thật sự.

### Vì sao trả `403`?

Vì:

- server biết user là ai,
- nhưng user không có quyền làm việc này.

### Tại sao đây là role-based authorization, chưa phải authorization hoàn chỉnh?

Vì nhiều use case cần record-level authorization nữa, ví dụ:

- user chỉ xem được order của mình,
- user chỉ xem được payment của mình.

`RequireRole` chỉ giải quyết lớp quyền theo vai trò, không giải quyết ownership theo bản ghi.

## Dòng 119: cho request đi tiếp

```go
return next(c)
```

Một dòng rất ngắn nhưng mang ý nghĩa lớn:

- mọi điều kiện đã qua,
- request được coi là hợp lệ ở lớp phân quyền hiện tại,
- flow được phép đi xuống handler business.

## Những bài học lớn bạn nên rút ra từ file này

1. Auth middleware tốt phải vừa đúng về logic vừa cẩn thận về bảo mật.
2. `401` và `403` là hai ý nghĩa khác nhau.
3. JWT auth không dừng ở việc “parse được token”.
4. Shared middleware giúp mọi service dùng cùng một chuẩn auth.
5. Role-based auth chỉ là một phần; nhiều domain còn cần ownership check ở service/repository.

## Tự kiểm tra sau khi đọc

1. Nếu bỏ check `token.Method`, nguy cơ gì có thể xảy ra?
2. Vì sao `GetUserClaims` trả `nil` thay vì panic?
3. `RequireRole` giải quyết bài toán gì và chưa giải quyết bài toán gì?
4. Vì sao attach claims vào context tốt hơn việc handler tự parse token lại?
5. Nếu bạn thêm `aud`, `iss` vào JWT, bạn sẽ muốn verify ở đâu?
