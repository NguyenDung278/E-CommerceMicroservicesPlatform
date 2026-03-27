# 11. Senior Source Code Review Guide

Tài liệu này là bản **review tổng hợp toàn repository** theo góc nhìn của một Senior Software Engineer kiêm Technical Mentor. Mục tiêu không phải chỉ để mô tả code đang có, mà để giúp bạn:

- hiểu dự án ở cả mức **kiến trúc** lẫn **từng file quan trọng**
- biết mỗi service đang chịu trách nhiệm gì về mặt nghiệp vụ
- biết dữ liệu đi qua các layer như thế nào
- nhận ra các kỹ thuật tốt đang được áp dụng
- phát hiện các điểm rủi ro, nợ kỹ thuật, bottleneck hoặc vùng dễ lỗi
- dùng repo này như một **bộ tài liệu học lâu dài** để luyện kỹ năng đọc, review và viết backend Go thực chiến

> Cách dùng tốt nhất: đọc tài liệu này song song với source code thật trong IDE. Khi gặp một function hoặc module được nhắc tới ở đây, hãy mở file thật và trace input -> output -> side effects.

---

## 1. Tóm tắt điều quan trọng nhất về dự án

Đây là một nền tảng e-commerce theo hướng **microservices thực dụng**. Từ góc nhìn kỹ thuật, repo này có vài quyết định rất đáng học:

1. **Phân tầng rõ**: `handler -> service -> repository`.
2. **PostgreSQL vẫn là trung tâm** cho user, product, order, payment.
3. **Redis/RabbitMQ/Elasticsearch/MinIO là thành phần bổ trợ**, không phải source of truth chính.
4. **Gateway mỏng**: proxy request thay vì nhét business logic vào gateway.
5. **Observability có chủ đích**: log có cấu trúc, metrics, tracing, health endpoint.
6. **Một số service degrade gracefully tốt**: ví dụ `product-service` vẫn chạy dù search hoặc object storage lỗi.

Nếu bạn chỉ nhớ một điều khi đọc repo này, hãy nhớ:

> Hệ thống này không cố "show off" quá nhiều pattern phức tạp. Nó ưu tiên những cách làm đủ mạnh cho production, đủ rõ để học, và đủ đơn giản để maintain.

---

## 2. Bản đồ tư duy tổng thể

### 2.1. Vai trò của từng thành phần

| Thành phần | Vai trò nghiệp vụ | Storage / Dependency chính | Giao tiếp chính |
| --- | --- | --- | --- |
| `api-gateway/` | HTTP entrypoint cho frontend | downstream service URLs | HTTP reverse proxy |
| `services/user-service/` | auth, profile, address, password, OAuth | PostgreSQL | HTTP + gRPC |
| `services/product-service/` | catalog, media, review, search, internal product lookup | PostgreSQL, MinIO, Elasticsearch | HTTP + gRPC |
| `services/cart-service/` | giỏ hàng tạm thời | Redis | HTTP + gRPC client |
| `services/order-service/` | quote, order lifecycle, coupon, reporting | PostgreSQL, RabbitMQ | HTTP + gRPC client + event consumer |
| `services/payment-service/` | payment lifecycle, refund, webhook | PostgreSQL, RabbitMQ | HTTP + HTTP client + event publish |
| `services/notification-service/` | gửi email theo event | RabbitMQ, SMTP | event consumer |
| `frontend/` | UI chính cho local/dev | browser state | HTTP qua gateway |
| `pkg/` | shared config, DB, middleware, validation, observability | shared libraries | được import bởi hầu hết service |

### 2.2. Luồng dữ liệu tiêu biểu

#### Flow đăng nhập

`frontend -> api-gateway -> user-service -> PostgreSQL`

- handler parse request
- service normalize email/phone, hash/compare password, phát token JWT
- repository đọc user từ PostgreSQL

#### Flow thêm vào giỏ

`frontend -> api-gateway -> cart-service -> product-service(gRPC) -> Redis`

- cart không tin giá từ client
- cart hỏi product-service để lấy giá và stock thật
- cart lưu state ngắn hạn vào Redis

#### Flow checkout và thanh toán

`frontend -> api-gateway -> order-service -> product-service(gRPC) -> PostgreSQL -> RabbitMQ`

`frontend -> api-gateway -> payment-service -> order-service(HTTP) -> PostgreSQL -> RabbitMQ`

`notification-service` đứng ngoài request path chính, chỉ consume event để gửi email.

### 2.3. Tư duy source of truth

Đây là điểm cực kỳ quan trọng với người học backend:

- **User/Profile**: PostgreSQL qua `user-service`
- **Product/Catalog**: PostgreSQL qua `product-service`
- **Cart**: Redis qua `cart-service`
- **Order**: PostgreSQL qua `order-service`
- **Payment**: PostgreSQL qua `payment-service`
- **Search**: Elasticsearch chỉ là chỉ mục phụ trợ
- **Media**: file ở MinIO, metadata vẫn nên nhìn từ product domain

Nếu đọc code mà không phân biệt source of truth, bạn sẽ rất dễ đề xuất sai: ví dụ dùng Redis như nguồn dữ liệu thật, hoặc coi event broker là nơi đảm bảo tính nhất quán business.

---

## 3. Pattern khởi động chung của các service

