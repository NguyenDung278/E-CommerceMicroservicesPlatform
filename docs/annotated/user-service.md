# Annotated: `services/user-service/internal/service/user_service.go`

Source gốc: `services/user-service/internal/service/user_service.go`

## 1. File này rất đáng học vì sao?

Nếu bạn đang học backend Go, đây là file cực tốt để hiểu:

- business logic layer là gì,
- đăng ký và đăng nhập nên được xử lý ra sao,
- cách hash password bằng bcrypt,
- cách sinh JWT,
- cách tách lỗi business khỏi HTTP layer.

Đây là một ví dụ rất thực tế của service layer "đủ sạch để học".

## 2. Vai trò của file

`user_service.go` không biết gì về HTTP request cụ thể, JSON body hay status code.

Việc của file này là:

- nhận input đã được bind/validate ở handler,
- thực hiện business logic,
- gọi repository để đọc/ghi DB,
- trả lỗi domain rõ ràng cho layer trên.

Đây chính là separation of concerns.

## 3. Annotate theo block dòng

### Dòng 3-17: import

Nhìn block import là đã học được nhiều thứ:

- `context`, `time`, `strings`, `errors` là nền của business logic Go,
- `jwt/v5` để sinh token,
- `uuid` để tạo ID,
- `bcrypt` để hash password,
- `middleware` được tái dùng để thống nhất kiểu claims,
- `dto`, `model`, `repository` là ba tầng quen thuộc của backend.

### Dòng 19-25: business errors

```go
var (
    ErrUserNotFound       = errors.New("user not found")
    ErrEmailAlreadyExists = errors.New("email already exists")
    ErrPhoneAlreadyExists = errors.New("phone already exists")
    ErrInvalidCredentials = errors.New("invalid email or password")
)
```

Đây là lỗi domain, không phải lỗi HTTP.

Điều nên học:

- service layer nên trả lỗi có ý nghĩa nghiệp vụ,
- handler mới là nơi map lỗi đó sang `404`, `409`, `401`...

Viết kiểu này giúp code test tốt và dễ `errors.Is(...)`.

### Dòng 27-34: struct `UserService`

```go
type UserService struct {
    repo      repository.UserRepository
    jwtSecret string
    jwtExpiry int
}
```

Nhìn struct này bạn hiểu ngay dependency của service:

- cần repository để làm việc với user,
- cần JWT secret để ký token,
- cần JWT expiry để quyết định thời hạn token.

Đây là dependency injection dạng đơn giản.

### Dòng 36-43: constructor

`NewUserService(...)` là constructor pattern quen thuộc trong Go.

Tại sao nên học cách này?

- dependency hiện ra rõ ràng,
- dễ mock trong test,
- tránh dùng global state.

### Dòng 45-58: đầu hàm `Register`

```go
req.Email = normalizeEmail(req.Email)
req.Phone = normalizePhone(req.Phone)
```

Đây là một chi tiết rất hay.

Service không dùng raw input ngay. Nó normalize trước khi xử lý.

Tại sao quan trọng?

- giảm duplicate giả do khác hoa/thường hoặc format phone,
- tạo quy tắc dữ liệu nhất quán trước khi lưu DB.

Đây là tư duy backend rất quan trọng: normalize input càng sớm càng tốt.

### Dòng 60-76: check duplicate

Flow:

1. Tìm user theo email.
2. Nếu tồn tại thì báo duplicate.
3. Nếu có phone thì tìm thêm theo phone.
4. Nếu phone đã có thì cũng báo duplicate.

Điều nên học:

- Trước khi ghi dữ liệu, service phải kiểm tra business invariant.
- "Email unique" và "phone unique" là các invariant của domain user.

### Dòng 78-83: hash password với bcrypt

```go
hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
```

Đây là một dòng rất đáng nhớ.

Tư duy bảo mật:

- backend không lưu password gốc,
- bcrypt tự kèm salt,
- cost 12 là một điểm cân bằng giữa an toàn và hiệu năng.

Điều nên học:

- password hashing không giống encryption,
- mục tiêu là lưu kết quả khó đảo ngược, không phải dữ liệu để giải mã lại.

### Dòng 85-96: tạo `model.User`

Đây là bước chuyển từ request DTO sang domain model.

Service gán:

- `ID`
- `Email`
- `Phone`
- `Password` đã hash
- `FirstName`, `LastName`
- `Role`
- `CreatedAt`, `UpdatedAt`

Điều nên học:

- layer service là nơi rất hợp để "assemble" domain object.
- thời điểm tạo record là lúc tốt để gắn metadata như ID và timestamp.

### Dòng 98-111: persist rồi sinh token

Service gọi `repo.Create(ctx, user)` trước, sau đó mới `generateToken(user)`.

Đây là thứ tự hợp lý:

- dữ liệu phải tồn tại thật rồi mới coi là user đăng nhập thành công,
- token phản ánh một user đã được persist.

Điều nên học:

- nhiều use case thực tế là "write first, then derive response".

### Dòng 114-154: hàm `Login`

Đây là flow auth kinh điển nhưng được viết khá đúng.

#### Dòng 121-124: normalize identifier

Service gom nhiều kiểu input login về một identifier chung.

Ý nghĩa:

- giảm phân nhánh lung tung ở handler,
- business logic tập trung trong service.

#### Dòng 126-132: chọn repo query theo loại identifier

```go
if strings.Contains(identifier, "@") {
    user, err = s.repo.GetByEmail(ctx, identifier)
} else {
    user, err = s.repo.GetByPhone(ctx, identifier)
}
```

