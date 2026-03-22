package service

import (
	"context"
	"errors"
	"strings"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/email"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
)

// Common business errors.
var (
	ErrUserNotFound       = errors.New("user not found")
	ErrEmailAlreadyExists = errors.New("email already exists")
	ErrPhoneAlreadyExists = errors.New("phone already exists")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrInvalidToken       = errors.New("invalid or expired token")
	ErrInvalidRole        = errors.New("invalid user role")
)

// UserService contains business logic for user operations.
// WHY THIS LAYER: Separating business logic from handlers and repositories
// makes the code testable and prevents mixing HTTP concerns with domain logic.
type UserService struct {
	repo            repository.UserRepository
	jwtSecret       string
	jwtExpiry       int // hours — for access tokens
	emailSender     email.Sender
	frontendBaseURL string
}

type UserServiceOption func(*UserService)

func WithEmailSender(sender email.Sender) UserServiceOption {
	return func(s *UserService) {
		s.emailSender = sender
	}
}

func WithFrontendBaseURL(baseURL string) UserServiceOption {
	return func(s *UserService) {
		s.frontendBaseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	}
}

// NewUserService creates a new user service.
func NewUserService(repo repository.UserRepository, jwtSecret string, jwtExpiry int, options ...UserServiceOption) *UserService {
	service := &UserService{
		repo:            repo,
		jwtSecret:       jwtSecret,
		jwtExpiry:       jwtExpiry,
		frontendBaseURL: "http://localhost:4173",
	}
	for _, option := range options {
		option(service)
	}

	return service
}

// Register creates a new user account.
//
// FLOW:
//  1. Check if email already exists (prevent duplicates)
//  2. Hash the password with bcrypt (cost=12 for security/performance balance)
//  3. Generate a UUID for the new user
//  4. Insert into database
//  5. Generate a JWT token pair for immediate login after registration
//
// SECURITY: bcrypt cost of 12 means ~250ms per hash on modern hardware,
// which is slow enough to resist brute force but fast enough for users.
func (s *UserService) Register(ctx context.Context, req dto.RegisterRequest) (*dto.AuthResponse, error) {
	req.Email = normalizeEmail(req.Email)
	req.Phone = normalizePhone(req.Phone)

	// Check for duplicate email.
	existing, err := s.repo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrEmailAlreadyExists
	}
	if req.Phone != "" {
		existingByPhone, err := s.repo.GetByPhone(ctx, req.Phone)
		if err != nil {
			return nil, err
		}
		if existingByPhone != nil {
			return nil, ErrPhoneAlreadyExists
		}
	}

	// Hash the password.
	// PITFALL: Never store plaintext passwords. bcrypt includes salt automatically.
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, err
	}

	now := time.Now()
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

	verificationToken, verificationTokenHash, verificationTokenExpiry, err := issueTimeBoundToken(48 * time.Hour)
	if err != nil {
		return nil, err
	}
	user.EmailVerificationTokenHash = verificationTokenHash
	user.EmailVerificationExpiresAt = &verificationTokenExpiry

	if err := s.repo.Create(ctx, user); err != nil {
		return nil, err
	}

	// Account creation should not fail just because the verification email provider
	// is temporarily unavailable. The user can request another verification email
	// later from their profile.
	_ = s.sendVerificationEmail(user, verificationToken)

	// Generate JWT token pair so the user is immediately logged in.
	accessToken, refreshToken, err := s.generateTokenPair(user)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token:        accessToken,
		RefreshToken: refreshToken,
		User:         user,
	}, nil
}

// Login authenticates a user and returns a JWT token pair.
//
// SECURITY NOTES:
//   - We use the same error message for "user not found" and "wrong password"
//     to prevent email enumeration attacks.
//   - bcrypt.CompareHashAndPassword is constant-time, preventing timing attacks.
func (s *UserService) Login(ctx context.Context, req dto.LoginRequest) (*dto.AuthResponse, error) {
	identifier := normalizeIdentifier(req)
	if identifier == "" {
		return nil, ErrInvalidCredentials
	}

	var user *model.User
	var err error
	if strings.Contains(identifier, "@") {
		user, err = s.repo.GetByEmail(ctx, identifier)
	} else {
		user, err = s.repo.GetByPhone(ctx, identifier)
	}
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrInvalidCredentials // Don't reveal that the email doesn't exist
	}

	// Compare the provided password with the stored hash.
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	accessToken, refreshToken, err := s.generateTokenPair(user)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token:        accessToken,
		RefreshToken: refreshToken,
		User:         user,
	}, nil
}