Hầu hết service Go trong repo đều theo một shape startup giống nhau:

1. load config
2. init logger
3. setup tracing
4. kết nối DB/Redis/RabbitMQ tùy service
5. chạy migration nếu có PostgreSQL
6. wire dependency `repo -> service -> handler`
7. gắn middleware dùng chung
8. mở `/health`, `/metrics`
9. start HTTP server, gRPC server hoặc worker
10. graceful shutdown

### Vì sao pattern này tốt?

- giúp contributor đọc service nào cũng thấy quen tay
- hạn chế copy-paste hỗn loạn
- biến phần "vận hành" thành chuẩn chung thay vì mỗi service tự phát minh
- khiến service fail fast khi dependency cốt lõi chưa sẵn sàng

### Trade-off

- lặp lại một số đoạn bootstrap giữa các service
- chưa có abstraction bootstrap chung

Trade-off này hiện tại **chấp nhận được** vì nó đổi lấy sự rõ ràng. Với repo học tập và microservices cỡ vừa, rõ ràng thường đáng giá hơn abstraction sớm.

---

## 4. Cấu trúc thư mục và vai trò từng lớp

### 4.1. Layer backend chuẩn

#### `internal/handler/`

Vai trò:

- nhận HTTP/gRPC/message input
- bind + validate request
- gọi service
- map lỗi business sang status code / response envelope

Không nên làm ở handler:

- viết SQL
- xử lý transaction
- tính rule nghiệp vụ phức tạp
- phụ thuộc quá sâu vào chi tiết lưu trữ

#### `internal/service/`

Vai trò:

- business logic
- orchestration giữa repository/client/broker
- chuẩn hóa dữ liệu trước khi persist
- quyết định business error

Đây là layer nên đọc kỹ nhất nếu bạn muốn hiểu **vì sao hệ thống hành xử như vậy**.

#### `internal/repository/`

Vai trò:

- SQL hoặc Redis persistence
- scan row
- transaction / câu lệnh update / pagination
- map storage detail về model domain/persistence

Đây là layer bạn cần đọc để hiểu:

- query đang tốn bao nhiêu chi phí
- index nào quan trọng
- query nào có nguy cơ bottleneck

#### `internal/dto/`

Boundary object cho request/response. DTO giúp handler không nói chuyện trực tiếp với model persistence trong mọi trường hợp.

#### `internal/model/`

Entity dùng cho business hoặc persistence. Một số model vừa đóng vai trò domain object vừa là storage object.

---

## 5. `pkg/`: phần lõi dùng chung đáng học nhất

### 5.1. `pkg/config/`

Đây là package giúp mọi service load config theo cùng một contract.

#### Điều đáng học

- default cho local/dev rõ ràng
- gom tất cả runtime dependency vào một struct thống nhất
- env/file/default có thứ tự ưu tiên dễ đoán
- rất hợp với Docker Compose: mount file YAML + override secret qua env

#### Tư duy thiết kế

Thay vì để mỗi service tự đọc env riêng lẻ, repo này coi config là một **boundary chính thức**. Điều này tốt vì:

- startup code dễ review
- dễ audit biến môi trường production-critical
- giảm lỗi do tên env không nhất quán

### 5.2. `pkg/database/`

Repo dùng `database/sql` thay vì ORM nặng.

#### Vì sao đây là quyết định đáng học?

- query explicit
- dễ dùng `EXPLAIN ANALYZE`
- ít magic hơn ORM
- hợp với hệ thống cần kiểm soát truy vấn thật

#### Điểm mạnh

- set connection pool rõ ràng
- ping DB ở startup
- mỗi service tự mang migration embedded của riêng nó

#### Trade-off

- nhiều code scan/manual hơn ORM
- mapping JSON/array tốn công hơn

Nhưng trong ngữ cảnh repo này, trade-off đó hợp lý.

### 5.3. `pkg/middleware/`

Package này chứa phần "luật chơi HTTP" dùng chung.

#### Kỹ thuật đáng học

- JWT auth shared giữa các service
- tách `JWTAuth` và `RequireRole`
- tránh algorithm confusion bằng cách kiểm tra signing method
- dùng claims để không phải round-trip lại user-service cho mỗi request

#### Điểm cần nhớ

Auth != Authz.

- `JWTAuth`: xác thực token có hợp lệ không
- `RequireRole`: kiểm tra user có quyền không

Tách hai lớp này là dấu hiệu của code trưởng thành.

### 5.4. `pkg/response/`

Envelope response thống nhất là một lựa chọn rất tốt cho một hệ thống nhiều service.

Lợi ích:

- frontend xử lý dễ hơn
- lỗi/response nhất quán hơn
- tài liệu API dễ viết hơn

### 5.5. `pkg/validation/`

Package này nối `go-playground/validator` với Echo.

Điểm hay:

- ưu tiên tên field theo tag JSON
- trả message validation dễ đọc cho client
- giảm duplication ở handler

### 5.6. `pkg/observability/`

Tracing được setup thống nhất qua OpenTelemetry.

Điểm đáng học:

- HTTP middleware tạo span theo route thực
- propagate trace context qua HTTP transport
- tracing có thể bật/tắt qua config

Đây là cách làm rất thực dụng: observability có sẵn nhưng không ép buộc production/local đều phải bật.

---

