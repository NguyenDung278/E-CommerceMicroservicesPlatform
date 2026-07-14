# 🧭 Golang REST API Mentor Guide: học qua e-commerce backend thật

Tài liệu này dùng chính project `e-commerce-platform` làm case study thực tế thay vì tạo thêm một mini project giả lập. Đây là backend Go chạy được bằng Docker Compose, có REST API, PostgreSQL, JWT, CRUD, middleware, error handling, service layer, repository layer và các integration production-oriented.

> Code đầy đủ chạy được nằm trong source hiện tại. Các đoạn code bên dưới là trích đoạn có thêm comment tiếng Việt để học; khi muốn chạy thật, dùng file gốc theo path được ghi ở từng phần.

---

## 🚀 PHẦN 1 — Project thực tế

### 1.1. Bài toán của project

Project này là nền tảng thương mại điện tử nhiều service:

- `api-gateway/`: public HTTP entrypoint tại `http://localhost:8080`.
- `services/user-service/`: đăng ký, đăng nhập, JWT, profile, address, wishlist.
- `services/product-service/`: CRUD sản phẩm, catalog, search assist, upload ảnh, review.
- `services/cart-service/`: cart trong Redis.
- `services/order-service/`: order, coupon, return, refund queue, outbox.
- `services/payment-service/`: payment, webhook, idempotency.
- `services/notification-service/`: RabbitMQ consumer, inbox, retry, email.

Trong bài học này, tập trung vào 2 flow dễ học nhất nhưng vẫn rất thực tế:

1. Auth/JWT: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`.
2. Product CRUD: `POST/GET/PUT/DELETE /api/v1/products`.

### 1.2. Cấu trúc backend production

```text
services/user-service/
├── cmd/main.go                         # Bootstrap runtime: config, DB, middleware, route, graceful shutdown
├── internal/handler/user/              # HTTP boundary: bind, validate, map lỗi sang HTTP
├── internal/service/account/           # Business logic: auth, password, token, profile invariant
├── internal/repository/userrepo/       # SQL persistence: insert/select/update user
├── internal/dto/                       # Request/response DTO
├── internal/model/                     # Domain/persistence model
└── migrations/                         # PostgreSQL schema

services/product-service/
├── cmd/main.go
├── internal/handler/product/           # REST CRUD handler
├── internal/service/                   # Product business logic
├── internal/repository/product/        # SQL query, cursor pagination, stock CAS
├── internal/dto/
├── internal/model/
└── migrations/
```

Điểm quan trọng: repo không phải monolith. `api-gateway` chỉ forward request, còn business rule nằm trong từng service.

### 1.3. Chạy project local

```bash
# Build và chạy toàn bộ stack: API Gateway, services, Postgres, Redis, RabbitMQ...
make compose-up

# Kiểm tra gateway sống
curl http://localhost:8080/health
```

Đăng ký user:

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "student@example.com",
    "password": "StrongPass123",
    "first_name": "Go",
    "last_name": "Learner"
  }'
```

Đăng nhập:

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "identifier": "student@example.com",
    "password": "StrongPass123"
  }'
