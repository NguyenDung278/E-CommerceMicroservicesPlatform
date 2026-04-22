# Backend Deep Dive

Tài liệu này không còn dừng ở mức “service nào làm gì”, mà đi vào câu hỏi quan trọng hơn:

- request đi xuyên toàn hệ thống thế nào
- domain invariant nằm ở đâu
- consistency được giữ bằng transaction, idempotency, outbox, inbox hay retry
- dependency nào optional, dependency nào fail là hỏng flow chính
- code hiện tại mạnh ở đâu và yếu ở đâu

Mục tiêu là giúp người đọc nhìn backend như một hệ thống đang chạy thật, chứ không phải tập hợp file rời rạc.

---

## 1. Bức Tranh Vận Hành Toàn Backend

### 1.1. Lớp biên

Client bên ngoài không gọi thẳng các service domain. Mọi HTTP request đi vào `api-gateway`, qua:

1. CORS / secure headers
2. tracing middleware
3. Redis-backed rate limiter
4. structured request logger
5. reverse proxy transport tới service đích

Gateway giữ vai trò **transport boundary**, không giữ business invariant.

### 1.2. Source of truth của từng loại dữ liệu

- user/profile/auth state: `user-service`
- product/catalog/stock/review/storefront: `product-service`
- cart: `cart-service` trên Redis
- order/return/coupon: `order-service`
- payment/refund/webhook apply state: `payment-service`
- notification delivery history/dedupe: `notification-service`

### 1.3. Ba kiểu giao tiếp chính

| Kiểu | Nơi dùng | Vì sao |
| --- | --- | --- |
| HTTP qua gateway | Client -> backend | Contract public |
| gRPC | cart/order -> product, internal user RPC | RPC nội bộ typed, nhẹ cho lookup/stock |
| RabbitMQ | order/payment -> notification, payment -> order | Async side effect, at-least-once delivery |

### 1.4. Ba pattern reliability nổi bật

| Pattern | Nơi dùng | Ý nghĩa |
| --- | --- | --- |
| Idempotency key | order create, payment charge/refund | Retry-safe cho write API |
| Transactional outbox | order-service, payment-service | DB commit và event publish không lệch nhau |
| Inbox / dedupe | notification-service, order-service payment inbox, payment webhook inbox | Event/webhook replay-safe |

---

## 2. Luồng 0: Ingress Qua API Gateway

### 2.1. Call chain

1. `api-gateway/cmd/main.go` boot toàn bộ `ServiceProxy`
2. Route được mirror qua `internal/handler/*_handler.go`
3. `ServiceProxy.Do` nhận request từ gateway
4. `newBackendRequest` clone path/query/body/header
5. `executeWithResilience` forward xuống backend service với retry/circuit breaker

### 2.2. Tại sao gateway mỏng là đúng

Nếu nhét business rule vào gateway:

- rule bị lặp giữa gateway và downstream service
- test boundary khó hơn
- thay đổi domain dễ tạo drift

Repo hiện tại giữ khá đúng:

- gateway biết `route -> service`
- service domain biết `request -> business invariant -> persistence`

### 2.3. Điểm mạnh và điểm yếu

#### Điểm mạnh
- Retry và circuit breaker đặt đúng chỗ: transport layer.
- Redirect được preserve cho OAuth flow.
- Trace context và request id được forward qua HTTP transport.

#### Điểm yếu
- `newBackendRequest` clone header khá rộng. Nếu sau này có internal privileged header, trust boundary cần siết lại.
- Retry chỉ cho method idempotent là đúng, nhưng caller vẫn cần hiểu GET có side effect ẩn là anti-pattern.

### 2.4. Route Mirroring Và Response Forwarding

`api-gateway` không dùng wildcard proxy kiểu “mọi thứ vào là đẩy đi”. Thay vào đó, repo khai báo explicit route mirror trong `api-gateway/internal/handler/*`.

Điều này có 3 tác dụng thực tế:

1. public ingress surface của hệ thống được đọc ra từ code rất nhanh
2. middleware auth/authz vẫn gắn đúng chỗ ở gateway
3. route contract không bị mơ hồ nếu về sau mỗi service thay đổi path

Flow thật ở gateway là:

1. route match ở Echo handler cụ thể
2. `forwardWithProxy("service name", proxy)`
3. `ServiceProxy.Do(...)`
4. `ServiceProxy.ForwardResponse(...)`

`ForwardResponse` cũng đáng chú ý: gateway không decode rồi encode lại JSON. Nó copy header, status, body stream nguyên trạng. Nghĩa là gateway đang đúng nghĩa là transport proxy, không biến thành BFF/adapter tầng business.

### 2.5. Middleware Stack Thật Sự Ảnh Hưởng Runtime Ra Sao

Thứ tự middleware ở gateway không phải chuyện thẩm mỹ. Nó quyết định request được nhìn như thế nào trong toàn hệ thống:

1. `Recover`
   - chặn panic để gateway không chết theo request lỗi
2. `FrontendCORS`
   - chỉ allow list các local frontend origin đang hỗ trợ
3. `Secure`
   - thêm security headers mức transport
4. `EchoMiddleware`
   - extract trace context, attach request id nếu có, mở server span
5. `NewRedisBackedRateLimiter`
   - ưu tiên rate limit theo `user_id`, fallback IP
   - Redis chết thì degrade sang in-memory limiter
6. `RequestLogger`
   - log method/path/route/status/latency/request_id/user_id/trace_id/span_id
7. Prometheus middleware
   - metrics HTTP level

Ý nghĩa của thứ tự này:

- tracing xảy ra trước request logger nên log có thể lấy `trace_id` và `span_id`
- rate limit xảy ra trước service forward nên downstream không phải gánh request sẽ bị reject ngay từ edge
- CORS/secure headers ở ngay boundary ngoài cùng là hợp lý

### 2.6. Config, Boot, Và Fail-Fast Runtime Contract

`pkg/config` đang là runtime contract chung của gần như toàn backend. Điều này có hai mặt:

#### Mặt tốt
- mọi service boot theo cùng pattern
- env/file config có shape nhất quán
- dễ tìm dependency nào gọi service nào qua `ServicesConfig`

#### Mặt giá phải trả
- `Config` ngày càng phình vì chứa gần như mọi nhóm config của toàn backend
- đổi một field ở đây có thể ripple qua nhiều service

Pattern boot hiện tại của repo khá đúng:

1. `config.Load(serviceName)`
2. init logger
3. setup tracing
4. mở dependency bắt buộc như DB/Redis/RabbitMQ
5. chạy migration nếu service sở hữu PostgreSQL
6. wire repository -> service -> handler/client/worker
7. mount route/server
8. start background loop cần thiết

Điểm đáng học là repo thường fail fast với dependency cốt lõi, còn degrade với dependency phụ:

- DB/migration fail -> service không nên lên
- search/index/cache fail -> service vẫn có thể lên
- Redis rate limiter fail -> gateway fallback local
- Redis notification inbox fail -> notification-service degrade reliability nhưng không tự crash

### 2.7. Request ID, Trace, Và Structured Log Không Phải 3 Thứ Tách Rời

Ở repo này, observability tương đối “liền mạch” chứ không bị chia rời:

1. inbound HTTP đi qua `EchoMiddleware`
2. request id được nhặt từ header hoặc context
3. outbound HTTP client dùng `WrapHTTPTransport`
4. outbound gRPC client dùng `GRPCUnaryClientInterceptor`
5. log dùng `LoggerWithContext` hoặc `RequestLogger`

Hệ quả:

- request id có thể đi từ gateway sang service downstream
- trace/span id có thể đi xuyên HTTP và gRPC
- log line ở service layer có đủ `request_id`, `trace_id`, `span_id` nếu code dùng helper đúng

Đây là điểm mạnh thực tế của repo: correlation giữa log và trace không hoàn hảo 100%, nhưng tốt hơn rất nhiều repo chỉ “bật tracing” cho có.

### 2.8. Client Pattern Giữa Các Service