## 6. Review chi tiết từng service

## 6.1. `api-gateway/`

### Trách nhiệm

- làm HTTP entrypoint duy nhất cho frontend
- proxy request đến service đích
- gắn CORS, secure headers, tracing, metrics, rate limit
- giữ contract route thống nhất `/api/v1/...`

### File quan trọng nên đọc trước

- `api-gateway/cmd/main.go`
- `api-gateway/internal/proxy/service_proxy.go`

### Function đáng học: `ServiceProxy.Do`

#### Input

- `context.Context`
- `*http.Request` từ client gốc

#### Output

- `*http.Response` từ backend service
- `error` nếu proxy fail

#### Logic chính

1. ghép `baseURL + path + query`
2. clone request sang backend request mới
3. copy header/body
4. thêm `X-Forwarded-*`
5. gọi `executeWithResilience`

#### Side effects

- forward request thật xuống downstream service
- log lỗi nếu proxy fail

### Kỹ thuật đáng học: retry + circuit breaker

`ServiceProxy` không chỉ forward request thô. Nó thêm hai lớp resilience:

- **retry có giới hạn** cho request idempotent
- **circuit breaker** để không bắt user chờ timeout khi downstream chết cứng

```go
resp, err := p.circuitBreaker.Execute(func() (*http.Response, error) {
    return p.client.Do(clonedReq)
})
```

Ý nghĩa:

- nếu backend đang chết liên tục, gateway sẽ "ngắt mạch" sớm
- nếu chỉ lỗi transient với `GET`, gateway có thể thử lại vài lần

### Điểm tốt

- gateway giữ mỏng, không lấn business logic
- route giữ nguyên contract backend
- redirect OAuth được preserve thay vì follow nhầm ở gateway

### Điểm cần lưu ý

1. Gateway đang copy khá nhiều header nguyên bản. Cần kiểm soát kỹ nếu sau này có header nội bộ nhạy cảm.
2. Retry chỉ nên áp dụng cho idempotent request, và repo đã làm đúng việc này.

### Bài học nên rút ra

Gateway tốt không phải gateway biết nhiều business rule. Gateway tốt là gateway **ổn định, dễ dự đoán, dễ quan sát**.

---

## 6.2. `user-service/`

### Trách nhiệm

- register/login/refresh token
- profile
- đổi mật khẩu
- verify email / forgot password / reset password
- OAuth login
- address management
- gRPC surface cho internal usage

### File nên đọc

- `services/user-service/cmd/main.go`
- `services/user-service/internal/handler/user_handler.go`
- `services/user-service/internal/service/user_service.go`
- `services/user-service/internal/service/oauth_service.go`
- `services/user-service/internal/repository/user_repository.go`

### Function rất quan trọng: `UserService.Register`

#### Input

- `context.Context`
- `dto.RegisterRequest`

#### Output

- `*dto.AuthResponse`
- `error`

#### Logic

1. normalize email/phone
2. check duplicate email
3. check duplicate phone nếu có
4. hash password bằng bcrypt cost 12
5. tạo `model.User`
6. phát token verify email
7. lưu DB
8. cố gửi email verify
9. sinh access token + refresh token

#### Vì sao flow này tốt?

- không trust input thô từ client
- không lưu plaintext password
- không fail toàn bộ registration chỉ vì email provider tạm lỗi
- login ngay sau register giúp UX mượt hơn

#### Side effects

- insert user vào PostgreSQL
- có thể gửi email
- sinh token JWT

### Function đáng học khác: `UserService.Login`

Điểm hay nhất ở đây là **không tiết lộ nguyên nhân cụ thể** giữa "không có user" và "sai password".

Đây là security practice quan trọng để giảm email enumeration.

### OAuth flow là phần trưởng thành nhất của user-service

`oauth_service.go` cho thấy tư duy bảo mật tốt:

- có signed state
- có nonce hash
- verify provider callback chặt chẽ
- dùng ticket ngắn hạn trước khi đổi sang token pair chuẩn

Đây là flow tốt hơn nhiều so với kiểu callback xong trả access token trực tiếp mà không có lớp ticket trung gian.

### Điểm tốt

- auth flow tách riêng business error rõ ràng
- bcrypt cost hợp lý
- middleware role rõ ràng
- có login protection ở handler
- OAuth được thiết kế có chủ đích, không làm hời hợt

### Điểm chưa tốt / rủi ro

1. **Một số logic bảo vệ login có vẻ nằm ở memory của process**.
   - Nếu scale nhiều instance, lockout theo instance có thể không đồng nhất.
   - Hướng cải thiện: nếu cần production cứng hơn, chuyển sang Redis-backed login attempt store.

2. **Service khá lớn** vì chứa nhiều flow auth khác nhau.
   - Chưa phải vấn đề nghiêm trọng, nhưng nếu tiếp tục tăng feature thì nên tiếp tục tách helper theo intent, không để một file service phình quá nhanh.

### Điều nên học từ service này

- normalize input sớm
- domain error rõ ràng
- không leak thông tin nhạy cảm qua message login
- OAuth phải được thiết kế như một security boundary thật sự

---

## 6.3. `product-service/`

### Trách nhiệm

- CRUD product catalog
- review sản phẩm
- upload ảnh
- search fallback giữa PostgreSQL và Elasticsearch
- gRPC lookup cho cart/order
- low stock monitor nền

