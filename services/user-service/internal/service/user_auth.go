package service

import (
	"context"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

// Register validates a signup request, persists the new user, and returns the
// initial token pair.
//
// Inputs:
//   - ctx carries cancellation to repository operations.
//   - req contains the signup payload from the API boundary.
//
// Returns:
//   - the authentication response containing tokens and the created user.
//   - a business or persistence error describing why registration failed.
//
// Edge cases:
//   - phone uniqueness is checked only when the caller supplied a phone number.
//   - verification email dispatch is best-effort and does not block successful registration.
//
// Side effects:
//   - writes a user row to PostgreSQL.
//   - may send a verification email when an email sender is configured.
//
// Performance:
//   - dominated by bcrypt password hashing plus up to two repository lookups and one insert.
func (s *UserService) Register(ctx context.Context, req dto.RegisterRequest) (*dto.AuthResponse, error) {
	req.Email = normalizeEmail(req.Email)
	req.Phone = normalizePhone(req.Phone)
	req.FirstName = normalizeHumanName(req.FirstName)
	req.LastName = normalizeHumanName(req.LastName)

	existing, err := s.repo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrEmailAlreadyExists
	}
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

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, err
	}

	now := currentTime()
	user := &model.User{
		ID:            uuid.New().String(),
		Email:         req.Email,
		Phone:         req.Phone,
		PhoneVerified: false,
		Password:      string(hashedPassword),
		FirstName:     req.FirstName,
		LastName:      req.LastName,
		Role:          middleware.RoleUser,
		EmailVerified: false,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	verificationToken, verificationTokenHash, verificationTokenExpiry, err := issueTimeBoundToken(48 * hours)
	if err != nil {
		return nil, err
	}
	user.EmailVerificationTokenHash = verificationTokenHash
	user.EmailVerificationExpiresAt = &verificationTokenExpiry

	if err := s.repo.Create(ctx, user); err != nil {
		return nil, mapUserRepositoryError(err)
	}

	_ = s.sendVerificationEmail(user, verificationToken)

	return s.buildAuthResponse(user)
}

// Login authenticates a user by email or phone and returns a fresh token pair.
//
// Inputs:
//   - ctx carries cancellation to repository operations.
//   - req contains the login identifier and password.
//
// Returns:
//   - the authentication response for the matching user.
//   - ErrInvalidCredentials when lookup or password verification fails.
//
// Edge cases:
//   - identifier takes precedence over the legacy email field when provided.
//
// Side effects:
//   - none beyond bcrypt verification work.
//
// Performance:
//   - dominated by one repository lookup and one bcrypt comparison.
func (s *UserService) Login(ctx context.Context, req dto.LoginRequest) (*dto.AuthResponse, error) {
	identifier := normalizeIdentifier(req)
	if identifier == "" {
		return nil, ErrInvalidCredentials
	}

	user, err := s.findUserByIdentifier(ctx, identifier)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return s.buildAuthResponse(user)
}

// ChangePassword validates the current password, hashes the new password, and
// persists the updated user record.
//
// Inputs:
//   - ctx carries cancellation to repository operations.
//   - userID identifies the authenticated user.
//   - req contains the current and new password.
//
// Returns:
//   - nil on success.
//   - ErrUserNotFound or ErrInvalidCredentials when validation fails.
//
// Edge cases:
//   - password reuse is not checked here because current business rules do not
//     prohibit it.
//
// Side effects:
//   - writes the updated password hash to PostgreSQL.
//
// Performance:
//   - dominated by one repository lookup, one bcrypt comparison, and one bcrypt hash.
func (s *UserService) ChangePassword(ctx context.Context, userID string, req dto.ChangePasswordRequest) error {
	user, err := s.loadUserByID(ctx, s.repo, userID)
	if err != nil {
		return err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.CurrentPassword)); err != nil {
		return ErrInvalidCredentials
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		return err
	}

	user.Password = string(hashedPassword)
	user.UpdatedAt = currentTime()

	return s.repo.Update(ctx, user)
}

// buildAuthResponse creates the standard authentication response used by login,
// registration, and token refresh flows.
//
// Inputs:
//   - user is the authenticated user.
//
// Returns:
//   - the response containing fresh access and refresh tokens.
//   - any token-signing error.
//
// Edge cases:
//   - callers must supply a non-nil user.
//
// Side effects:
//   - none.
//
// Performance:
//   - dominated by generateTokenPair.
func (s *UserService) buildAuthResponse(user *model.User) (*dto.AuthResponse, error) {
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

// findUserByIdentifier resolves an account by normalized email or phone.
//
// Inputs:
//   - ctx carries cancellation to repository calls.
//   - identifier is the normalized login identifier.
//
// Returns:
//   - the matching user when found.
//   - nil when no user matches.
//   - any repository error.
//
// Edge cases:
//   - identifiers containing `@` are treated as emails; all other identifiers are phones.
//
// Side effects:
//   - none.
//
// Performance:
//   - one repository lookup.
func (s *UserService) findUserByIdentifier(ctx context.Context, identifier string) (*model.User, error) {
	if isEmailIdentifier(identifier) {
		return s.repo.GetByEmail(ctx, identifier)
	}
	return s.repo.GetByPhone(ctx, identifier)
}