Rất nhiều invariant của repo nằm ở việc service gọi đúng service khác theo đúng source of truth.

Ví dụ:

1. `payment-service -> order-service`
   - payment không tin frontend về order total hoặc owner
   - nó luôn gọi `OrderClient.GetOrder`
2. `order-service -> product-service`
   - quote item, decrease stock, restore stock đều đi qua product truth
3. `notification-service -> user-service`
   - load notification preference
   - poll dispatchable wishlist alerts
4. `user-service -> product-service`
   - batch hydrate product snapshot cho wishlist/alert logic

Điểm đáng học ở các client:

- hầu hết dùng shared transport đã được instrument
- envelope decode được viết explicit thay vì generic magic
- vài client dùng JWT nội bộ ngắn hạn để gọi protected admin/staff route

Đây là giải pháp rất thực dụng: không đẹp về mặt “zero trust nội bộ” tuyệt đối, nhưng đủ rõ ràng và chạy được trong local/dev/compose environment hiện tại.

### 2.9. Repository Helper Pattern Của Repo

Nếu chỉ nhìn service method, bạn sẽ bỏ lỡ nhiều invariant thật đang nằm ở helper/repository layer.

Những family function rất đáng để ý:

1. `normalize*`
   - loại bỏ ambiguity input trước khi bước vào invariant
2. `resolve*`
   - chuyển partial input thành decision business cụ thể
3. `build*`
   - materialize outbox payload, history item, read model
4. `scan*`
   - giữ scan contract của repository rõ ràng, tránh lặp
5. `encode/decode*Cursor`
   - giữ pagination contract ổn định mà không lộ raw SQL state

Những pattern repo đáng học:

1. transaction core nằm ở repo khi nhiều bảng phải cùng commit
2. `FOR UPDATE SKIP LOCKED` dùng để claim outbox/refund queue
3. inbox/outbox đều được persisted bằng DB/Redis primitive thật, không chỉ là “ý tưởng kiến trúc”

---

## 3. Luồng 1: Browse Catalog và Storefront

### 3.1. Public catalog listing

Flow `GET /api/v1/products`:

1. Client -> gateway
2. Gateway forward sang `product-service`
3. `ProductHandler.List` parse filter/cursor/sort
4. `ProductService.List` normalize query
5. Nếu phù hợp, service ưu tiên search backend
6. Nếu search fail hoặc query không phù hợp, fallback PostgreSQL cursor listing
7. Record search analytics best-effort

### 3.2. Invariant của flow

- PostgreSQL là source of truth
- Elasticsearch chỉ là read accelerator
- search fail không được làm catalog chết
- cursor pagination là path “đúng” cho catalog lớn

### 3.3. Storefront home/category

Flow `GET /api/v1/storefront/home`:

1. `StorefrontHandler.GetHome`
2. `StorefrontService.GetHome`
3. `ListCategories`
4. batch `ListEditorialSectionsByCategorySlugs`
5. batch `ListFeaturedProductsByCategorySlugs`
6. compose `StorefrontHome`

Điểm hay ở đây là service tránh `categories + N queries`.

### 3.4. Điểm mạnh và điểm yếu

#### Điểm mạnh
- Search degrade có chủ đích.
- Storefront read path tránh N+1.
- Search analytics không chặn business flow.

#### Điểm yếu
- Search synonym đang hard-code trong codebase.
- Chưa có metric rõ ràng cho tỷ lệ fallback PostgreSQL khi search backend fail.

### 3.5. Walkthrough Theo Code

Nếu mở `internal/handler/product/product_handler.go` và `internal/service/product_queries.go`, hãy đọc public catalog listing theo các block sau:

1. Handler `List`
   - Parse `limit`, `min_price`, `max_price`, filter, sort, cursor.
   - Không tự query DB hay search trực tiếp.
   - Chỉ delegate sang `ProductService.List`.
2. Service `List`
   - `normalizeListProductsQuery` chạy một lần ngay đầu flow.
   - Nếu có search backend và query phù hợp, service thử `search.Search(...)`.
   - Search path chỉ trả ID list; sau đó service vẫn hydrate full product row từ PostgreSQL qua `repo.ListByIDs`.
   - Nếu search lỗi, service log warning rồi fallback PostgreSQL.
3. Repository `List`
   - Build SQL theo filter/sort/cursor.
   - Decode cursor và reject nếu cursor không khớp sort hiện tại.
   - Query `LIMIT + 1` để biết còn trang tiếp theo hay không.
   - Encode next cursor từ row cuối cùng.

Đọc flow này xong, bạn sẽ thấy repo đang rất nhất quán ở một nguyên tắc: search engine chỉ giúp “tìm nhanh”, còn PostgreSQL mới là nơi hydrate authoritative row để trả API.

### 3.6. Walkthrough Storefront Và Review

Khi mở `internal/handler/product/storefront_handler.go` và `internal/service/storefront_service.go`, hãy nhìn `GetHome` như một bài học về read orchestration:

1. Handler parse `limit`, map lỗi input, rồi gọi service.
2. `StorefrontService.GetHome`
   - `ListCategories`
   - `sanitizeStorefrontHomeLimit`
   - extract slug list
   - batch `ListEditorialSectionsByCategorySlugs`
   - batch `ListFeaturedProductsByCategorySlugs`
   - compose `StorefrontCategoryPage`
   - filter category không có storefront content thực sự
3. Ý nghĩa
   - Không có pattern categories -> query sections từng category -> query products từng category.
   - Repo chủ động tránh waterfall/N+1.

Ngoài browse path, `product-service` còn có review flow đáng học:

1. `ProductHandler.CreateReview` chỉ lấy user claims và validate request.
2. `ProductReviewService.CreateReview`
   - verify product tồn tại
   - factory tạo review aggregate
   - `runInTx` để `CreateReview` và `ApplyReviewSummaryDelta` cùng commit
   - sau commit mới `notifyBestEffort`
3. `product_review_repository.go`
   - unique violation được map sang `ErrProductReviewAlreadyExists`
   - summary table update theo delta, không recount toàn bộ review table

Đây là một pattern rất đáng học: write path nghiệp vụ giữ transaction core nhỏ và rõ, còn cache invalidation/metrics observer được đẩy ra sau commit.

---

## 4. Luồng 2: Cart Lifecycle

### 4.1. Add item

Flow `POST /api/v1/cart/items`:

1. Client -> gateway -> cart-service
2. `CartHandler.AddItem` bind + validate
3. `CartService.AddItem`
4. `loadCart` từ Redis
5. `getProductForCart` gọi gRPC `product-service`
6. `mergeCartItem` hoặc `newCartItem`
7. `saveCart` ghi lại whole cart JSON vào Redis

### 4.2. Merge guest cart

Flow `POST /api/v1/cart/merge`:

1. Handler validate `MergeCartRequest`
2. Service loop qua guest items
3. Mỗi item gọi product-service để lấy latest snapshot
4. Merge vào cart hiện tại
5. Save đúng một lần

### 4.3. Invariant của flow

- product truth luôn thuộc về `product-service`
- cart snapshot là secondary view
- stale price nên được refresh ở write path

### 4.4. Vấn đề thực tế

- `UpdateItem` chưa re-check stock/price, nên consistency kém hơn `AddItem`
- `MergeCart` hiện có dạng N gRPC calls
- cart overwrite có thể lost-update nếu 2 write đồng thời

### 4.5. Nên cải thiện gì

- batch product lookup
- optimistic version hoặc WATCH/transaction nhẹ cho Redis cart write
- `RepriceCart` trước checkout

### 4.6. Walkthrough Theo Code

Khi mở `internal/handler/cart/cart_handler.go`, hãy đọc `AddItem` và `MergeCart` trước:

1. Handler chỉ làm boundary:
   - lấy `claims.UserID`
   - `Bind`
   - `Validate`
   - map domain error
2. Điểm hay là mapping business error rất nhất quán:
   - product missing -> `404`
   - product invalid/unavailable -> `400`
   - insufficient stock -> `409`