### File nên đọc

- `services/product-service/cmd/main.go`
- `services/product-service/internal/service/product_service.go`
- `services/product-service/internal/service/product_review_service.go`
- `services/product-service/internal/repository/product_repository.go`
- `services/product-service/internal/handler/product_handler.go`

### Điều rất đáng học: graceful degradation

`product-service` là service thể hiện rõ nhất tư duy:

> catalog core phải sống được, còn search/media là tăng cường.

Nếu MinIO lỗi hoặc Elasticsearch chưa sẵn sàng, service vẫn khởi động để CRUD catalog tiếp tục chạy.

Đây là thiết kế production-friendly hơn nhiều so với kiểu "search chết thì cả service chết theo".

### Function quan trọng: `ProductService.Create`

#### Input

- `dto.CreateProductRequest`

#### Output

- `*model.Product`
- `error`

#### Logic

1. normalize status
2. normalize variants
3. normalize image URLs
4. tính stock tổng bằng `resolveStock`
5. dựng `model.Product`
6. persist vào PostgreSQL
7. index sang search backend nếu có

#### Điểm đáng học

- backend không tin hoàn toàn vào field stock/image/status từ client
- các invariant quan trọng được chuẩn hóa ở service layer

```go
product := &model.Product{
    ID:        uuid.New().String(),
    Name:      strings.TrimSpace(req.Name),
    Price:     req.Price,
    Stock:     resolveStock(req.Stock, variants),
    Status:    status,
    ImageURL:  resolvePrimaryImage(imageURLs),
    ImageURLs: imageURLs,
}
```

Snippet này cho thấy một nguyên tắc đáng học:

> Service không chỉ "chuyển hộ" request sang repository. Service phải tạo ra domain object ở trạng thái nhất quán hơn input ban đầu.

### Function quan trọng: `ProductService.List`

#### Input

- `dto.ListProductsQuery`

#### Output

- danh sách product
- `ProductListPageInfo`
- error

#### Branch quan trọng

- nếu có search backend, query phù hợp, và chưa dùng cursor -> ưu tiên Elasticsearch
- nếu search fail -> log warning rồi fallback về PostgreSQL
- nếu dùng PostgreSQL -> cursor pagination

#### Vì sao thiết kế này tốt?

- Elasticsearch không giữ dữ liệu thật
- fallback đảm bảo hệ thống bền hơn
- cursor pagination tốt hơn offset khi catalog tăng lớn

### Repository đáng học: `ProductRepository.List`

Đây là một file rất nên đọc với người học Go backend và SQL.

#### Kỹ thuật đang dùng

- dynamic SQL có bind parameter an toàn
- filter theo category/brand/tag/status/search/price/variant attributes
- cursor pagination bằng cursor encode/decode
- fetch `limit+1` để suy ra `hasNext`

#### Độ phức tạp

- xử lý Go ở mức `O(limit)`
- chi phí DB phụ thuộc filter, index và độ phức tạp JSONB predicate

### Review service review của product

`product_review_service.go` đơn giản, dễ hiểu và đủ sạch:

- check product tồn tại trước
- mỗi user chỉ được một review cho một product
- mask email thành `author_label`

### Điểm tốt

- service giàu business intent
- search/index là optional integration đúng nghĩa
- cursor pagination cho catalog là điểm rất đáng học
- gRPC surface hợp lý cho internal lookup

### Điểm chưa tốt / rủi ro

1. **Review pagination vẫn đang dùng `COUNT(*) + OFFSET/LIMIT`**.
   - Với review volume nhỏ thì ổn.
   - Với product hot path rất lớn, offset sâu sẽ tốn hơn.

2. **Index search sau khi commit DB nhưng chưa dùng outbox**.
   - Nếu DB commit thành công nhưng index fail, dữ liệu search sẽ lệch tạm thời.
   - Repo hiện chọn log warning và degrade gracefully, đây là trade-off chấp nhận được cho feature search phụ trợ.

3. **Một số comment cũ ở handler chưa còn khớp hoàn toàn**.
   - Ví dụ mô tả list theo `page/total`, trong khi code hiện dùng cursor meta cho catalog product.

### Điều nên học từ service này

- optional dependency phải thật sự optional
- normalize domain object trước khi lưu
- cursor pagination là lựa chọn đáng ưu tiên cho bảng tăng nhanh

---

## 6.4. `cart-service/`

### Trách nhiệm

- giữ giỏ hàng ngắn hạn trong Redis
- xác minh product thật qua gRPC trước thao tác quan trọng

### File nên đọc

- `services/cart-service/internal/service/cart_service.go`
- `services/cart-service/internal/repository/cart_repository.go`
- `services/cart-service/internal/grpc_client/product_client.go`

### Function quan trọng: `CartService.AddItem`

#### Input

- `userID`
- `dto.AddToCartRequest`

#### Output

- cart mới
- error

#### Logic

1. load cart từ Redis
2. gọi gRPC sang product-service để lấy product thật
3. map lỗi gRPC sang business error dễ hiểu
4. nếu item đã có -> tăng quantity
5. nếu chưa có -> append item mới
6. tính lại total
7. save cart về Redis

#### Điểm hay

- cart không tin price client gửi lên
- stock được check dựa trên product-service
- tổng tiền được tính lại ở backend