```

Product CRUD cần token `admin` hoặc `staff`. Local có thể bật bootstrap dev accounts trong config; xem thêm `README.md` và `API_TESTING_GUIDE.md`.

---

## 🧱 PHẦN 2 — Giải thích chi tiết từng phần code

### 2.1. Runtime bootstrap: `services/user-service/cmd/main.go`

Mục tiêu của `main.go` là nối các dependency theo thứ tự: config → logger → database → repository → service → handler → middleware → route → server.

```go
func main() {
	// Đọc config theo service name. Config lấy từ YAML + env override.
	cfg, err := config.Load("user-service")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Tạo structured logger bằng zap để log có field rõ ràng.
	log := logger.New("user-service")
	defer log.Sync()

	// Mở PostgreSQL connection pool. sql.DB là pool, không phải một connection đơn.
	db, err := database.NewPostgresDB(cfg.Database)
	if err != nil {
		log.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// Chạy migration embed trong binary trước khi nhận traffic.
	if err := database.RunPostgresMigrations(db, migrations.Files); err != nil {
		log.Fatal("failed to run migrations", zap.Error(err))
	}

	// Repository giữ SQL. Service giữ business rule. Handler giữ HTTP boundary.
	userRepo := userrepo.New(db)
	userService := account.NewUserService(userRepo, cfg.JWT.Secret, cfg.JWT.Expiration)
	userHandler := userhandler.NewUserHandler(userService)

	// Echo là HTTP router/framework. Validator dùng chung cho DTO tag `validate`.
	e := echo.New()
	e.Validator = appvalidator.New()
	e.Use(echomw.Recover())       // Bắt panic để process không chết vì 1 request lỗi.
	e.Use(appmw.FrontendCORS())   // CORS policy cho frontend.
	e.Use(echomw.Secure())        // Thêm security headers cơ bản.

	// Đăng ký route auth/profile/admin users.
	userHandler.RegisterRoutes(e, cfg.JWT.Secret)
}
```

✅ **Mục đích:** khởi động process backend thật và wire dependency.

✅ **Lý do:** dependency được tạo từ ngoài vào trong giúp code dễ test. Repository không tự mở DB, handler không tự tạo service.

✅ **Cơ chế Go bên dưới:** `*sql.DB` là connection pool thread-safe; `defer db.Close()` chạy khi `main` thoát; interface và pointer được truyền theo reference semantics.

⚠️ **Lỗi phổ biến:**

- Mở DB trong từng request handler.
- Gọi migration sau khi server đã nhận traffic.
- Dùng `context.Background()` sâu trong repository thay vì context từ request.

❌ Tệ:

```go
func Register(c echo.Context) error {
	db, _ := sql.Open("postgres", dsn) // Mở DB trong request: tốn tài nguyên và khó kiểm soát pool.
	_ = db
	return nil
}
```

✅ Tốt:

```go
userRepo := userrepo.New(db)
userService := account.NewUserService(userRepo, secret, expiry)
userHandler := userhandler.NewUserHandler(userService)
```

---

### 2.2. Route + middleware: `services/user-service/internal/handler/user/handler.go`

```go
func (h *UserHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	// Nhóm public auth route: không cần JWT vì user chưa đăng nhập.
	auth := e.Group("/api/v1/auth")
	auth.POST("/register", h.Register)
	auth.POST("/login", h.Login)
	auth.POST("/refresh", h.RefreshToken)

	// Nhóm user route: phải có JWT hợp lệ.
	users := e.Group("/api/v1/users")
	users.Use(middleware.JWTAuth(jwtSecret))
	users.GET("/profile", h.GetProfile)
	users.PUT("/profile", h.UpdateProfile)
	users.PUT("/password", h.ChangePassword)

	// Nhóm admin route: cần JWT + role admin.
	adminUsers := e.Group("/api/v1/admin/users")
	adminUsers.Use(middleware.JWTAuth(jwtSecret))
	adminUsers.Use(middleware.RequireRole(middleware.RoleAdmin))
	adminUsers.GET("", h.ListUsers)
	adminUsers.PUT("/:id/role", h.UpdateUserRole)
}
```

✅ **Mục đích:** gom route theo quyền truy cập.

✅ **Lý do:** middleware đặt ở group giúp tránh quên auth từng route riêng lẻ.

✅ **Cơ chế Go/Echo:** `e.Group` tạo route group có middleware chain riêng. Request đi qua middleware theo thứ tự đăng ký rồi mới vào handler cuối.

⚠️ **Lỗi phổ biến:**

- Để route admin trong group public.
- Check role trong service bằng HTTP context, làm service phụ thuộc web framework.
- Quên dùng cùng `jwtSecret` giữa service phát token và service verify token.

❌ Tệ:

```go
e.PUT("/api/v1/admin/users/:id/role", h.UpdateUserRole) // Không có JWT, không có role guard.
```

✅ Tốt:

```go
adminUsers.Use(middleware.JWTAuth(jwtSecret))
adminUsers.Use(middleware.RequireRole(middleware.RoleAdmin))
```

---

### 2.3. DTO request/response: `services/user-service/internal/dto/user_dto.go`

```go
type RegisterRequest struct {
	// Tag `json` map field với request body.
	// Tag `validate` được validator đọc ở handler boundary.
	Email     string `json:"email" validate:"required,email"`
	Phone     string `json:"phone" validate:"omitempty,min=10,max=15"`
	Password  string `json:"password" validate:"required,min=8"`
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
}

type AuthResponse struct {
	// Access token dùng cho request authenticated.
	Token string `json:"token"`

	// Refresh token dùng để xin token pair mới.
	RefreshToken string `json:"refresh_token"`

	// User trả về client; password bị ẩn ở model bằng json:"-".
	User interface{} `json:"user"`
}
```

✅ **Mục đích:** định nghĩa contract JSON ở API boundary.

✅ **Lý do:** DTO tách request bên ngoài khỏi model nội bộ. Model có thể đổi persistence field mà không phá API.

✅ **Cơ chế Go bên dưới:** `encoding/json` dùng reflection đọc tag `json`. Validator cũng dùng reflection đọc tag `validate`.

⚠️ **Lỗi phổ biến:**

- Dùng thẳng database model làm request body cho mọi API.
- Không validate ở boundary rồi để lỗi chảy xuống repository.
- Trả `Password` hoặc token hash ra JSON.

❌ Tệ:

```go
type User struct {
	Email    string `json:"email"`
	Password string `json:"password"` // Dễ leak hash nếu response dùng model này.
}
```

✅ Tốt:

```go
Password string `json:"-"` // Không serialize field này ra response.
```

---

### 2.4. Handler đăng ký: `services/user-service/internal/handler/user/auth_handlers.go`

```go
func (h *UserHandler) Register(c echo.Context) error {
	var req dto.RegisterRequest

	// Bind JSON body vào struct. Handler là nơi duy nhất nên biết Echo context.
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}

	// Validate dữ liệu đầu vào trước khi gọi business logic.
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	// Truyền request context xuống service để DB call bị cancel khi client disconnect.
	result, err := h.userService.Register(c.Request().Context(), req)
	if err != nil {
		// Handler map domain error sang HTTP status. Service không biết HTTP.
		if errors.Is(err, account.ErrEmailAlreadyExists) {
			return response.Error(c, http.StatusConflict, "registration failed", "email already exists")
		}
		if errors.Is(err, account.ErrPhoneAlreadyExists) {
			return response.Error(c, http.StatusConflict, "registration failed", "phone already exists")
		}
		return response.Error(c, http.StatusInternalServerError, "registration failed", "internal server error")
	}

	return response.Success(c, http.StatusCreated, "user registered successfully", result)
}
```

✅ **Mục đích:** nhận HTTP request đăng ký, validate, gọi service, trả response chuẩn.

✅ **Lý do:** handler mỏng giúp business logic test được mà không cần HTTP server.

✅ **Cơ chế Go bên dưới:** method receiver `h *UserHandler` giữ dependency `userService`; `errors.Is` kiểm tra error chain, kể cả lỗi đã wrap bằng `%w`.

⚠️ **Lỗi phổ biến:**

- Viết bcrypt, SQL hoặc JWT trực tiếp trong handler.
- Trả raw database error ra client.
- Dùng `context.Background()` thay vì `c.Request().Context()`.

❌ Tệ:

```go
if err != nil {
	return c.JSON(500, map[string]string{"error": err.Error()}) // Có thể leak SQL/internal detail.
}
```

✅ Tốt:

```go
return response.Error(c, http.StatusInternalServerError, "registration failed", "internal server error")
```

---

### 2.5. Service đăng ký: `services/user-service/internal/service/account/user_auth.go`

```go
func (s *UserService) Register(ctx context.Context, req dto.RegisterRequest) (*dto.AuthResponse, error) {
	// Normalize trước khi query để tránh duplicate logic: " A@B.COM " và "a@b.com".
	req.Email = normalizeEmail(req.Email)
	req.Phone = normalizePhone(req.Phone)
	req.FirstName = normalizeHumanName(req.FirstName)
	req.LastName = normalizeHumanName(req.LastName)

	// Check duplicate bằng read path rõ ràng để trả domain error dễ hiểu.
	existing, err := s.repo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrEmailAlreadyExists
	}

	// Phone là optional, chỉ validate/check unique khi user gửi phone.
	if req.Phone != "" {
		if !isValidVNPhone(req.Phone) {
			return nil, ErrInvalidPhoneNumber
		}
		existingByPhone, err := s.repo.GetByPhone(ctx, req.Phone)
		if err != nil {
			return nil, err
		}
		if existingByPhone != nil {
			return nil, ErrPhoneAlreadyExists
		}
	}

	// Hash password bằng bcrypt. Không bao giờ lưu plain text password.
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, err
	}

	now := currentTime()
	user := &model.User{
		ID:            uuid.New().String(),
		Email:         req.Email,
		Phone:         req.Phone,
		Password:      string(hashedPassword),
		FirstName:     req.FirstName,
		LastName:      req.LastName,
		Role:          middleware.RoleUser,
		EmailVerified: false,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	// Repository chịu trách nhiệm insert vào PostgreSQL.
	if err := s.repo.Create(ctx, user); err != nil {
		return nil, mapUserRepositoryError(err)
	}

	// Sau khi user tồn tại, phát access token + refresh token.
	return s.buildAuthResponse(ctx, user)
}
```

✅ **Mục đích:** giữ business rule đăng ký user.

✅ **Lý do:** normalize, uniqueness, password hashing và role default là rule nghiệp vụ, không thuộc handler hoặc repository.

✅ **Cơ chế Go bên dưới:** `bcrypt.GenerateFromPassword` intentionally slow để chống brute force; struct literal tạo object rõ field; pointer `*model.User` tránh copy object lớn.

⚠️ **Lỗi phổ biến:**

- Check duplicate rồi insert nhưng không có unique index ở DB. Repo này có unique constraint để chặn race condition.
- Dùng SHA256 plain cho password. Password phải dùng bcrypt/argon2/scrypt.
- Đặt role từ request public, khiến user tự tạo admin.

❌ Tệ:

```go
user.Role = req.Role // Public register không được tin role từ client.
```

✅ Tốt:

```go
Role: middleware.RoleUser // Server quyết định role mặc định.
```

---

### 2.6. Repository user: `services/user-service/internal/repository/userrepo/user_repository.go`

```go
func (r *Repository) Create(ctx context.Context, user *model.User) error {
	query := `
		INSERT INTO users (
			id, email, phone, phone_verified, password, first_name, last_name, role,
			email_verified, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	// ExecContext nhận ctx để query có thể bị timeout/cancel.
	// $1..$n là bind parameters, không nối input user vào SQL string.
	_, err := r.executor.ExecContext(ctx, query,
		user.ID,
		toNullableString(user.Email),
		toNullableString(user.Phone),
		user.PhoneVerified,
		user.Password,
		user.FirstName,
		user.LastName,
		user.Role,
		user.EmailVerified,
		user.CreatedAt,
		user.UpdatedAt,
	)
	if err != nil {
		// Map unique violation thành repository error rõ nghĩa.
		if isUniqueViolation(err, "email") {
			return ErrUserEmailAlreadyExists
		}
		if isUniqueViolation(err, "phone") {
			return ErrUserPhoneAlreadyExists
		}
		return fmt.Errorf("failed to create user: %w", err)
	}
	return nil
}
```

✅ **Mục đích:** insert user vào PostgreSQL.

✅ **Lý do:** repository chỉ biết persistence. Nó không trả HTTP status và không phát JWT.

✅ **Cơ chế Go/Postgres:** `database/sql` gửi query và arguments riêng; driver bind parameters giúp chống SQL injection; `%w` giữ error chain cho `errors.Is/As`.

⚠️ **Lỗi phổ biến:**

- Nối chuỗi SQL với input user.
- Không wrap error, làm mất ngữ cảnh debug.
- Không check unique violation từ DB, dẫn tới race khi 2 request đăng ký cùng email.

❌ Tệ:

```go
query := "INSERT INTO users(email) VALUES('" + email + "')" // SQL injection.
```

✅ Tốt:

```go
_, err := db.ExecContext(ctx, "INSERT INTO users(email) VALUES($1)", email)
```

---

### 2.7. JWT token: `services/user-service/internal/service/account/user_tokens.go`

```go
func (s *UserService) generateTokenPair(user *model.User) (string, string, error) {
	now := currentTime()

	// Claims là payload được ký trong JWT.
	accessClaims := middleware.JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(s.jwtExpiry) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	// HS256 ký token bằng shared secret.
	at := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err := at.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", "", err
	}

	refreshClaims := middleware.JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	rt := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err := rt.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}
```

✅ **Mục đích:** cấp access token ngắn hạn và refresh token dài hơn.

✅ **Lý do:** access token ngắn hạn giảm rủi ro khi token lộ; refresh token giúp UX không phải login liên tục.

✅ **Cơ chế JWT:** token gồm header, payload, signature. Server verify signature bằng secret; payload chỉ được encode base64url, không được coi là bí mật.

⚠️ **Lỗi phổ biến:**

- Đưa password, token hash, secret vào claims.
- Không set `ExpiresAt`.
- Không kiểm tra signing method khi parse token.

❌ Tệ:

```go
claims := jwt.MapClaims{"password": user.Password} // Tuyệt đối không đưa hash/password vào JWT.
```

✅ Tốt:

```go
claims := middleware.JWTClaims{UserID: user.ID, Email: user.Email, Role: user.Role}
```

---

### 2.8. JWT middleware: `pkg/middleware/auth.go`

```go
func JWTAuth(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Lấy Authorization header dạng "Bearer <token>".
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing authorization header"})
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid authorization header format"})
			}

			claims := &JWTClaims{}
			token, err := jwt.ParseWithClaims(parts[1], claims, func(token *jwt.Token) (interface{}, error) {
				// Chặn algorithm confusion attack.
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, echo.NewHTTPError(http.StatusUnauthorized, "unexpected signing method")
				}
				return []byte(secret), nil
			})
			if err != nil || !token.Valid {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid or expired token"})
			}

			// Gắn claims vào Echo context cho handler phía sau.
			c.Set("user", claims)
			return next(c)
		}
	}
}
```

✅ **Mục đích:** xác thực request trước khi vào protected handler.

✅ **Lý do:** middleware giúp auth nhất quán giữa nhiều route/service.

✅ **Cơ chế Echo:** middleware là function bọc `next`. Nếu middleware trả lỗi sớm, handler phía sau không chạy.

⚠️ **Lỗi phổ biến:**

- Chỉ decode token mà không verify signature.
- Không check token expired.
- Lấy `user_id` từ body thay vì JWT claims cho route authenticated.

---

### 2.9. Response envelope: `pkg/response/response.go`

```go
type Response struct {
	Success bool        `json:"success"`          // Client biết request thành công hay không.
	Message string      `json:"message"`          // Message ngắn, an toàn cho client.
	Data    interface{} `json:"data,omitempty"`   // Payload thành công.
	Error   string      `json:"error,omitempty"`  // Error detail an toàn.
	Meta    *Meta       `json:"meta,omitempty"`   // Pagination metadata.
}

func Success(c echo.Context, statusCode int, message string, data interface{}) error {
	return c.JSON(statusCode, Response{
		Success: true,
		Message: message,
		Data:    data,
	})
}

func Error(c echo.Context, statusCode int, message string, err string) error {
	return c.JSON(statusCode, Response{
		Success: false,
		Message: message,
		Error:   err,
	})
}
```

✅ **Mục đích:** chuẩn hóa JSON response toàn backend.

✅ **Lý do:** frontend không phải đoán mỗi service trả response theo shape khác nhau.

✅ **Cơ chế Go:** `omitempty` bỏ field rỗng khỏi JSON; `interface{}` cho phép response dùng nhiều kiểu data.

⚠️ **Lỗi phổ biến:**

- Mỗi handler tự build JSON khác nhau.
- Error response chứa raw SQL hoặc stack trace.
- Dùng HTTP 200 cho mọi lỗi.

---

### 2.10. Product CRUD route: `services/product-service/internal/handler/product/product_handler.go`

```go
func (h *ProductHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	// Public catalog: ai cũng xem được.
	public := e.Group("/api/v1/products")
	public.GET("", h.List)
	public.GET("/:id", h.GetByID)

	// Admin/staff CRUD: cần JWT và role phù hợp.
	admin := e.Group("/api/v1/products")
	admin.Use(middleware.JWTAuth(jwtSecret))
	admin.Use(middleware.RequireRole(middleware.RoleAdmin, middleware.RoleStaff))
	admin.POST("", h.Create)
	admin.PUT("/:id", h.Update)
	admin.DELETE("/:id", h.Delete)
}
```

✅ **Mục đích:** expose CRUD REST API cho sản phẩm.

✅ **Lý do:** đọc catalog là public, mutate catalog là privileged operation.

✅ **Cơ chế HTTP:** `GET` đọc, `POST` tạo, `PUT` cập nhật, `DELETE` xóa. Status code phản ánh kết quả (`201`, `200`, `404`, `400`, `500`).

⚠️ **Lỗi phổ biến:**

- Cho public gọi `POST /products`.
- Dùng `POST /deleteProduct`.
- Không kiểm tra role staff/admin.

---

### 2.11. Product create handler

```go
func (h *ProductHandler) Create(c echo.Context) error {
	var req dto.CreateProductRequest

	// Parse JSON body thành DTO.
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}

	// Validate boundary: thiếu name, price sai, stock sai... dừng tại đây.
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	// Gọi service để normalize + lưu DB + sync search best-effort.
	product, err := h.productService.Create(c.Request().Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidStatus) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "status must be draft, active or inactive")
		}
		return response.Error(c, http.StatusInternalServerError, "creation failed", "internal server error")
	}

	return response.Success(c, http.StatusCreated, "product created", product)
}
```

✅ **Mục đích:** tạo sản phẩm mới qua REST API.

✅ **Lý do:** handler không tự normalize tag/variant/search index; đó là service responsibility.

✅ **Cơ chế Go:** `errors.Is` giúp handler không phụ thuộc type error cụ thể; context từ HTTP truyền xuống DB.

⚠️ **Lỗi phổ biến:**

- Validate giá tiền ở repository.
- Handler gọi Elasticsearch trực tiếp.
- Trả `201 Created` nhưng không thật sự insert DB thành công.

---

### 2.12. Product service CRUD: `services/product-service/internal/service/product_crud.go`

```go
func (s *ProductService) Create(ctx context.Context, req dto.CreateProductRequest) (*model.Product, error) {
	// Convert DTO thành domain aggregate đã normalize.
	product, err := newProductFromCreateRequest(req)
	if err != nil {
		return nil, err
	}

	// PostgreSQL là source of truth.
	if err := s.repo.Create(ctx, product); err != nil {
		return nil, err
	}

	// Search backend là integration phụ, lỗi không làm fail create.
	s.indexProductBestEffort(ctx, product, "failed to index product in search backend")
	return product, nil
}

func (s *ProductService) Update(ctx context.Context, id string, req dto.UpdateProductRequest) (*model.Product, error) {
	// Load trước để patch không làm mất field cũ.
	product, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Apply partial update vào aggregate hiện có.
	if err := applyProductUpdate(product, req); err != nil {
		return nil, err
	}
	product.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, product); err != nil {
		return nil, err
	}

	s.indexProductBestEffort(ctx, product, "failed to update product in search backend")
	return product, nil
}

func (s *ProductService) Delete(ctx context.Context, id string) error {
	// Load để phân biệt not found với delete success.
	product, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}

	// Xóa search index best-effort vì Postgres vẫn là nguồn thật.
	s.deleteProductIndexBestEffort(ctx, product.ID)
	return nil
}
```

✅ **Mục đích:** giữ rule nghiệp vụ quanh CRUD sản phẩm.

✅ **Lý do:** service là nơi biết integration nào critical và integration nào best-effort.

✅ **Cơ chế Go:** function nhận interface repository nên test service bằng fake repo được; pointer aggregate được mutate có kiểm soát.

⚠️ **Lỗi phổ biến:**

- Ghi DB thành công nhưng bắt lỗi search index rồi trả 500, khiến client tưởng product chưa được tạo.
- Update bằng request struct rỗng rồi overwrite field cũ thành zero value.
- Delete không check existence, làm API trả success cho id không tồn tại.

---

### 2.13. Product repository SQL: `services/product-service/internal/repository/product/product_repository.go`

```go
func (r *postgresProductRepository) Create(ctx context.Context, product *model.Product) error {
	query := `
		INSERT INTO products (
			id, name, description, price, stock, category, brand,
			tags, status, sku, variants, image_url, image_urls, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb, $12, $13::jsonb, $14, $15)
	`

	// JSONB field được marshal trước khi bind vào PostgreSQL.
	_, err := r.db.ExecContext(ctx, query,
		product.ID,
		product.Name,
		product.Description,
		product.Price,
		product.Stock,
		product.Category,
		product.Brand,
		mustJSON(product.Tags),
		product.Status,
		product.SKU,
		mustJSON(product.Variants),
		product.ImageURL,
		mustJSON(product.ImageURLs),
		product.CreatedAt,
		product.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create product: %w", err)
	}
	return nil
}
```

✅ **Mục đích:** lưu product aggregate vào PostgreSQL.

✅ **Lý do:** raw SQL rõ query, dễ review index, dễ chạy `EXPLAIN ANALYZE`.

✅ **Cơ chế PostgreSQL:** `$1..$15` là prepared/bind parameters; `::jsonb` ép kiểu chuỗi JSON thành JSONB.

⚠️ **Lỗi phổ biến:**

- `SELECT *` rồi scan lệch thứ tự cột.
- Không defer `rows.Close()` ở query trả nhiều row.
- Marshal JSON lỗi nhưng nuốt lỗi không kiểm soát. Repo hiện dùng `mustJSON` cho field đã được normalize; với input phức tạp hơn nên trả lỗi rõ.

---

### 2.14. Cursor pagination: product list

```go
func (r *postgresProductRepository) List(ctx context.Context, params ListProductsParams) ([]*model.Product, string, bool, error) {
	baseQuery := `FROM products WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	// Chỉ thêm filter khi client gửi query param tương ứng.
	if params.Category != "" {
		baseQuery += fmt.Sprintf(` AND category = $%d`, argIdx)
		args = append(args, params.Category)
		argIdx++
	}

	// Cursor giữ vị trí trang trước. Không dùng OFFSET cho hot path catalog.
	cursor, err := decodeProductListCursor(params.Cursor)
	if err != nil {
		return nil, "", false, err
	}
	if cursor != nil {
		baseQuery, args, argIdx = appendCursorClause(baseQuery, args, argIdx, normalizeListSort(params.Sort), cursor)
	}

	selectQuery := fmt.Sprintf(`
		SELECT id, name, description, price, stock, category, brand, tags, status, sku,
		       variants, image_url, image_urls, created_at, updated_at, merchandising_rank
		%s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d
	`, baseQuery, argIdx)
	args = append(args, params.Limit+1)

	rows, err := r.db.QueryContext(ctx, selectQuery, args...)
	if err != nil {
		return nil, "", false, fmt.Errorf("failed to list products: %w", err)
	}
	defer rows.Close()

	// Đọc limit+1 để biết còn trang tiếp theo hay không.
	var products []*model.Product
	for rows.Next() {
		product, err := r.scanProductRows(rows)
		if err != nil {
			return nil, "", false, fmt.Errorf("failed to scan product: %w", err)
		}
		products = append(products, product)
	}

	hasNext := len(products) > params.Limit
	if !hasNext {
		return products, "", false, nil
	}
	products = products[:params.Limit]
	nextCursor, err := encodeProductListCursor(products[len(products)-1], normalizeListSort(params.Sort))
	return products, nextCursor, true, err
}
```

✅ **Mục đích:** list sản phẩm có filter và phân trang cursor.

✅ **Lý do:** catalog là hot path; cursor tránh scan sâu như `OFFSET 100000`.

✅ **Cơ chế Go/Postgres:** dynamic SQL vẫn an toàn vì chỉ format placeholder `$n`, còn value nằm trong `args`. Tie-breaker `id` giúp order ổn định khi `created_at` trùng.

⚠️ **Lỗi phổ biến:**

- Nối trực tiếp `params.Search` vào SQL.
- Dùng `OFFSET/LIMIT` cho bảng tăng nhanh.
- Cursor không chứa sort nên client đổi sort giữa các trang làm dữ liệu sai.

---

### 2.15. Migration PostgreSQL

`services/user-service/migrations/000001_create_users.up.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
    id         VARCHAR(36) PRIMARY KEY,
    email      VARCHAR(255) UNIQUE NOT NULL,
    phone      VARCHAR(20),
    password   VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name  VARCHAR(100) NOT NULL,
    role       VARCHAR(20)  NOT NULL DEFAULT 'user',
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Unique partial index: cho phép phone NULL, nhưng phone có giá trị thì không được trùng.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
ON users(phone)
WHERE phone IS NOT NULL;
```

✅ **Mục đích:** định nghĩa schema nguồn thật cho user.

✅ **Lý do:** unique constraint ở DB mới thật sự chặn race condition, không chỉ check ở application.

✅ **Cơ chế Postgres:** partial unique index chỉ áp dụng cho row thỏa `WHERE phone IS NOT NULL`.

⚠️ **Lỗi phổ biến:**

- Chỉ validate unique bằng code, không có unique index.
- Lưu password plain text.
- Thiếu index cho field dùng lookup như email/phone.

---

## 🧪 Bài tập thực hành trên repo

### Bài 1: đọc flow đăng ký end-to-end

Đọc theo thứ tự:

1. `api-gateway/internal/handler/user_handler.go`
2. `services/user-service/internal/handler/user/handler.go`
3. `services/user-service/internal/handler/user/auth_handlers.go`
4. `services/user-service/internal/service/account/user_auth.go`
5. `services/user-service/internal/repository/userrepo/user_repository.go`
6. `services/user-service/migrations/000001_create_users.up.sql`

Mục tiêu: tự vẽ được flow `HTTP → Gateway → Handler → Service → Repository → PostgreSQL → JWT response`.

### Bài 2: thêm field nhỏ cho product

Ví dụ thêm `material` cho product:

1. Thêm migration column + index nếu cần filter.
2. Thêm field vào model.
3. Thêm field vào DTO.
4. Update `Create`, `Update`, `scanProductRow`.
5. Thêm test handler/service/repository tương ứng.
6. Cập nhật docs nếu public API đổi.

### Bài 3: review lỗi bảo mật

Tìm và trả lời:

- Password có bao giờ được trả ra JSON không?
- JWT secret lấy từ đâu?
- Route nào cần admin/staff?
- Error nào đang leak chi tiết nội bộ?
- Query nào nhận input user và có parameterized chưa?

---

## 🧠 PHẦN 3 — Roadmap nâng cao

### 3.1. Concepts Golang nên học theo thứ tự

1. `context.Context`: cancellation, timeout, request scope.
2. Error handling: `%w`, `errors.Is`, `errors.As`, sentinel error, typed error.
3. Interface đúng chỗ: đặt interface ở consumer, fake trong test.
4. `database/sql`: pool, transaction, `QueryContext`, scan null value.
5. Concurrency: goroutine lifecycle, channel, worker, backpressure.
6. Testing: table-driven test, httptest, fake repo, integration test.
7. Generics: chỉ dùng khi giảm duplication thật, không ép vào domain code.
8. Profiling: benchmark, pprof, allocation, latency.
9. Observability: structured log, metrics, tracing.
10. Reliability patterns: idempotency, outbox/inbox, retry, lease claim.

### 3.2. Thư viện/framework quan trọng trong ecosystem Go backend

- Router/framework: `net/http`, Echo, Chi, Gin.
- Database: `database/sql`, `pgx`, `sqlc`, `goose`, `golang-migrate`.
- Auth: `github.com/golang-jwt/jwt/v5`, OAuth2 package.
- Validation: `go-playground/validator`.
- Logging: `zap`, `zerolog`, `slog`.
- Observability: OpenTelemetry, Prometheus client.
- Messaging: RabbitMQ client, Kafka client.
- Testing: `testing`, `httptest`, `testcontainers-go`, `gomock`, `mockery`.

### 3.3. Design patterns backend Go cần nắm

- Layered architecture: handler → service → repository.
- Dependency injection bằng constructor, không cần framework DI nặng.
- Repository pattern cho SQL boundary.
- Unit of Work / transaction manager cho nhiều write cùng invariant.
- Adapter pattern cho external service: payment, storage, search, email.
- Middleware chain cho auth/logging/rate limit/tracing.
- Outbox/inbox cho event delivery retry-safe.
- Idempotency key cho POST/payment/order/webhook.
- Compare-and-set SQL cho stock/payment/order transition.
- Cursor pagination cho hot list endpoint.

### 3.4. Lộ trình học 8 tuần

**Tuần 1:** đọc `cmd/main.go`, route, middleware, response envelope.

**Tuần 2:** học DTO, validation, handler test bằng `httptest`.

**Tuần 3:** học service layer, domain error, bcrypt, JWT.

**Tuần 4:** học repository SQL, migration, index, transaction.

**Tuần 5:** học product catalog, cursor pagination, batch lookup.

**Tuần 6:** học cart/order flow, idempotency, compare-and-set stock.

**Tuần 7:** học outbox/inbox, RabbitMQ consumer, retry, lease claim.

**Tuần 8:** học observability, benchmark, pprof, hardening checklist.

---

## ✅ Checklist tự review khi viết REST API Go

- Handler chỉ bind/validate/map error, không viết SQL.
- Service giữ business invariant, không nhận `echo.Context`.
- Repository dùng parameterized query, wrap error bằng `%w`.
- PostgreSQL có constraint/index cho rule quan trọng.
- Password hash bằng bcrypt/argon2/scrypt, không log secret/token.
- JWT middleware verify signature, expiry và signing method.
- Public/admin route tách rõ middleware.
- Response không leak raw SQL/internal detail.
- Context từ request truyền xuống mọi I/O.
- Test bao phủ success path, validation error, domain error và persistence edge case.