Khi mở `internal/service/cart/cart_mutations.go`, chia `AddItem` thành 5 block:

1. `loadCart`
   - lấy cart hiện tại từ Redis
   - normalize nil cart thành empty cart
2. `getProductForCart`
   - gọi gRPC `product-service`
   - map gRPC error thành domain error
3. `findCartItemIndex`
   - xác định item đã có hay chưa
4. `mergeCartItem` hoặc `newCartItem`
   - `mergeCartItem` vừa tăng quantity vừa refresh `Name` và `Price`
   - `newCartItem` dùng snapshot authoritative để dựng line mới
5. `saveCart`
   - whole-cart overwrite về Redis

Khi mở `internal/repository/cart/cart/cart_repository.go`, bạn sẽ thấy vì sao flow này vừa nhanh vừa có risk riêng:

1. `Get` đọc JSON blob tại `cart:{userID}`.
2. Nếu key không tồn tại, repo trả empty cart chứ không báo lỗi.
3. Mỗi lần read thành công đều refresh TTL 7 ngày.
4. `Save` ghi lại toàn bộ cart blob.

Chính mô hình “read-modify-write whole JSON” này làm code rất dễ đọc, nhưng cũng mở ra risk lost update nếu có hai request mutation đồng thời trên cùng cart.

---

## 5. Luồng 3: Register, Login, Recovery, Profile

### 5.1. Register

Flow `POST /api/v1/auth/register`:

1. `UserHandler.Register`
2. `UserService.Register`
3. normalize email/phone/name
4. check unique email/phone
5. bcrypt password
6. tạo user + email verification token hash
7. build auth response
8. handler best-effort start email OTP verification flow nếu user chưa verified

#### Walkthrough theo code

Khi mở `internal/handler/user/auth_handlers.go`, hãy đọc `Register` thành 4 block:

1. `Bind` + `Validate`
   - Handler chỉ chịu trách nhiệm boundary validation.
   - Nếu request body lỗi hoặc thiếu field, flow dừng ngay ở đây.
2. Gọi `UserService.Register`
   - Toàn bộ uniqueness check, bcrypt, create user nằm ở service.
3. Map business error
   - `ErrEmailAlreadyExists` và `ErrPhoneAlreadyExists` được map sang `409 Conflict`.
   - Handler không expose lỗi SQL hay unique index raw.
4. Best-effort OTP kick-off
   - Sau khi register thành công, handler nhìn vào `result.User`.
   - Nếu email chưa verified thì gọi `StartEmailVerificationOTP`.
   - Nếu bước này fail, handler chỉ log warning chứ không rollback account vừa tạo.

Khi mở tiếp `internal/service/account/user_auth.go`, hãy đọc `Register` thành 6 block:

1. Normalize input
   - Email, phone, first name, last name đều được normalize trước.
   - Nếu người dùng không nhập tên thì service tự sinh tên placeholder để giữ profile usable.
2. Check uniqueness
   - Lookup email trước.
   - Chỉ khi phone có giá trị mới lookup phone.
3. Hash password
   - Dùng bcrypt cost `12`, đây là phần tốn CPU nhất của flow.
4. Build `model.User`
   - Role mặc định là `RoleUser`.
   - `EmailVerified` và `PhoneVerified` đều bắt đầu là `false`.
5. Issue email verification token hash
   - Repo không lưu raw verification token.
   - Chỉ hash + expiry được giữ trong DB.
6. Persist rồi build auth response
   - Sau `repo.Create`, service trả luôn token pair chuẩn để người dùng có session ngay.

### 5.2. Login

Flow `POST /api/v1/auth/login`:

1. handler parse request
2. `LoginAttemptProtector.Check`
3. `UserService.Login`
4. lookup user theo email hoặc phone
5. bcrypt compare
6. build auth response
7. reset login protector state nếu thành công

#### Walkthrough theo code

Khi đọc `auth_handlers.go`, chú ý rằng login protection nằm ở handler chứ không ở service:

1. Handler parse request và reject nếu thiếu `Identifier` lẫn `Email`.
2. `loginAttemptKeys(req, c.RealIP())` tạo hai loại key:
   - `identifier:<normalized identifier>`
   - `ip:<client ip>`
3. `loginProtector.Check` chạy trước call vào service.
4. Chỉ khi service trả `ErrInvalidCredentials` thì handler mới `RecordFailure`.
5. Nếu login thành công thì `RecordSuccess` xóa toàn bộ attempt state của identifier/IP đó.

Khi đọc `internal/handler/user/login_protection.go`, hãy hiểu rõ semantics:

1. `Check` chỉ đọc state và trả `retryAfter` dài nhất.
2. `RecordFailure` tăng `failures`, đạt ngưỡng thì set `lockedUntil`.
3. `stateForLockedKey` đồng thời cleanup state quá TTL.
4. Đây là in-memory map với `sync.Mutex`, nên scale-out nhiều replica sẽ không chia sẻ state lock.

Khi đọc `UserService.Login` trong `user_auth.go`:

1. `normalizeIdentifier` quyết định lookup theo email hay phone.
2. `findUserByIdentifier` tách lookup sang helper nhỏ.
3. Nếu user không tồn tại hoặc bcrypt compare fail thì đều trả `ErrInvalidCredentials`.
4. Thành công thì `buildAuthResponse` ký token mới và attach avatar URL.

### 5.3. Forgot/reset password

Flow:

1. `ForgotPassword`
2. issue time-bound token
3. lưu token hash vào DB
4. gửi email best-effort
5. `ResetPassword` lookup theo token hash, đổi password hash mới và clear reset token

### 5.4. Profile update

Flow `PUT /api/v1/users/profile`:

1. handler bind patch
2. `UserService.UpdateProfile`
3. nếu có `ProfileTxManager`, mở transaction
4. `updateProfileWithDependencies`
5. normalize name/phone/address patch
6. nếu đổi phone thì bắt buộc challenge đã verify
7. nếu patch default address có ý nghĩa thì upsert default address
8. update user row
9. consume verified phone challenge

#### Walkthrough theo code

`UpdateProfile` là flow hay nhất của `user-service` nếu bạn muốn học cách giữ invariant multi-repo mà không làm handler phình to.

Khi mở `internal/handler/user/profile_handlers.go`:

1. Handler lấy user claims từ JWT.
2. `Bind` + `Validate`.
3. Gọi `UserService.UpdateProfile`.
4. Map domain error rất chi tiết:
   - `ErrInvalidPhoneNumber`
   - `ErrInvalidProfileName`
   - `ErrInvalidProfileAddress`
   - `ErrPhoneAlreadyExists`
   - `ErrPhoneVerificationRequired`
   - `ErrPhoneVerificationAlreadyUsed`

Khi mở `internal/service/account/user_profile.go`, đọc theo thứ tự:

1. `UpdateProfile`
   - Nếu không có `profileTxManager`, flow chạy trực tiếp.
   - Nếu có `profileTxManager`, toàn bộ update chạy trong transaction.
2. `updateProfileWithDependencies`
   - Load user hiện tại.
   - Resolve patch first name, last name.
   - Resolve optional phone và xác định `phoneChanged`.
   - Nếu đổi phone, bắt buộc đi qua `applyVerifiedPhoneChange`.
   - Với default address, service chỉ lookup address khi patch thật sự có dữ liệu meaningful.
   - Không có thay đổi nào thì return user hiện tại ngay.
   - Có address patch thì `UpsertDefaultAddress`.
   - Có user patch thì `userRepo.Update`.
   - Cuối cùng mới consume phone verification challenge.
3. `applyVerifiedPhoneChange`
   - Validate VN phone.
   - Check phone uniqueness.
   - Load verification challenge theo ID.
   - Challenge phải thuộc đúng user, chưa consumed, và đúng target phone.
   - Chỉ sau đó mới mutate `user.Phone`.

Khi mở `internal/repository/profile_tx_manager.go`, bạn sẽ thấy vì sao flow này đủ an toàn:

1. Transaction được mở ở repository layer.
2. Cùng một `tx` được inject vào `Users`, `Addresses`, `PhoneVerifications`.
3. Callback business logic không cần biết SQL transaction chi tiết nhưng vẫn chạy atomically.

### 5.5. Invariant của flow

- password chỉ compare/hash ở service layer
- verification/reset token được lưu hash, không lưu raw token
- profile update multi-repo có transaction manager thật
- user existence không nên bị leak ở recovery flow

### 5.6. Điểm mạnh và điểm yếu

#### Điểm mạnh
- Auth flow chia tương đối sạch thành `user_auth`, `user_tokens`, `auth_recovery`, `user_profile`.
- Login brute-force protection có thật.
- Profile update hiểu rõ semantics “patch rỗng”, “phone đổi cần challenge”.

#### Điểm yếu
- `LoginAttemptProtector` hiện là in-memory; nhiều replica sẽ không share lock state.
- Address default invariant chỉ chặt khi đi qua profile tx manager; address endpoints riêng vẫn có failure window vì `ClearDefault` và write tách bước.

---

## 6. Luồng 4: OTP Signup và OTP Verify

### 6.1. Email signup OTP

1. `StartEmailSignup`
2. validate password confirmation
3. check rate limit
4. tạo hoặc refresh email signup challenge
5. gửi OTP email
6. client gọi `VerifyEmailSignupOTP`
7. verify OTP hash constant-time
8. create user thật
9. issue token pair

### 6.2. Phone signup OTP

1. `StartPhoneSignup`
2. normalize phone
3. resolve Telegram chat id
4. tạo challenge
5. gửi OTP qua Telegram
6. verify challenge
7. tạo user và issue token

### 6.3. Logged-in email/phone verification

- Email verification challenge và signup challenge là hai domain khác nhau
- Phone verification phục vụ đổi phone/profile cũng là domain riêng
- Attempt count, resend cooldown, TTL, daily limit đều nằm ở service layer

### 6.4. Reliability và security

#### Điểm đúng
- OTP code không lưu plain text
- compare dùng `subtle.ConstantTimeCompare`
- rate limit theo user/email/IP
- locked challenge có status riêng

#### Chỗ cần nghĩ thêm
- cleanup expired challenge hiện chủ yếu opportunistic
- nếu muốn scale lớn hơn, rate limit state nên externalize mạnh hơn thay vì chỉ local memory + repo mix

---

## 7. Luồng 5: Google OAuth

### 7.1. Vì sao flow chia 3 bước là đúng

Repo hiện không làm OAuth kiểu “callback xong là phát JWT luôn”. Thay vào đó:

1. `BeginOAuth`
2. `CompleteOAuthCallback`
3. `ExchangeOAuthTicket`

Thiết kế này giảm rủi ro lộ token hệ thống trong redirect URL hoặc log proxy.

### 7.2. Flow chi tiết

#### Bước 1: Start

1. `StartGoogleOAuth`
2. `UserService.BeginOAuth`
3. normalize provider
4. resolve callback URL theo origin
5. issue nonce + hash nonce
6. sign `oauth_state`
7. build provider auth URL
8. set nonce cookie
9. redirect browser sang Google

#### Bước 2: Callback

1. Google redirect về callback
2. handler lấy `code`, `state`, nonce cookie
3. `CompleteOAuthCallback`
4. parse signed state
5. verify nonce hash
6. exchange code với provider
7. `resolveOAuthUser`
8. sign short-lived login ticket
9. redirect frontend với ticket

#### Bước 3: Exchange

1. frontend gọi `/oauth/exchange`
2. `ExchangeOAuthTicket`
3. parse JWT ticket purpose-specific
4. reload user
5. build auth response chuẩn

### 7.3. Invariant

- state là server-issued signed token, không tin raw query
- nonce hash ràng buộc callback với browser flow gốc
- provider identity có thể auto-link theo email, nhưng vẫn đi qua `resolveOAuthUser`

### 7.4. Risk còn lại

- origin/callback logic luôn là vùng dễ sai nếu production có nhiều frontend origin
- cần tiếp tục cẩn thận với open redirect và callback URL resolution

### 7.5. Cách Đọc File OAuth Không Bị Lẫn

Mở `internal/service/account/oauth_service.go` và đọc đúng ba hàm public:

1. `BeginOAuth`
   - Normalize provider.
   - Resolve callback URL.
   - Issue raw nonce + nonce hash.
   - Sign `oauth_state`.
   - Build provider authorization URL.
2. `CompleteOAuthCallback`
   - Parse signed state.
   - Verify provider và nonce cookie.
   - Exchange authorization code với provider.
   - `resolveOAuthUser`.
   - Sign short-lived login ticket.
   - Build redirect URL về frontend.
3. `ExchangeOAuthTicket`
   - Parse ticket purpose-specific.
   - Reload user.
   - Build auth response chuẩn.

Nếu đọc theo đúng thứ tự này, bạn sẽ thấy repo cố tình tách “social callback” khỏi “issue system JWT”. Đây là chỗ repo trưởng thành hơn phần lớn code sample OAuth trên mạng.

---

## 8. Luồng 6: Create Order

### 8.1. Flow chi tiết

1. Client checkout gọi `POST /api/v1/orders`
2. Gateway forward tới `order-service`
3. `OrderHandler.CreateOrder` bind + validate
4. lấy `Idempotency-Key`
5. `OrderService.CreateOrder`
6. normalize idempotency key
7. `findIdempotentOrder`
8. `quoteOrder`
9. `quoteOrderItem` cho từng item:
   - gọi gRPC `product-service`
   - check stock
10. validate coupon nếu có
11. build `Order` aggregate
12. build outbox `order.created`
13. reserve stock qua `product-service`
14. persist order + order_items + event + outbox + idempotency record
15. nếu persistence fail sau reserve stock, restore stock

#### Walkthrough handler -> service -> repository

Khi mở `internal/handler/order/order_handler.go`, hãy đọc `CreateOrder` theo 3 block:

1. Boundary
   - Lấy claims từ JWT.
   - `Bind` + `Validate`.
2. Service call
   - Truyền `claims.UserID`, `claims.Email`, và `Idempotency-Key`.
   - Đây là điểm cho thấy order ownership và notification target đi cùng từ đầu.
3. Error mapping
   - `ErrInvalidIdempotencyKey` -> `400`.
   - `ErrIdempotencyKeyConflict` -> `409`.
   - Các lỗi pricing/coupon/product gom vào `writePricingError`.

Khi mở `internal/service/order/order_lifecycle.go`, đọc `CreateOrder` theo từng block rõ ràng:

1. Observability wrapper
   - Set timer, outcome, contextual logger.
2. Idempotency block
   - Normalize key.
   - Hash request payload.
   - `findIdempotentOrder`.
3. Pricing block
   - Reuse `quoteOrder`.
4. Aggregate materialization block
   - `newOrderFromQuote`.
   - `buildCreatedOrderOutbox`.
   - Build idempotency record.
5. Stock reservation block
   - `reserveCreatedOrderStock`.
   - Đây là external side effect đầu tiên.
6. Persistence block
   - `persistCreatedOrder`.
   - Nếu fail sau reserve, gọi `restoreOrderItemsStock`.
   - Nếu unique violation do race, thử replay order theo idempotency key.

Khi mở `internal/repository/order_repository.go`, đọc `createOrderTx` như transaction core:

1. `BeginTx`.
2. Nếu có coupon thì `lockAndConsumeCoupon`.
3. Insert `orders`.
4. Insert từng `order_items`.
5. Insert `order_events`.
6. Insert `outbox_events`.
7. Insert `order_idempotency_keys`.
8. `Commit`.

Đây là nơi giữ invariant thật sự: order row, event log, outbox row, idempotency record phải cùng tồn tại hoặc cùng không tồn tại.

### 8.2. Invariant của flow

- order total phải dựa trên product truth hiện tại, không tin cart snapshot hay frontend
- coupon phải được lock/consume trong transaction persistence
- create order phải retry-safe theo user + idempotency key + request hash

