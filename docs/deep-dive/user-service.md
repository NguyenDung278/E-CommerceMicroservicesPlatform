# User Service Deep Dive

## 1. Vai trò của service

`user-service` chịu trách nhiệm cho domain người dùng:

- đăng ký
- đăng nhập
- refresh token
- verify email
- quên / đặt lại mật khẩu
- profile
- địa chỉ giao hàng
- phone verification qua OTP
- OAuth Google
- quản trị user và role

Đây là service nên đọc rất sớm nếu bạn muốn hiểu repo, vì nó tập trung nhiều khái niệm nền tảng:

- validation ở boundary
- password hashing
- token lifecycle
- repository với PostgreSQL
- phân tách `handler -> service -> repository`

## 2. Route chính

### Public

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/auth/oauth/google/start`
- `GET /api/v1/auth/oauth/google/callback`
- `POST /api/v1/auth/oauth/exchange`

### Protected

- `GET /api/v1/users/profile`
- `PUT /api/v1/users/profile`
- `GET /api/v1/users/profile/phone-verification`
- `POST /api/v1/users/profile/phone-verification/send-otp`
- `POST /api/v1/users/profile/phone-verification/verify-otp`
- `POST /api/v1/users/profile/phone-verification/resend-otp`
- `PUT /api/v1/users/password`
- `POST /api/v1/users/verify-email/resend`

### Admin

- `GET /api/v1/admin/users`
- `PUT /api/v1/admin/users/:id/role`

## 3. Cấu trúc thư mục

```text
user-service/
  cmd/main.go
  internal/
    dto/
    grpc/
    handler/
    model/
    repository/
    service/
  migrations/
```

## 4. Luồng đăng ký

```text
HTTP request
  -> handler.Register
  -> validate DTO
  -> service.Register
  -> check duplicate email/phone
  -> bcrypt hash password
  -> repository.Create
  -> generate token pair
  -> response
```

### Điều học được

- password không bao giờ được lưu plaintext
- validation nằm ở boundary
- service là nơi giữ business rule, không phải handler

## 5. Luồng đăng nhập

Logic chính trong service:

1. chuẩn hóa identifier
2. nếu có `@`, coi là email
3. nếu không, normalize như phone
4. đọc user từ DB
5. so sánh password bằng bcrypt
6. phát token pair

### Vì sao flow này đáng học

- dùng một thông báo lỗi chung cho sai user/sai password để tránh enumeration
- handler chỉ lo bind/validate/response
- service giữ logic auth thực

## 6. Refresh token, verify email, reset password

Đây là nhóm tính năng làm auth flow của repo thực tế hơn nhiều.

### Refresh token

- client gửi `refresh_token`
- service verify refresh token
- cấp access/refresh mới

### Verify email

- sau đăng ký, backend sinh verification token
- DB chỉ lưu hash của token
- người dùng verify qua link chứa token gốc

### Forgot / reset password

- backend sinh token reset có thời hạn
- DB lưu hash token, không lưu raw token

### Bài học bảo mật quan trọng

Backend không lưu raw token đặc biệt trong DB. Đây là một thực hành rất đáng học vì nếu DB lộ, token gốc vẫn không bị tái sử dụng trực tiếp.

## 7. OAuth hiện tại là Google-only

Source code hiện tại chỉ normalize provider:

- `google`

`oauth_provider_client.go` chỉ xây:

- Google authorization URL
- Google token exchange
- Google userinfo fetch

### Luồng OAuth

1. frontend gọi `GET /auth/oauth/google/start`
2. backend tạo state đã ký và redirect sang Google
3. Google callback về `GET /auth/oauth/google/callback`
4. backend verify state/code
5. backend lấy profile Google và map về `OAuthIdentity`
6. nếu đã có account mapping thì login user cũ
7. nếu chưa có nhưng email trùng user có sẵn thì auto-link
8. nếu chưa có user thì tạo user mới
9. backend sinh `login_ticket` ngắn hạn
10. frontend gọi `POST /auth/oauth/exchange` để đổi ticket lấy token pair

### Vì sao thiết kế này tốt

- không đưa JWT thật lên URL
- không cần một OAuth service riêng
- account linking được giữ trong bảng riêng `user_oauth_accounts`

### Điều cần nhớ

Một số copy UI ở frontend vẫn còn nhắc “Google/Facebook”, nhưng implementation backend hiện là Google-only.

## 8. Quản lý địa chỉ giao hàng

User có thể có nhiều address.

Điểm đáng chú ý:

- giới hạn số địa chỉ mỗi user
- địa chỉ đầu tiên tự thành default
- đổi default dùng transaction để giữ invariant “chỉ một địa chỉ mặc định tại một thời điểm”

Đây là ví dụ rất tốt của business rule nhỏ nhưng cần làm đúng ở backend thay vì giao cho frontend.

## 9. Phone verification

`user-service` còn có luồng OTP cho xác minh số điện thoại.

Ý nghĩa thực tế:

- profile update có thể gắn với phone verification
- frontend `ProfilePage` dùng luồng này để verify phone trước khi lưu thay đổi

Điểm đáng học:

- phone verification là business capability riêng, không nên coi là “chỉ là validate regex ở client”

## 10. File quan trọng nên đọc

### `internal/handler/user_handler.go`

- bind request
- validate DTO
- map domain error sang HTTP status
- đăng ký route thật

### `internal/service/user_service.go`

- register
- login
- refresh token
- profile update
- token generation
- normalize identifier

### `internal/service/oauth_service.go`

- start OAuth
- callback handling
- login ticket exchange
- auto-link account

### `internal/service/oauth_provider_client.go`

- Google authorization URL
- Google token exchange
- Google userinfo fetch

### `internal/repository/user_repository.go`

- CRUD user
- find by email/phone/id
- persistence logic với PostgreSQL

## 11. Điều Golang nên học từ service này

- constructor pattern `NewUserService(...)`
- wrap lỗi bằng `%w`
- truyền `context.Context` từ handler xuống repository
- tách business rule khỏi HTTP layer
- tư duy bảo mật quanh password và token

## 12. Thứ tự đọc gợi ý

1. `cmd/main.go`
2. `internal/handler/user_handler.go`
3. `internal/dto/*`
4. `internal/service/user_service.go`
5. `internal/service/oauth_service.go`
6. `internal/service/oauth_provider_client.go`
7. `internal/repository/*`
8. `migrations/*.sql`

## 13. Bài học nghề nghiệp

`user-service` là nơi rất tốt để luyện:

- auth flow
- clean layering
- repository PostgreSQL
- bảo mật backend cơ bản nhưng quan trọng
- cách thêm capability mới mà vẫn giữ boundary rõ ràng