### Điểm tốt

- service nhỏ, tập trung, dễ đọc
- source of truth được hiểu đúng: cart chỉ là tạm thời, catalog mới là nguồn giá/stock thật
- gRPC dùng đúng chỗ: lookup nội bộ nhanh

### Điểm chưa tốt / rủi ro

1. **`UpdateItem` hiện chưa re-validate stock với product-service**.
   - User có thể đang tăng số lượng dựa trên stock cũ.
   - Nếu stock đã giảm sau lúc add ban đầu, cart vẫn có thể giữ quantity vượt stock.
   - Cải thiện: trong `UpdateItem`, gọi lại product-service tương tự `AddItem` trước khi save.

2. **Không có reservation/inventory hold**.
   - Đây không hẳn là bug, nhưng là giới hạn thiết kế chấp nhận được.
   - Tức là stock check ở cart chỉ là advisory; kiểm tra quyết định vẫn phải lặp lại ở order-service.

### Điều nên học từ service này

- Redis rất hợp cho state session-like
- giỏ hàng không phải nguồn dữ liệu chính của giá/stock
- service nhỏ và focused thường dễ maintain hơn nhiều service "đa năng"

---

## 6.5. `order-service/`

### Trách nhiệm

- quote order theo giá thật
- tạo order
- coupon
- cancel / update status
- admin report
- consume payment event để sync trạng thái order

### File nên đọc

- `services/order-service/internal/service/order_service.go`
- `services/order-service/internal/repository/order_repository.go`
- `services/order-service/internal/service/payment_events.go`
- `services/order-service/internal/handler/order_handler.go`

### Function cốt lõi nhất: `OrderService.quoteOrder`

Đây là trái tim nghiệp vụ của order-service.

#### Input

- `dto.CreateOrderRequest`

#### Output

- `pricedOrderQuote`
- error

#### Logic

1. validate order không rỗng
2. normalize shipping method
3. yêu cầu địa chỉ nếu không phải pickup
4. lặp qua từng item
5. gọi product-service qua gRPC để lấy product thật
6. check stock thật
7. tính subtotal
8. tính shipping fee
9. nếu có coupon -> validate coupon, tính discount
10. trả quote cuối cùng

#### Vì sao function này rất đáng học?

Vì nó thể hiện nguyên tắc backend commerce đúng chuẩn:

> Giá trị thanh toán cuối cùng phải được tính lại ở backend dựa trên nguồn dữ liệu thật, không lấy nguyên xi từ frontend hoặc cart.

### Function `CreateOrder`

Sau khi có quote:

1. dựng `model.Order`
2. copy item đã được định giá thật
3. persist qua repository
4. publish event `order.created`

#### Side effects

- tạo order trong PostgreSQL
- có thể phát event sang RabbitMQ

### Consumer đáng học: `payment_events.go`

Order-service còn consume event `payment.completed` / `payment.refunded` để cập nhật status order.

Điều này cho thấy order-service vừa là **producer** vừa là **consumer** trong hệ thống event-driven nhỏ.

### Điểm tốt

- business rule tập trung ở service
- quote lại giá và stock là rất đúng
- coupon validation rõ ràng
- có timeline/audit cho order
- report admin dùng query trực tiếp ở repository, dễ kiểm soát hiệu năng

### Điểm chưa tốt / rủi ro

1. **List admin orders vẫn dùng `COUNT(*) + OFFSET/LIMIT`**.
   - Đây chính là vùng docs trước đó đã cảnh báo.
   - Khi data lớn, offset sâu và count full scan sẽ đắt.
   - Hướng cải thiện: cursor/keyset cho list hot path hoặc ít nhất tránh count mọi request nếu UI không cần chính xác tuyệt đối.

2. **Event publish sau commit nhưng chưa có outbox**.
   - Nếu DB commit xong mà RabbitMQ publish fail, order vẫn tồn tại nhưng downstream có thể không nhận event.
   - Đây là gap khá quan trọng nếu hệ thống lớn hơn.
   - Hướng cải thiện dài hạn: outbox table + background relay.

3. **Consumer payment event dùng `context.Background()` trực tiếp**.
   - Điều này làm mất khả năng gắn timeout/hủy theo lifecycle của consumer.
   - Hướng tốt hơn: `context.WithTimeout(context.Background(), 5*time.Second)` hoặc context do worker quản lý.

### Điều nên học từ service này

- order phải định giá lại từ backend
- flow nhiều bước nên giữ invariant ở service/repository đúng chỗ
- event-driven chỉ nên phụ trách side effect hoặc sync bổ trợ, không thay transaction core

---

## 6.6. `payment-service/`

### Trách nhiệm

- tạo payment charge
- hỗ trợ partial payment / split payment
- refund
- MoMo-like pending payment + webhook confirm
- publish event payment lifecycle

### File nên đọc

- `services/payment-service/internal/service/payment_service.go`
- `services/payment-service/internal/repository/payment_repository.go`
- `services/payment-service/internal/client/order_client.go`
- `services/payment-service/internal/handler/payment_handler.go`

### Function quan trọng: `PaymentService.ProcessPayment`

#### Input

- `userID`, `userEmail`, `authHeader`
- `dto.ProcessPaymentRequest`

#### Output