### 8.3. Vì sao flow này đúng nhưng chưa hoàn hảo

#### Đúng ở chỗ
- pricing không bị drift giữa preview và create
- idempotency record được persist cùng transaction
- event không publish trực tiếp trong request path mà đi qua outbox

#### Chưa hoàn hảo ở chỗ
- stock reserve gọi sang service ngoài trước khi local DB commit
- nếu product-service hoặc network có vấn đề ở giữa, compensation trở nên quan trọng

### 8.4. Chỗ nào giữ invariant thật

| Invariant | Nơi giữ |
| --- | --- |
| cart không rỗng | `validateOrderRequest` |
| shipping method hợp lệ | `normalizeShippingMethod` |
| coupon hợp lệ | `validateCoupon` + repository lock |
| stock đủ | `quoteOrderItem` và reserve stock |
| request replay-safe | `findIdempotentOrder` + idempotency table |

---

## 9. Luồng 7: Payment Charge

### 9.1. Flow chi tiết

1. Client gọi `POST /api/v1/payments`
2. Gateway -> `payment-service`
3. `PaymentHandler.ProcessPayment`
4. lấy `Authorization` header gốc và `Idempotency-Key`
5. `PaymentService.ProcessPayment`
6. replay idempotency nếu request cũ
7. `processPaymentCore`
8. gọi `order-service` để load authoritative order
9. verify ownership và order status payable
10. load payment history theo order
11. tính outstanding
12. normalize amount và payment method
13. nếu method là MoMo thì payment status = pending, build checkout URL
14. nếu method completed ngay thì build outbox event
15. persist payment + outbox + idempotency record

### 9.2. Invariant

- payment amount không được vượt outstanding
- order phải thuộc đúng user
- order phải ở trạng thái payable
- repeated request với cùng idempotency key nhưng payload khác phải bị conflict

### 9.3. Điều đáng học ở flow này

- service không tin client về outstanding balance
- charge và refund dùng cùng pattern idempotency
- read model trả enriched payment thay vì raw row

### 9.4. Walkthrough Handler -> Service -> Repository

Khi mở `internal/handler/payment/payment_handler.go`, đọc `ProcessPayment` theo 3 block:

1. Boundary
   - lấy user claims
   - `Bind` + `Validate`
2. Service call
   - forward cả `Authorization` header và `Idempotency-Key`
   - điều này cho thấy payment-service cần order truth từ downstream và cần request replay-safe
3. Error mapping
   - `ErrOrderNotFound`, `ErrOrderNotPayable`, `ErrPaymentAlreadySettled`, `ErrInvalidPaymentAmount`, `ErrIdempotencyKeyConflict`

Khi mở `internal/service/payment/payment_processing.go`, đọc `processPaymentCore` thành các block:

1. Idempotency wrapper
   - normalize key
   - hash request
   - replay lookup
2. Authoritative order lookup
   - gọi `orderClient.GetOrder` với auth header gốc
   - reject nếu order không thuộc user hoặc status không payable
3. Outstanding calculation
   - load payment history theo order
   - `summarizeNetPaid`
   - tính `outstanding`
4. Payment materialization
   - amount <= 0 thì default bằng outstanding
   - normalize method
   - MoMo => `pending` + `GatewayOrderID` + `CheckoutURL`
   - immediate method => `completed`
5. Persistence
   - build outbox nếu completed
   - `CreateWithIdempotency` hoặc `Create`
   - nếu unique violation trên idempotency thì replay lại payment cũ

Khi mở repository:

1. `Create`
   - transaction gồm insert payment + insert outbox
2. `CreateWithIdempotency`
   - thêm insert idempotency record vào cùng transaction

Đây là nơi giữ invariant thật: payment row, outbox row, idempotency record phải cùng commit.

---

## 10. Luồng 8: Payment Webhook

### 10.1. Flow chi tiết

1. Gateway hoặc external callback gọi `/api/v1/payments/webhooks/momo`
2. `PaymentHandler.HandleMomoWebhook`
3. `PaymentService.HandleMomoWebhook`
4. resolve payment theo `payment_id` hoặc `gateway_order_id`
5. verify gateway provider
6. verify signature
7. nếu payment không còn pending thì coi là replay an toàn
8. nếu còn pending:
   - check amount
   - đổi state thành completed hoặc failed
   - build outbox message
   - apply update cùng inbox record trong transaction

### 10.2. Tại sao inbox ở webhook quan trọng

Webhook provider thường retry nhiều lần. Nếu không có inbox/dedupe:

- payment state có thể bị apply nhiều lần
- downstream event có thể bắn lặp
- notification/order update có thể chạy lặp

### 10.3. Điểm mạnh và rủi ro

#### Điểm mạnh
- signature verification có thật
- replay-safe nếu payment đã final
- outbox tiếp tục đảm bảo downstream event không lệch DB

#### Rủi ro
- hiện logic khá cụ thể cho MoMo
- thêm provider mới mà không tách strategy sẽ làm service phình nhanh

### 10.4. Walkthrough Theo Code

Khi mở `internal/handler/payment/payment_handler.go`, `HandleMomoWebhook` gần như không có business logic:

1. bind request
2. gọi service
3. map `ErrPaymentNotFound`, `ErrInvalidWebhookSignature`, `ErrPaymentAmountMismatch`

Điểm này rất đúng vì webhook logic là thứ không nên nằm ở handler.

Khi mở `internal/service/payment/payment_refunds.go`, đọc `HandleMomoWebhook` theo các block:

1. Resolve target payment
   - theo `payment_id` hoặc `gateway_order_id`
2. Verify provider
   - payment phải thực sự thuộc `momo`
3. Verify signature
4. Replay-safe shortcut
   - nếu payment không còn `pending`, trả current state như một replay an toàn
5. State transition
   - amount phải khớp
   - `result_code == 0` => `completed`
   - khác `0` => `failed`
6. Build outbox
7. Apply transactionally qua repository

Khi mở `payment_repository.go`, `ApplyWebhookResult` là transaction core:

1. insert inbox row trước để dedupe webhook
2. update payment chỉ khi current status còn `pending`
3. insert outbox
4. commit

Chính thứ tự này giúp webhook provider retry nhiều lần mà payment state vẫn không bị apply lặp vô hạn.

---

## 11. Luồng 9: Order -> Notification Event Delivery

### 11.1. Từ order-service ra RabbitMQ

1. `buildCreatedOrderOutbox` hoặc `buildReturnOutboxMessage`
2. persist cùng DB transaction
3. `StartOutboxRelay`
4. `ClaimPendingOutbox`
5. `publishOutboxMessage`
6. `MarkOutboxPublished` hoặc `MarkOutboxFailed`

#### Walkthrough theo code

Khi mở `internal/service/order/order_events.go`, hãy nhìn outbox relay như một mini job processor:

1. `StartOutboxRelay`
   - Tạo ticker polling.
   - Nếu RabbitMQ channel nil thì disable relay, không panic service.
2. `flushOutboxBatch`
   - Claim batch messages từ DB.
   - Publish từng message với `context.WithTimeout`.
   - Publish fail thì `MarkOutboxFailed` với backoff tăng dần.
   - Publish thành công thì `MarkOutboxPublished`.
3. `publishOutboxMessage`
   - Map row DB thành `amqp.Publishing`.
   - Gắn `MessageId`, `x-event-id`, `x-request-id`.
   - Delivery mode là persistent.

Khi mở repository, `ClaimPendingOutbox` dùng `FOR UPDATE SKIP LOCKED`. Đây là lý do nhiều replica cùng chạy relay vẫn không double-claim cùng một row.

### 11.2. Từ RabbitMQ sang notification-service

1. `startWorker`
2. `EventHandler.HandleMessage`
3. `inboxStore.Claim`
4. parse + process event
5. check notification preference
6. send email
7. append history best-effort
8. `MarkProcessed`

### 11.3. Failure mode

