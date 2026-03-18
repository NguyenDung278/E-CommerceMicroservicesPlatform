package service

import (
	"context"
	"errors"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
)

// Common business errors.
var (
	ErrUserNotFound       = errors.New("user not found")
	ErrEmailAlreadyExists = errors.New("email already exists")
	ErrInvalidCredentials = errors.New("invalid email or password")
)

// UserService contains business logic for user operations.
// WHY THIS LAYER: Separating business logic from handlers and repositories
// makes the code testable and prevents mixing HTTP concerns with domain logic.
type UserService struct {
	repo      repository.UserRepository
	jwtSecret string
	jwtExpiry int // hours
}

// NewUserService creates a new user service.
func NewUserService(repo repository.UserRepository, jwtSecret string, jwtExpiry int) *UserService {
	return &UserService{
		repo:      repo,
		jwtSecret: jwtSecret,
		jwtExpiry: jwtExpiry,
	}
}

// Register creates a new user account.
//
// FLOW:
//  1. Check if email already exists (prevent duplicates)
//  2. Hash the password with bcrypt (cost=12 for security/performance balance)
//  3. Generate a UUID for the new user
//  4. Insert into database
//  5. Generate a JWT token for immediate login after registration
//
// SECURITY: bcrypt cost of 12 means ~250ms per hash on modern hardware,
// which is slow enough to resist brute force but fast enough for users.
func (s *UserService) Register(ctx context.Context, req dto.RegisterRequest) (*dto.AuthResponse, error) {
	// Check for duplicate email.
	existing, err := s.repo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrEmailAlreadyExists
	}

	// Hash the password.
	// PITFALL: Never store plaintext passwords. bcrypt includes salt automatically.
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	user := &model.User{
		ID:        uuid.New().String(),
		Email:     req.Email,
		Password:  string(hashedPassword),
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Role:      "user",
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.Create(ctx, user); err != nil {
		return nil, err
	}

	// Generate JWT token so the user is immediately logged in.
	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

// Login authenticates a user and returns a JWT token.
//
// SECURITY NOTES:
//   - We use the same error message for "user not found" and "wrong password"
//     to prevent email enumeration attacks.
//   - bcrypt.CompareHashAndPassword is constant-time, preventing timing attacks.
func (s *UserService) Login(ctx context.Context, req dto.LoginRequest) (*dto.AuthResponse, error) {
	user, err := s.repo.GetByEmail(ctx, req.Email)
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

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

// GetProfile retrieves a user's profile by ID.
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

// generateToken creates a signed JWT token with user claims.
func (s *UserService) generateToken(user *model.User) (string, error) {
	claims := middleware.JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(s.jwtExpiry) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}