- payment enriched
- error

#### Logic

1. gọi order-service để lấy order thật
2. xác nhận order thuộc về user hiện tại
3. check order có đang ở trạng thái payable không
4. load lịch sử payment của order
5. tính `netPaid` và `outstanding`
6. chuẩn hóa số tiền thanh toán hiện tại
7. normalize payment method
8. tạo payment record
9. nếu là MoMo -> để `pending`, tạo gateway order id + checkout URL
10. persist DB
11. enrich payment với net/outstanding mới
12. nếu completed ngay -> publish event

### Điều đáng học

Payment-service đang có tư duy khá trưởng thành ở 3 điểm:

1. **không assume một order chỉ có một payment**
2. **tính `net paid` và `outstanding` mỗi lần**
3. **webhook được verify signature**

### Function quan trọng: `HandleMomoWebhook`

#### Branch chính

- tìm payment theo `payment_id` hoặc `gateway_order_id`
- verify signature
- nếu payment đã không còn pending -> trả enriched state hiện tại (idempotent-ish)
- check amount khớp
- nếu result code = 0 -> completed
- ngược lại -> failed
- update DB
- publish payment lifecycle event

Đây là một flow webhook tốt hơn mức trung bình vì nó đã nghĩ đến chuyện callback bị gọi lặp.

### Điểm tốt

- business logic thanh toán tương đối rõ ràng
- xử lý split payment/refund tốt cho một demo repo
- enrich payment để client thấy amount đã trả và còn thiếu
- verify HMAC webhook là điểm rất đáng học

### Điểm chưa tốt / rủi ro

1. **Chưa có idempotency key rõ ràng cho các POST charge từ client**.
   - Nếu client retry mạnh hoặc timeout ở ranh giới response, vẫn có nguy cơ tạo payment record mới ngoài ý muốn tùy schema constraint.
   - Hướng cải thiện: thêm `idempotency_key` hoặc unique business key cho payment initiation.

2. **Publish event vẫn chưa có outbox**.
   - Giống order-service, đây là gap consistency đáng lưu ý.

3. **Audit được ghi theo best effort**.
   - Đây là lựa chọn thực dụng, nhưng nếu audit là compliance-critical thì cần transaction hoặc fallback mạnh hơn.

### Điều nên học từ service này

- payment không nên giả định one-shot duy nhất
- webhook phải verify signature và xử lý retry an toàn
- phải tính outstanding từ lịch sử payment, không từ một field mutable duy nhất

---

## 6.7. `notification-service/`

### Trách nhiệm

- consume event RabbitMQ
- route payload sang đúng email template/logic gửi mail

### File nên đọc

- `services/notification-service/cmd/main.go`
- `services/notification-service/internal/handler/event_handler.go`

### Function quan trọng: `EventHandler.HandleMessage`

#### Input

- `amqp.Delivery`

#### Output

- không trả giá trị; ack/nack trực tiếp RabbitMQ message

#### Logic

1. log event nhận được
2. switch theo `RoutingKey`
3. unmarshal payload đúng kiểu
4. gọi sub-handler tương ứng
5. nếu fail -> `Nack(requeue=true)`
6. nếu thành công -> `Ack`

### Điểm tốt

- worker architecture rất dễ hiểu
- manual ack đúng cho reliability cơ bản
- QoS/prefetch có chủ đích, không nuốt queue vô hạn
- health/metrics endpoint riêng cho worker là tốt

### Điểm chưa tốt / rủi ro

1. **Chưa có DLQ hoặc retry policy tách biệt**.
   - Với payload hỏng vĩnh viễn hoặc SMTP lỗi kéo dài, requeue mãi có thể tạo poison message loop.

2. **Chưa có graceful shutdown hoàn chỉnh cho worker loop**.
   - Service nhận signal nhưng chưa thấy flow chờ goroutine worker dừng hẳn hoặc đóng consumer theo context rõ ràng.

3. **Template email còn hardcode trong handler**.
   - Với quy mô hiện tại thì ổn, nhưng nếu notification đa kênh hơn thì nên tách template/render layer.

### Điều nên học từ service này

- event consumer không nhất thiết phải là service HTTP đầy đủ
- handler ở đây vẫn giữ vai trò boundary, chỉ khác boundary là message thay vì HTTP

---

## 7. Frontend `frontend/`: lớp nối với backend khá tốt để học

### Vai trò

- là UI chính cho local verification
- đóng vai trò consumer của API envelope backend
- chuẩn hóa dữ liệu trả về trước khi UI sử dụng

### File nên đọc

- `frontend/src/lib/http/client.ts`
- `frontend/src/lib/api/*.ts`
- `frontend/src/lib/normalizers/index.ts`

### Điều đáng học nhất: chia `http client` + `api module` + `normalizer`

Đây là một cấu trúc frontend rất sạch:

1. `http/client.ts`: lo request raw, error parsing, auth header
2. `api/*.ts`: lo endpoint cụ thể
3. `normalizers/`: ép dữ liệu lỏng từ API thành shape typed, an toàn hơn cho UI

### Vì sao cách này tốt?

- UI component không phải biết chi tiết envelope hay parse lỗi
- nếu backend trả thiếu field, normalizer giữ UI ít gãy hơn
- dễ test và dễ refactor hơn việc gọi `fetch` rải rác khắp component