| Failure | Hệ quả | Cách repo xử lý |
| --- | --- | --- |
| RabbitMQ down lúc order commit | event chưa publish | outbox row còn trong DB |
| Notification send lỗi transient | message cần retry | retry queue + backoff |
| Payload lỗi vĩnh viễn | poison message | reject sang DLQ |
| Redis inbox down | dedupe suy yếu | service degrade, không crash |

### 11.4. Walkthrough Bên `notification-service`

Nếu mở `internal/handler/event_handler.go`, hãy đọc `HandleMessage` như một state machine nhỏ:

1. Build metadata từ delivery headers.
2. `inboxStore.Claim`
   - duplicate thật -> ack và bỏ qua
   - claim đang bận -> nack requeue
   - claim mới thành công -> tiếp tục
3. `processMessage`
   - parse payload theo routing key
   - gọi đúng handler con như `handleOrderCreated`, `handlePaymentCompleted`, `handleReturnEvent`
4. Nếu lỗi:
   - permanent -> reject DLQ
   - transient + còn quota -> publish retry message
   - retry exhausted -> reject DLQ
5. Nếu thành công:
   - append history best-effort
   - `MarkProcessed`
   - ack

Khi mở `internal/inbox/redis_store.go`, bạn sẽ thấy dedupe không nằm ở process memory mà nằm ở Redis Lua script. Đây là lý do nhiều replica cùng consume vẫn có duplicate suppression tương đối tốt.

Khi mở `internal/messaging/retry_publisher.go`, retry không cần DB:

1. retry count và first-seen timestamp nằm trên message headers
2. delay queue TTL dùng để quay message trở lại main queue
3. delay tăng dần theo exponential backoff bounded

Khi mở `internal/inbox/history_store.go`, history/audit feed cũng có semantics riêng:

1. user-visible item được index vào feed theo user
2. mọi item đều đi vào audit feed chung
3. mark-all-read thực chất là rewrite payload item với `ReadAt`

---

## 12. Luồng 10: Return và Refund Worker

### 12.1. Create return

1. user gọi `CreateReturn`
2. service load order
3. verify ownership và order status
4. load existing returns
5. tính available quantity per order item
6. persist return + return event + outbox

### 12.2. Approve / reject return

1. admin gọi `UpdateReturnStatus`
2. service validate transition graph
3. build outbox tương ứng
4. repo persist status change + return event

### 12.3. Queue refund

1. admin gọi `RequestReturnRefund`
2. service load return
3. validate status đủ điều kiện
4. `prepareReturnRefund`
5. tìm refundable charge payment từ `payment-service`
6. mark return thành `refund_pending`
7. background worker claim pending returns
8. worker gọi `payment-service` refund API
9. nếu thành công -> `CompleteReturnRefund`
10. nếu fail -> `MarkReturnRefundAttemptFailed`

#### Walkthrough worker semantics

Khi mở `internal/service/order/order_returns.go`, đừng nhầm `RequestReturnRefund` với “thực hiện refund”:

1. API chỉ validate state và chuẩn bị dữ liệu refund.
2. Repo chỉ đổi return sang `refund_pending`.
3. Worker nền mới là nơi gọi external refund API.

Khi mở repository:

1. `ClaimPendingReturnRefunds`
   - Claim các return đang `refund_pending`, chưa có `refund_payment_id`, đã tới thời điểm retry.
   - Đồng thời set `refund_processing_started_at = NOW()` để tạo lease.
2. `CompleteReturnRefund`
   - Chuyển trạng thái sang `refunded`.
   - Ghi `refund_payment_id`, clear error, add return event, add outbox.
3. `MarkReturnRefundAttemptFailed`
   - Không rollback toàn bộ return.
   - Chỉ ghi `refund_last_error`, `refund_next_retry_at`, clear processing flag.

Đây là pattern rất đáng học: side effect có thể thất bại không nên giữ request HTTP mở quá lâu, mà nên biến thành durable background workflow.

### 12.4. Điểm đáng học

- refund external call được đẩy ra background worker
- queue health có endpoint và metric riêng
- return flow là ví dụ rõ của state machine nhiều bước

---

## 13. Luồng 11: Wishlist Alerts

### 13.1. Generate alert

1. user thêm sản phẩm vào wishlist
2. `WishlistService.AddToWishlist`
3. capture baseline price/stock từ `product-service`

### 13.2. Dispatch alert

1. `notification-service` chạy `WishlistAlertWorker`
2. worker gọi `user-service` `/api/v1/admin/wishlist-alerts`
3. `WishlistService.ListDispatchableAlerts`
4. service loop từng user có wishlist
5. `ListAlerts`:
   - load preference
   - load wishlist items
   - load product snapshots
   - compare baseline/current
6. notification worker dedupe theo alert key
7. gửi email

### 13.3. Ý nghĩa thiết kế

- baseline được chụp tại thời điểm user quan tâm sản phẩm
- detection logic nằm ở `user-service`, delivery logic nằm ở `notification-service`
- separation này đúng boundary nhưng hiện dispatch path còn tốn nhiều read

### 13.4. Walkthrough Worker Semantics

Khi mở `internal/service/wishlist_alert_worker.go`, hãy đọc worker này tách biệt hẳn khỏi queue consumer:

1. `Start`
   - nếu thiếu source hoặc sender thì worker không chạy
   - chạy `runCycle` ngay một lần trước khi vào ticker loop
2. `runCycle`
   - poll `user-service` với timeout 30 giây
   - lấy batch dispatchable alerts
   - loop từng delivery
3. `deliver`
   - dedupe theo alert key
   - validate email
   - build subject/body bằng `wishlistAlertEmail`
   - gửi email

Điểm đáng học ở đây là repo không cố ép mọi async flow đi qua RabbitMQ. Với wishlist alerts, polling worker là đủ thực dụng vì detection logic đang nằm ở `user-service` và dữ liệu cần so sánh cũng ở đó.

---

## 14. Đánh Giá Code Quality Theo Service

## 14.1. cart-service

### Điểm mạnh
- handler mỏng, service rõ
- refresh product truth ở write path chính
- Redis hợp lý cho cart UX

### Vấn đề cần cải thiện
- `UpdateItem` không re-check stock/price
- N remote calls trong merge
- lost update risk khi concurrent write

## 14.2. notification-service

### Điểm mạnh
- dedupe + retry + DLQ + history khá đầy đủ
- worker loop có lifecycle rõ

### Vấn đề cần cải thiện
- Redis failure làm reliability giảm mạnh
- preference lookup sync trên consume path
- inbox API còn mỏng

## 14.3. order-service

### Điểm mạnh
- create order có idempotency + outbox thật
- return/refund flow có queue health và worker
- coupon/persistence invariant khá rõ

### Vấn đề cần cải thiện
- stock reserve trước DB commit
- admin offset path còn tồn tại
- service rất lớn

## 14.4. payment-service

### Điểm mạnh
- charge/refund idempotent
- webhook replay-safe
- enriched read model tốt

### Vấn đề cần cải thiện
- provider-specific logic đang tập trung vào MoMo
- order lookup còn coupled qua auth header

## 14.5. product-service

### Điểm mạnh
- source of truth và optional integration tách khá rõ
- review service có tx/cache/observer tốt
- storefront batching tốt

### Vấn đề cần cải thiện
- review list vẫn offset-based
- stock mutation có pre-read dư
- synonym config hard-coded

## 14.6. user-service

### Điểm mạnh
- auth/profile/OTP/OAuth khá tách lớp
- profile tx manager có giá trị thực
- OTP flow có rate limit và constant-time compare

### Vấn đề cần cải thiện
- address default invariant chưa tx-safe ở mọi endpoint
- wishlist dispatch source còn N+1
- login protector là in-memory nên không chia sẻ state liên replica

---

## 15. Nếu Muốn Tiếp Tục Nâng Chất Backend Này

### Ưu tiên cao