// GetProfile retrieves a user's profile by ID.
//
// Mục đích: Trích xuất thông tin người dùng từ Database dựa trên `userID`.
// Input: `userID` (chuỗi UUID được bóc tách từ JWT token).
// Output: Trả về pointer `*model.User` chứa toàn bộ thông tin tài khoản, hoặc lỗi `ErrUserNotFound` nếu record đã bị xóa.
func (s *UserService) GetProfile(ctx context.Context, userID string) (*model.User, error) {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}

// UpdateProfile updates a user's profile information.
func (s *UserService) UpdateProfile(ctx context.Context, userID string, req dto.UpdateProfileRequest) (*model.User, error) {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	if req.FirstName != "" {
		user.FirstName = req.FirstName
	}
	if req.LastName != "" {
		user.LastName = req.LastName
	}
	user.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

// ChangePassword validates the current password and updates to a new one.
//
// SECURITY:
//   - The old password must match before we allow any change.
//   - The new password is hashed with the same bcrypt cost as registration.
func (s *UserService) ChangePassword(ctx context.Context, userID string, req dto.ChangePasswordRequest) error {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if user == nil {
		return ErrUserNotFound
	}

	// Verify the current password.
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.CurrentPassword)); err != nil {
		return ErrInvalidCredentials
	}

	// Hash the new password.
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		return err
	}

	user.Password = string(hashedPassword)
	user.UpdatedAt = time.Now()

	return s.repo.Update(ctx, user)
}

// RefreshToken validates a refresh token and issues a new access + refresh pair.
//
// FLOW:
//  1. Parse the refresh token and validate its signature + expiry
//  2. Look up the user by the embedded UserID
//  3. Issue a fresh token pair
//
// WHY ROTATE: Issuing a new refresh token on each refresh limits the window
// of exposure if a refresh token is leaked (refresh token rotation).
func (s *UserService) RefreshToken(ctx context.Context, refreshTokenString string) (*dto.AuthResponse, error) {
	claims := &middleware.JWTClaims{}
	token, err := jwt.ParseWithClaims(refreshTokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	// Ensure the user still exists.
	user, err := s.repo.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	// Issue a fresh token pair.
	accessToken, newRefreshToken, err := s.generateTokenPair(user)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token:        accessToken,
		RefreshToken: newRefreshToken,
		User:         user,
	}, nil
}

// generateTokenPair creates both an access token (short-lived) and a refresh token (long-lived).
func (s *UserService) generateTokenPair(user *model.User) (accessToken string, refreshToken string, err error) {
	// Access token — short-lived (uses configured expiry, typically 1-24h).
	accessClaims := middleware.JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(s.jwtExpiry) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	at := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err = at.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", "", err
	}

	// Refresh token — long-lived (7 days).
	refreshClaims := middleware.JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	rt := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err = rt.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

func normalizeIdentifier(req dto.LoginRequest) string {
	if strings.TrimSpace(req.Identifier) != "" {
		identifier := strings.TrimSpace(req.Identifier)
		if strings.Contains(identifier, "@") {
			return normalizeEmail(identifier)
		}
		return normalizePhone(identifier)
	}

	return normalizeEmail(req.Email)
}

func normalizeEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizePhone(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	var builder strings.Builder
	for index, r := range trimmed {
		if r >= '0' && r <= '9' {
			builder.WriteRune(r)
			continue
		}
		if r == '+' && index == 0 {
			builder.WriteRune(r)
		}
	}

	normalized := builder.String()
	if strings.HasPrefix(normalized, "+") {
		return "+" + strings.ReplaceAll(normalized[1:], "+", "")
	}

	return strings.ReplaceAll(normalized, "+", "")
}