Đây là một decision rule đơn giản nhưng rất thực tế.

Nó cho bạn thấy service đang kiểm soát logic đăng nhập bằng email hoặc phone.

#### Dòng 136-143: chống email enumeration

Nếu user không tồn tại hoặc password sai, service đều trả:

```go
ErrInvalidCredentials
```

Đây là security mindset tốt.

Nếu trả lỗi khác nhau, attacker có thể đoán email nào tồn tại trong hệ thống.

#### Dòng 140-142: compare hash

```go
bcrypt.CompareHashAndPassword(...)
```

Đây là bước xác thực password đúng chuẩn.

Điều nên học:

- không bao giờ tự hash password nhập vào rồi so string thủ công theo kiểu ngây thơ,
- hãy dùng API của thư viện phù hợp.

### Dòng 156-190: `GetProfile` và `UpdateProfile`

Đây là phần CRUD service tương đối đơn giản nhưng rất đáng học về layer hóa.

Pattern lặp lại:

1. gọi repo lấy record,
2. nếu không có thì trả lỗi domain,
3. cập nhật field cần sửa,
4. set `UpdatedAt`,
5. gọi repo update.

Đây là pattern cực phổ biến trong backend Go.

### Dòng 193-207: `generateToken`

Đây là đoạn nối giữa user domain và auth infrastructure.

Các ý chính:

- tạo `middleware.JWTClaims`,
- nhét `UserID`, `Email`, `Role`,
- set `ExpiresAt`, `IssuedAt`,
- tạo token với `HS256`,
- ký bằng `jwtSecret`.

Điều nên học:

- token được sinh trong service vì nó là một phần của auth business flow,
- claims dùng lại struct chung giúp middleware verify dễ dàng.

### Dòng 193-207: `generateTokenPair` (Mới nâng cấp)

Trong phiên bản mới, hệ thống chuyển sang dùng `generateTokenPair` thay vì sinh độc lập một token.

Các ý chính:

- Access Token: Ngắn hạn (ví dụ 15-30 phút), chứa toàn bộ Claims để frontend xài gọi API.
- Refresh Token: Dài hạn (ví dụ 7 ngày), được build bằng `uuid.NewString()` hặc một JWT khác chứa id, lưu kèm hoặc để verify riêng biệt.
- Flow này dạy bạn một nguyên tắc security quan trọng: "Token Rotation". Access token sinh ra rất dễ bị lộ (qua XSS), vì vậy phải cấp quyền ngắn hạn. Nếu token hết hạn, client dùng thẻ "Refresh Token" gọi `POST /auth/refresh` để đổi lấy thẻ mới.

### Dòng x-y (Chức năng mới): Thực thi Đổi mật khẩu (`ChangePassword`)

Flow `ChangePassword` sẽ yêu cầu client gửi `OldPassword` và `NewPassword`.

Tại sao phải bắt nhập password cũ?
- Nếu user quên logout máy công cộng, kẻ gian mở lại trình duyệt không thể đổi sang password của họ nếu không biết password cũ.
- Dòng code quan trọng: `bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.OldPassword))`. Nếu pass, mới cho hash và lưu `req.NewPassword`.

### Dòng x-y (Chức năng mới): Quản lý địa chỉ giao hàng (`AddressService`)

Dù không ở file `user_service.go`, logic địa chỉ nằm ngay cạnh.
Nó minh họa 2 pattern Back-end cực hay:
1. **Hard Limit**: Kiểm tra `repo.CountByUserID` <= 10 trước khi cho tạo mới. Giúp phòng thủ (Defense in Depth) chống lại việc CSDL bị spam.
2. **Auto Fallback Default**: Khi `repo.Count == 0`, tự động force `is_default = true`. Khi đổi default, hệ thống gọi `repo.ClearDefault(userID)` (xoá hết cờ true về false của user đó) rồi `repo.SetDefault(addressID)`. Cách làm này đảm bảo tính Consistency mà không cần lock nguyên cái bảng.

### Dòng 209-248: normalize helpers

Đây là block nhỏ nhưng là nơi thể hiện code chăm chút.

`normalizeIdentifier`:

- ưu tiên `req.Identifier`,
- nếu không có thì fallback `req.Email`.

`normalizeEmail`:

- trim space,
- lowercase.

`normalizePhone`:

- giữ số,
- cho phép `+` ở đầu,
- loại bỏ ký tự thừa.

Điều nên học:

- dữ liệu vào hệ thống luôn bẩn hơn bạn nghĩ,
- helper nhỏ để normalize input có giá trị rất lớn về lâu dài.

## 4. Những tư duy rất đáng học từ file này

- Service layer nên giữ business logic, không trộn HTTP.
- Lỗi domain nên rõ nghĩa và tái sử dụng được.
- Password phải được hash đúng cách.
- Authentication không chỉ là kiểm password mà còn là kiểm soát thông tin lỗi trả ra.
- Normalize input là bước nhỏ nhưng cực quan trọng.

## 5. Khái niệm nên nắm sau khi đọc file

- Service layer
- Repository pattern
- DTO vs model
- bcrypt
- JWT
- Business invariant
- Input normalization
- Error wrapping và error semantics

## 6. Câu hỏi tự kiểm tra

1. Vì sao service trả `ErrInvalidCredentials` chung cho nhiều trường hợp?
2. Vì sao password phải hash trước khi lưu?
3. Vì sao normalize email/phone trước khi query DB?
4. Vì sao token được sinh ở service thay vì handler?
5. `dto`, `model`, `repository` khác nhau ở vai trò nào?