1. Chuẩn hóa cursor-first cho admin order list và review list.
2. Hoàn thiện idempotency/replay-safe hơn cho toàn bộ payment webhook/provider path.
3. Làm transaction-safe default address cho mọi address endpoint.
4. Giảm N+1 ở wishlist alert dispatch path.
5. Thêm metric rõ cho degraded mode: search down, Redis inbox down, rate limiter fallback.

### Ưu tiên tiếp theo

1. Tách payment gateway adapter theo provider.
2. Bổ sung session/revoke/refresh-rotation cho auth.
3. Bổ sung replay/admin tool cho failed outbox hoặc DLQ notification.
4. Xem xét reservation pattern tốt hơn cho order/inventory nếu traffic tăng mạnh.

---

## 16. Audit-Level Hot Path: Invariant, Query Pattern, Lock Pattern, Retry Pattern

Phần này trả lời câu hỏi khó hơn: nếu production có bug dữ liệu, duplicate side effect, backlog queue hoặc query chậm, phải mở file nào trước và nhìn bằng lăng kính nào.

### 16.1. Cách đọc một hot path cho đúng

Với mỗi function ở tầng repository hoặc client quan trọng, đừng chỉ hỏi “nó query gì”.

Hãy hỏi đủ 6 câu:

1. Invariant nào đang được giữ ở đây, và vì sao invariant đó không nằm ở tầng khác?
2. Query này là read-only, compare-and-set, row-lock, hay lease-claim?
3. Nếu request hoặc worker bị retry, function này có replay-safe không?
4. Nếu process crash giữa chừng, state sẽ dừng ở đâu?
5. Nếu nhiều replica chạy cùng lúc, function này serialize bằng DB, Redis hay broker?
6. Khi dữ liệu lớn lên 10x hoặc 100x, bottleneck nằm ở `COUNT(*)`, `OFFSET`, JSONB, fan-out HTTP hay rewrite payload?

Backend trong repo này có 5 pattern lặp đi lặp lại:

1. Transaction bundle trong PostgreSQL.
2. SQL compare-and-set bằng `WHERE` condition.
3. Lease claim bằng `FOR UPDATE SKIP LOCKED`.
4. Cursor pagination với tie-breaker ổn định.
5. Retry-safe async bằng outbox/inbox hoặc Redis claim.

### 16.2. `order-service`: nơi reliability thực sự được quyết định

#### `createOrderTx` là transactional boundary thật

File: `services/order-service/internal/repository/order_repository.go`

Điểm mạnh lớn nhất của order write path không nằm ở handler, mà nằm ở việc repo gom:

- `orders`
- `order_items`
- `order_events`
- `outbox_events`
- `order_idempotency_keys`

vào cùng một transaction.

Điều này tạo ra ba tính chất quan trọng:

1. Không có order “nửa vời”.
2. Event publish không tách rời DB write.
3. Idempotency key chỉ tồn tại khi order thật đã được tạo.

Đây là boundary đáng tin nhất của flow create order. Nếu cần audit “vì sao client retry tạo ra duplicate order” hoặc “vì sao order có mà không thấy event”, mở function này trước.

#### `lockAndConsumeCoupon` là nơi coupon correctness sống hay chết

Coupon không được giữ đúng bằng logic service thuần. Nó được giữ bằng:

- `SELECT ... FOR UPDATE`
- validate trên row đã lock
- `used_count = used_count + 1`

Nói cách khác, tính đúng của coupon nằm ở DB serialization, không nằm ở việc service “kiểm tra trước”.

Nếu sau này cần tối ưu hoặc cache coupon, vẫn phải giữ nguyên ý tưởng này: cache có thể giúp read path, nhưng consume limit phải chốt bằng row lock hoặc unique claim table.

#### `ListAll` và `ListAllByCursor` cho thấy repo đang ở hai thế giới khác nhau

`ListAll` tốt cho backoffice vì:

- có page number
- dễ hiển thị tổng số bản ghi

Nhưng nó mang hai cost cố hữu:

- `COUNT(*)`
- scan sâu khi `OFFSET` lớn

`ListAllByCursor` bỏ được cả hai vấn đề đó trong đa số trường hợp, đổi lại UI phải chấp nhận “next page by cursor” thay vì “đi tới trang 37”.

Điểm quan trọng về mặt thiết kế:

- Repo đã encode đúng tie-breaker bằng `created_at` và `id`.
- Đây là một chi tiết nhỏ nhưng cực quan trọng. Nếu chỉ dùng `created_at`, pagination sẽ có duplicate hoặc skip record khi nhiều order cùng timestamp.

#### `ExpirePendingReservation` là compare-and-set chứ không phải cron update thường

Function này rất đáng học vì nó không cần read trước rồi mới write.

SQL của nó vừa là validation vừa là mutation:

- status phải là `pending`
- chưa `reservation_allocated_at`
- `reservation_expires_at <= NOW()`

Nếu bất kỳ điều kiện nào không còn đúng, `rowsAffected = 0` và flow trở thành no-op hợp lệ.

Đó là tinh thần nên ưu tiên trong production:

- condition được đẩy vào SQL
- mutation chỉ xảy ra khi state hiện tại đúng
- không dựa vào snapshot cũ mà service đã đọc trước đó

#### `ClaimPendingReturnRefunds` là lease queue trong Postgres

Refund worker là ví dụ rất điển hình của cách làm job queue “đủ production” mà không cần hệ thống scheduler riêng:

- row domain nằm ngay trong bảng `returns`
- `refund_next_retry_at` giữ retry schedule
- `refund_processing_started_at` giữ lease
- `refund_attempt_count` giữ tiến trình
- `FOR UPDATE SKIP LOCKED` giúp scale nhiều worker

Điểm tốt:

- visibility tốt vì state nằm ở domain table
- dễ debug vì có `last_error`, `attempt_count`, `next_retry_at`
- chết process vẫn có thể reclaim

Điểm cần cảnh giác:

- table domain vừa là business state vừa là queue state, nên index và query plan phải được chăm sóc kỹ khi số lượng return lớn dần

#### `ApplyInboxStatusTransition` là lớp chống event trễ, duplicate, out-of-order

Đây là function dễ bị bỏ qua nhất nhưng lại rất “production”.

Nó bảo vệ cùng lúc ba thứ:

1. Cùng một message không apply hai lần.
2. Event đến muộn không đạp đổ state mới hơn.
3. Order status transition luôn có order event tương ứng.

Nếu sau này có thêm nhiều consumer hoặc nhiều event type hơn, đây là pattern nên nhân rộng, không phải viết consumer “nghe queue rồi update thẳng”.

### 16.3. `payment-service`: idempotency và guarded transition làm phần việc nặng

#### `CreateWithIdempotency` cho thấy idempotency đúng là “DB contract”, không phải “HTTP trick”

Nhiều codebase gọi idempotency là:

- đọc header
- check Redis
- nếu chưa có thì xử lý

Ở repo này, điểm đúng hơn là:

- idempotency record được commit cùng payment và outbox
- failure giữa chừng sẽ rollback hết

Đó mới là lý do client retry an toàn ở layer business, không phải chỉ ở layer request.

#### `ApplyWebhookResult` dùng hai lớp bảo vệ thay vì chỉ một

Lớp 1:

- inbox table `(consumer, message_id)` chặn duplicate payload

Lớp 2:

- `UPDATE ... WHERE status = 'pending'` chặn duplicate state transition

Hai lớp này cần nhau vì:

- duplicate message chưa chắc luôn có cùng message id
- cùng payment có thể nhận event khác nhau nhưng không phải event nào cũng hợp lệ khi state đã chốt

Đây là một điểm rất đáng học:

- inbox xử lý replay ở mức message
- guarded update xử lý replay ở mức state machine

#### Outbox payment và outbox order cùng một triết lý

Điểm này đáng nói riêng vì nhiều người đọc repo sẽ nhìn thấy hai implementation gần giống nhau rồi bỏ qua.

Thực ra similarity này là điểm mạnh:

- cùng naming
- cùng lease pattern
- cùng `attempts`, `available_at`, `last_error`, `published_at`