### Ví dụ: `frontend/src/lib/api/product.ts`

Điểm hay:

- gom query param rõ ràng
- encode path param an toàn
- normalize dữ liệu ngay khi nhận response

### Điểm tốt

- API layer tách khỏi component
- normalizer là kỹ thuật rất đáng học
- envelope từ backend được tận dụng tốt

### Điểm chưa tốt / rủi ro

1. **`getCsrfToken()` có tính phòng thủ, nhưng backend hiện chủ yếu dùng Bearer token**.
   - Không phải bug, nhưng cần hiểu đúng: JWT bearer + same-origin credentials không tự động tạo CSRF defense nếu sau này chuyển sang cookie auth.

2. **Normalizer lớn dần khá nhanh**.
   - Hiện tại vẫn chấp nhận được, nhưng về lâu dài có thể tách theo domain để file nhỏ hơn.

### Điều nên học từ frontend này

- đừng để component nói chuyện trực tiếp với response thô
- normalize dữ liệu ở boundary sẽ giảm rất nhiều bug UI

---

## 8. Những kỹ thuật và tổ chức code đáng học hỏi

### 8.1. Functional options

Được dùng ở `product-service` và `user-service`.

Vì sao tốt:

- constructor không phình quá dài
- dependency optional được thể hiện rõ
- dễ thêm capability mới mà không vỡ call-site cũ

### 8.2. Domain error rõ ràng

Ví dụ:

- `ErrInvalidCredentials`
- `ErrProductNotFound`
- `ErrInvalidCursor`
- `ErrPaymentAmountMismatch`

Đây là thói quen rất tốt vì:

- service nói bằng ngôn ngữ domain
- handler map error sang HTTP rõ hơn
- test dễ assert hơn

### 8.3. Graceful degradation

`product-service` là ví dụ tốt nhất:

- search/backend phụ lỗi -> fallback về PostgreSQL
- object storage lỗi -> cảnh báo nhưng catalog core vẫn chạy

### 8.4. Thin handler

Phần lớn handler trong repo làm đúng 4 việc:

1. bind
2. validate
3. gọi service
4. map error sang response

Đây là shape rất nên giữ.

### 8.5. Shared observability

Health, metrics, tracing, request logging xuất hiện đồng đều ở các service. Điều này cực kỳ quan trọng ở microservices.

---

## 9. Các vấn đề quan trọng cần biết khi review repo này

Dưới đây là các điểm chưa tối ưu hoặc có thể thành vấn đề khi hệ thống lớn dần.

### 9.1. `COUNT(*) + OFFSET/LIMIT` ở một số list endpoint

Xuất hiện rõ ở admin order list và review list.

#### Vì sao là vấn đề?

- offset sâu khiến DB scan bỏ qua nhiều row
- count toàn tập dữ liệu tốn chi phí
- càng lớn dữ liệu càng đắt

#### Mức độ ảnh hưởng

- hiện tại: vừa phải
- về dài hạn: cao với endpoint backoffice/hot path lớn

#### Cải thiện

- dùng cursor/keyset pagination nếu UX cho phép
- nếu vẫn cần page/total, cân nhắc cache/approximate count hoặc chỉ count khi cần

### 9.2. Publish event chưa dùng outbox

Áp dụng cho `order-service` và `payment-service`.

#### Vì sao là vấn đề?

DB commit và RabbitMQ publish là hai bước tách rời. Nếu commit thành công nhưng publish fail:

- order/payment vẫn tồn tại trong DB
- notification hoặc service downstream có thể không biết

#### Mức độ ảnh hưởng

- trung bình trong demo/local
- cao nếu event là bắt buộc cho consistency downstream

#### Cải thiện

- outbox table + relay worker
- hoặc ít nhất retry background có persistence state

### 9.3. Một số consumer dùng `context.Background()` ở deep path

Điển hình là xử lý payment event trong order-service.

#### Vì sao là vấn đề?

- mất timeout/hủy theo lifecycle
- khó kiểm soát resource khi downstream chậm

#### Cải thiện

- bọc bằng `context.WithTimeout`
- nếu có worker manager thì chuyền context sở hữu vòng đời worker

### 9.4. Cart update chưa re-check stock

#### Vì sao là vấn đề?

- cart quantity có thể vượt stock mới nếu stock vừa giảm sau lần add trước

#### Cải thiện

- `UpdateItem` nên gọi product-service để revalidate như `AddItem`

### 9.5. Notification consumer chưa có DLQ / poison message strategy

#### Vì sao là vấn đề?

- message malformed hoặc failure kéo dài có thể bị requeue vô hạn

#### Cải thiện

- DLQ riêng
- retry count / dead-letter routing
- phân biệt lỗi tạm thời và lỗi vĩnh viễn

### 9.6. Comment/tài liệu đôi chỗ còn lệch code hiện tại

Ví dụ pagination comment cũ trong một số handler/doc.

#### Vì sao là vấn đề?

- người học dễ hiểu sai flow thật
- comment sai còn tệ hơn không có comment

#### Cải thiện

- ưu tiên comment "vì sao" hơn là mô tả cơ học
- update comment cùng PR khi behavior đổi

---

## 10. Một vài gợi ý refactor đáng làm trong tương lai

### 10.1. Chuẩn hóa helper publish event