Nó làm cho việc vận hành và debug nhất quán hơn. Khi cần thêm dashboard outbox lag hoặc replayer, team có thể làm một mental model chung thay vì học lại cho từng service.

### 16.4. `product-service`: correctness không chỉ nằm ở write path

#### Catalog cursor là nơi correctness của UX nằm

`product_repository.List` không chỉ là query lấy dữ liệu.

Nó đang quyết định:

- user có bị nhìn thấy duplicate item giữa hai trang không
- sort order có stable không
- filter và cursor có tương thích nhau không

Việc cursor chứa cả `sort` là một chi tiết rất tốt. Nó giúp repo fail fast thay vì im lặng trả trang sai khi caller dùng nhầm cursor của sort trước.

#### `UpdateStock` là compare-and-set inventory local

Đây là một ví dụ textbook về việc dùng SQL để giữ invariant:

- stock chỉ giảm khi vẫn còn đủ
- không cần `SELECT stock` trước
- không cần mutex trong Go

Nếu sau này phát hiện oversell, phải kiểm tra:

1. Có chỗ nào mutate stock mà không đi qua `UpdateStock` hay không.
2. Order flow có gọi `DecreaseStock`/`RestoreStock` cân đối hay không.
3. Inventory cross-service có bị lệch do failure window ngoài repo này hay không.

#### Review summary delta là tối ưu đúng kiểu production

`ApplyReviewSummaryDelta` là kiểu tối ưu nên khuyến khích:

- đúng bài toán
- đơn giản
- dễ kiểm chứng

Thay vì recount toàn bộ `product_reviews` mỗi lần có write, repo giữ aggregate table và update theo delta trong transaction.

Đây là tối ưu dựa trên invariant business rõ ràng, không phải cache cảm tính.

#### `SearchAssist` cho thấy graceful degradation đang được ưu tiên hơn “xịn hóa”

Repo tính suggestions/facets bằng PostgreSQL:

- count result
- group theo brand/category
- nổ variant JSON bằng `JOIN LATERAL`

Điều này không phải tối ưu nhất khi scale cực lớn, nhưng lại phù hợp với triết lý repo:

- PostgreSQL vẫn là source of truth
- không biến Elasticsearch thành dependency bắt buộc cho mọi read path

### 16.5. `user-service`: uniqueness, transaction nhỏ nhưng quan trọng, và bulk mutation

#### Uniqueness thật nằm ở constraint, không nằm ở “check trước”

`user_repository.Create` và `Update` map `23505` sang domain error rõ ràng.

Đây là cách làm đúng vì:

- concurrent signup không thể được giữ đúng chỉ bằng pre-check
- conflict thực sự chỉ DB mới biết chắc

Nếu sau này có bug “thỉnh thoảng đăng ký trùng email”, phải nhìn lại unique index hoặc đường write bypass repo này trước, không phải đi soi handler validation.

#### `ProfileTxManager.RunInTx` nhỏ nhưng có giá trị rất lớn

Transaction manager này cho phép service profile làm một việc rất quan trọng:

- mutate user
- update default address
- consume verified phone challenge

trong cùng transaction.

Không có pattern này, service rất dễ rơi vào trạng thái:

- user update thành công
- challenge bị consume fail
- default address lệch

Đây là ví dụ điển hình của “transaction helper nhỏ nhưng đáng giá”.

#### Address default invariant vẫn là vùng cần cảnh giác

Repo `addressrepo` đã có `ClearDefault`, nhưng bản thân function đó chưa đủ để đảm bảo invariant “mỗi user chỉ có đúng một default address”.

Invariant chỉ thật sự vững khi:

1. caller chạy `ClearDefault`
2. caller update/create address mới `is_default = true`
3. cả hai bước ở trong cùng transaction

Nếu sau này mở rộng address feature, đây là vùng phải giữ kỹ. Nó là một invariant business nhỏ nhưng phá UX rất khó chịu nếu lệch.

#### Bulk upsert ở preferences và wishlist là optimization đúng kiểu Go/Postgres

Thay vì loop từng row, repo dùng:

- `unnest(...)`
- `ON CONFLICT DO UPDATE`

Đây là tối ưu đáng giá vì:

- ít round-trip
- logic gọn
- replay-safe hơn
- vẫn bám chặt PostgreSQL

### 16.6. `notification-service` và `cart-service`: reliability không đồng nghĩa với transaction nặng

#### `notification-service` dùng Redis claim thay cho inbox table vì bài toán khác

`redis_store.Claim` không mạnh như transaction DB theo mọi nghĩa, nhưng nó phù hợp với luồng consume email/push:

- cần rẻ
- cần nhanh
- chấp nhận eventual consistency
- cần nhiều replica cùng consume

Điểm cần nhớ:

- claim/processed key là lease protocol
- không phải source of truth business
- Redis outage sẽ ảnh hưởng reliability path mạnh hơn Postgres outage ở order/payment inbox

#### `history_store` là read model, không phải log bất biến

Khi `MarkAllRead` rewrite payload JSON, repo đang ưu tiên:

- code đơn giản
- read API dễ dùng

hơn là một event-sourced unread/read log.

Điều này hợp lý cho inbox UI, miễn là team hiểu:

- đây không phải audit ledger bất biến
- chi phí rewrite tăng theo số notification user giữ lại

#### `cart-service` cố ý chấp nhận last-write-wins

Cart repo ghi cả blob JSON vào Redis.

Đây không phải thiếu sót ngẫu nhiên; nó là trade-off có chủ đích:

- cart không phải nguồn dữ liệu tài chính
- UX cần nhanh
- TTL auto-expire tiện hơn bảng SQL

Nhưng vì thế, nếu sau này product owner muốn collaborative cart, multi-device merge mạnh hơn hoặc optimistic concurrency, repo hiện tại sẽ không đủ. Lúc đó phải thêm version/CAS hoặc chuyển model lưu trữ, không thể chỉ vá ở handler.

### 16.7. Những điểm tôi xem là risk thật sau khi đi qua hot path

1. `order-service` vẫn còn `COUNT(*) + OFFSET/LIMIT` ở admin list và return list. Dữ liệu tăng sẽ đau thật, không chỉ đau về lý thuyết.
2. Invariant inventory vẫn là invariant xuyên service. Repo product giữ local stock tốt, nhưng order create vẫn phụ thuộc orchestration ngoài DB transaction local.
3. `address` default invariant chưa được khóa cứng ở mọi endpoint theo cách order/payment đang làm cho status transition.
4. Notification reliability hiện phụ thuộc Redis claim state. Nếu Redis degrade, consumer behavior sẽ xấu đi rõ hơn các flow dựa trên Postgres inbox.
5. `history_store.MarkAllRead` là O(n) theo số item user đang giữ, và dùng rewrite payload thay vì marking riêng.
6. `SearchAssist` và `variant facet` sẽ là vùng cần benchmark thật nếu catalog phình to vì JSONB/LATERAL không miễn phí.
7. `cart-service` whole-document write đơn giản nhưng sẽ là nguồn lost update nếu concurrent mutation tăng.

### 16.8. Hardening roadmap nếu muốn tiến gần audit-ready production hơn

1. Chuyển mọi admin list nóng sang cursor-first, giữ offset chỉ cho backoffice thật sự cần page number.
2. Thêm dashboard outbox lag và refund queue lag theo `attempts`, `available_at`, `processing_started_at`.
3. Thêm index review/return/order phù hợp với predicate cursor và claim query hiện có.
4. Chuẩn hóa transaction helper cho address/default semantics giống cách repo đã làm với profile và product review.
5. Thêm benchmark cho `SearchAssist`, `ListDispatchableWishlistAlerts`, `MarkAllRead`.
6. Làm rõ contract retry/idempotency cho mọi provider webhook mới theo pattern payment hiện tại.
7. Nếu traffic cart tăng mạnh, cân nhắc thêm version field hoặc CAS token cho Redis cart blob trước khi nghĩ tới hệ thống phức tạp hơn.