Hiện `order-service` và `payment-service` đều có logic gần giống nhau:

- marshal event
- timeout 5s
- retry 3 lần
- publish RabbitMQ

Có thể trích ra shared package mức vừa đủ, ví dụ `pkg/observability` hoặc `pkg/messaging` nếu thật sự lặp nhiều hơn.

> Lưu ý: chỉ nên trích khi abstraction giúp rõ hơn, không phải vì ghét copy-paste một cách máy móc.

### 10.2. Tách strategy pagination theo domain

- catalog: cursor đã tốt
- admin order list: theo dõi để dần chuyển từ offset sang cursor
- review list: có thể giữ offset nếu xác nhận volume không lớn

### 10.3. Bổ sung idempotency cho payment / webhook path

Đây là hướng cải thiện có giá trị thực tế cao nhất cho flow tài chính.

### 10.4. Outbox cho order/payment event

Nếu repo tiếp tục phát triển, đây là thay đổi kiến trúc đáng làm hơn nhiều so với việc thêm service mới cho "ngầu".

---

## 11. Cách đọc function trong repo này như một senior

Khi mở một function, đừng chỉ hỏi "nó làm gì?". Hãy hỏi theo thứ tự này:

1. **Input thật sự là gì?**
   - request body?
   - claims?
   - state trong DB?

2. **Function đang bảo vệ invariant nào?**
   - không duplicate email?
   - không vượt stock?
   - không overpay order?

3. **Source of truth nằm ở đâu?**
   - DB nào?
   - service nào?

4. **Branch nào là branch nguy hiểm nhất?**
   - fallback?
   - retry?
   - webhook duplicate?

5. **Side effect là gì?**
   - insert/update DB?
   - publish event?
   - call external service?

6. **Nếu function fail giữa chừng thì trạng thái hệ thống ra sao?**

Đó là tư duy phân biệt người mới đọc code và người có thể review code ở mức sản xuất.

---

## 12. Những kỹ năng bạn nên học thêm sau khi đọc repo này

### Bắt buộc nếu muốn mạnh backend Go

1. SQL execution plan và index design
2. transaction và consistency model
3. `context.Context` đúng cách
4. structured logging và tracing
5. testing business logic table-driven

### Rất nên học tiếp

1. outbox pattern
2. idempotency cho payment/webhook
3. keyset pagination
4. profiling/benchmark Go
5. retry, circuit breaker, backpressure

### Dành cho mức senior hơn

1. failure mode analysis
2. incident review / observability-driven debugging
3. schema evolution và backward compatibility
4. performance budgeting cho query hot path

---

## 13. Lộ trình đọc repo để lên tay nhanh nhất

### Giai đoạn 1: Hiểu skeleton

- `pkg/config`
- `pkg/database`
- `pkg/middleware`
- `api-gateway/internal/proxy`

### Giai đoạn 2: Học service dễ nhất

- `user-service`
- `product-service`

### Giai đoạn 3: Học inter-service communication

- `cart-service` gọi gRPC product
- `order-service` gọi gRPC product và publish event
- `payment-service` gọi HTTP order và publish event

### Giai đoạn 4: Học async flow

- `notification-service`
- `order-service/internal/service/payment_events.go`

### Giai đoạn 5: Học frontend boundary

- `frontend/src/lib/http/client.ts`
- `frontend/src/lib/api/*.ts`
- `frontend/src/lib/normalizers/index.ts`

---

## 14. Tóm tắt bài học quan trọng nhất

1. **Code tốt là code bảo vệ đúng invariant domain**, không chỉ chạy được.
2. **Service layer là nơi quan trọng nhất** để hiểu nghiệp vụ.
3. **PostgreSQL vẫn là trung tâm**, đừng để Redis/RabbitMQ đánh lừa bạn về source of truth.
4. **Gateway nên mỏng**, business rule nên ở domain service.
5. **Fallback và graceful degradation** là dấu hiệu của code nghĩ đến production.
6. **Pagination, idempotency, outbox, timeout** là những vùng nâng cấp có giá trị thực chiến cao.
7. **Frontend tốt không tin response thô**, mà chuẩn hóa dữ liệu ở boundary.

Nếu bạn đọc kỹ repo này và thật sự hiểu những điểm trên, bạn không chỉ hiểu một project demo. Bạn đang luyện đúng năng lực để trở thành một backend engineer mạnh hơn:

- đọc code nhanh nhưng không hời hợt
- nhìn ra source of truth
- phân biệt core flow và side effect
- biết đâu là debt đáng ưu tiên sửa
- viết code mới mà không phá kiến trúc cũ

---

## 15. Hành động tiếp theo được khuyến nghị

1. Trace thủ công 3 flow: login, add to cart, checkout + payment.
2. Tự viết lại sequence diagram cho mỗi flow.
3. Chọn 1 issue trong phần review ở trên và tự đề xuất refactor nhỏ.
4. Viết test cho một business rule bạn thấy dễ vỡ.
5. Đọc lại `order-service` và `payment-service` dưới góc nhìn: "Nếu request bị retry 2 lần thì chuyện gì xảy ra?"

Khi bạn làm được 5 việc đó, repo này sẽ trở thành tài liệu học nghề backend cực kỳ có giá trị thay vì chỉ là một dự án để xem qua.
