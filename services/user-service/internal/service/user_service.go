package service

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"sync"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/email"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
	telegramsender "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/telegram"
)

var (
	ErrUserNotFound                   = errors.New("user not found")
	ErrEmailAlreadyExists             = errors.New("email already exists")
	ErrPhoneAlreadyExists             = errors.New("phone already exists")
	ErrInvalidProfileName             = errors.New("invalid profile name")
	ErrInvalidProfileAddress          = errors.New("invalid profile address")
	ErrInvalidCredentials             = errors.New("invalid email or password")
	ErrInvalidToken                   = errors.New("invalid or expired token")
	ErrInvalidRole                    = errors.New("invalid user role")
	ErrInvalidOAuthProvider           = errors.New("invalid oauth provider")
	ErrOAuthProviderNotConfigured     = errors.New("oauth provider not configured")
	ErrInvalidOAuthState              = errors.New("invalid oauth state")
	ErrOAuthEmailRequired             = errors.New("oauth email required")
	ErrInvalidOAuthTicket             = errors.New("invalid oauth ticket")
	ErrOAuthAccountConflict           = errors.New("oauth account conflict")
	ErrInvalidPhoneNumber             = errors.New("invalid phone number")
	ErrTelegramChatNotLinked          = errors.New("telegram chat not linked")
	ErrPhoneVerificationRequired      = errors.New("phone verification required")
	ErrPhoneVerificationNotFound      = errors.New("phone verification not found")
	ErrPhoneVerificationExpired       = errors.New("phone verification expired")
	ErrPhoneVerificationLocked        = errors.New("phone verification locked")
	ErrPhoneVerificationResendTooSoon = errors.New("phone verification resend too soon")
	ErrPhoneVerificationRateLimited   = errors.New("phone verification rate limited")
	ErrPhoneVerificationInvalidOTP    = errors.New("invalid otp code")
	ErrPhoneVerificationAlreadyUsed   = errors.New("phone verification already used")
)

var vnPhoneRegex = regexp.MustCompile(`^0\d{9,10}$`)

type UserService struct {
	repo                  repository.UserRepository
	oauthRepo             repository.OAuthAccountRepository
	phoneVerificationRepo repository.PhoneVerificationRepository
	profileTxManager      repository.ProfileTxManager
	addressService        *AddressService
	jwtSecret             string
	jwtExpiry             int
	emailSender           email.Sender
	telegramSender        telegramsender.Sender
	oauthClient           OAuthProviderClient
	frontendBaseURL       string
	telegramCfg           config.TelegramConfig
	otpLimiterMu          sync.Mutex
	otpLimiterState       map[string][]time.Time
}

type UserServiceOption func(*UserService)

func WithEmailSender(sender email.Sender) UserServiceOption {
	return func(s *UserService) {
		s.emailSender = sender
	}
}

func WithOAuthAccountRepository(repo repository.OAuthAccountRepository) UserServiceOption {
	return func(s *UserService) {
		s.oauthRepo = repo
	}
}

func WithOAuthProviderClient(client OAuthProviderClient) UserServiceOption {
	return func(s *UserService) {
		s.oauthClient = client
	}
}

func WithFrontendBaseURL(baseURL string) UserServiceOption {
	return func(s *UserService) {
		s.frontendBaseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	}
}

func WithPhoneVerificationRepository(repo repository.PhoneVerificationRepository) UserServiceOption {
	return func(s *UserService) {
		s.phoneVerificationRepo = repo
	}
}

func WithProfileTxManager(txManager repository.ProfileTxManager) UserServiceOption {
	return func(s *UserService) {
		s.profileTxManager = txManager
	}
}

func WithAddressService(addressService *AddressService) UserServiceOption {
	return func(s *UserService) {
		s.addressService = addressService
	}
}

func WithTelegramSender(sender telegramsender.Sender) UserServiceOption {
	return func(s *UserService) {
		s.telegramSender = sender
	}
}

func WithTelegramConfig(cfg config.TelegramConfig) UserServiceOption {
	return func(s *UserService) {
		s.telegramCfg = cfg
	}
}

func NewUserService(repo repository.UserRepository, jwtSecret string, jwtExpiry int, options ...UserServiceOption) *UserService {
	service := &UserService{
		repo:            repo,
		jwtSecret:       jwtSecret,
		jwtExpiry:       jwtExpiry,
		frontendBaseURL: "http://localhost:4173",
		telegramCfg: config.TelegramConfig{
			APIBaseURL:               "https://api.telegram.org",
			OTPMessageTTLSeconds:     300,
			OTPResendCooldownSeconds: 60,
			OTPMaxAttempts:           5,
			OTPDailyLimitPerUser:     5,
			OTPHourlyLimitPerIP:      10,
			SecretPepper:             "change-me",
		},
		otpLimiterState: map[string][]time.Time{},
	}
	for _, option := range options {
		option(service)
	}

	return service
}

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

	now := time.Now()
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

	verificationToken, verificationTokenHash, verificationTokenExpiry, err := issueTimeBoundToken(48 * time.Hour)
	if err != nil {
		return nil, err
	}
	user.EmailVerificationTokenHash = verificationTokenHash
	user.EmailVerificationExpiresAt = &verificationTokenExpiry

	if err := s.repo.Create(ctx, user); err != nil {
		return nil, mapUserRepositoryError(err)
	}

	_ = s.sendVerificationEmail(user, verificationToken)

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
		return nil, ErrInvalidCredentials
	}

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

func (s *UserService) UpdateProfile(ctx context.Context, userID string, req dto.UpdateProfileRequest) (*model.User, error) {
	if s.profileTxManager == nil {
		return s.updateProfileWithDependencies(ctx, userID, req, s.repo, s.phoneVerificationRepo, s.addressService)
	}

	var updatedUser *model.User
	err := s.profileTxManager.RunInTx(ctx, func(repos repository.ProfileTxRepositories) error {
		addressService := s.addressService
		if repos.Addresses != nil {
			addressService = NewAddressService(repos.Addresses)
		}

		user, err := s.updateProfileWithDependencies(ctx, userID, req, repos.Users, repos.PhoneVerifications, addressService)
		if err != nil {
			return err
		}

		updatedUser = user
		return nil
	})
	if err != nil {
		return nil, err
	}

	return updatedUser, nil
}

func (s *UserService) ChangePassword(ctx context.Context, userID string, req dto.ChangePasswordRequest) error {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if user == nil {
		return ErrUserNotFound
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.CurrentPassword)); err != nil {
		return ErrInvalidCredentials
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		return err
	}

	user.Password = string(hashedPassword)
	user.UpdatedAt = time.Now()

	return s.repo.Update(ctx, user)
}

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

	user, err := s.repo.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

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

func (s *UserService) generateTokenPair(user *model.User) (string, string, error) {
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
	accessToken, err := at.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", "", err
	}

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
	refreshToken, err := rt.SignedString([]byte(s.jwtSecret))
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

func normalizeHumanName(value string) string {
	parts := strings.Fields(strings.TrimSpace(value))
	return strings.Join(parts, " ")
}

func isValidHumanName(value string, maxLength int) bool {
	normalized := normalizeHumanName(value)
	return normalized != "" && len(normalized) <= maxLength
}

func normalizePhone(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	var digits strings.Builder
	for _, r := range trimmed {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}

	normalized := digits.String()
	if strings.HasPrefix(normalized, "84") && len(normalized) >= 11 {
		normalized = "0" + normalized[2:]
	}
	if len(normalized) == 9 {
		normalized = "0" + normalized
	}

	return normalized
}

func isValidVNPhone(value string) bool {
	return vnPhoneRegex.MatchString(normalizePhone(value))
}

func normalizeTelegramChatID(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	var digits strings.Builder
	for _, r := range trimmed {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}

	return digits.String()
}

func (s *UserService) updateProfileWithDependencies(
	ctx context.Context,
	userID string,
	req dto.UpdateProfileRequest,
	userRepo repository.UserRepository,
	phoneRepo repository.PhoneVerificationRepository,
	addressService *AddressService,
) (*model.User, error) {
	user, err := userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	profilePhoneForAddress := user.Phone

	userChanged := false
	if firstName, changed, err := resolveOptionalHumanNameUpdate(user.FirstName, req.FirstName, 100); err != nil {
		return nil, err
	} else if changed {
		user.FirstName = firstName
		userChanged = true
	}
	if lastName, changed, err := resolveOptionalHumanNameUpdate(user.LastName, req.LastName, 100); err != nil {
		return nil, err
	} else if changed {
		user.LastName = lastName
		userChanged = true
	}
	currentPhone := normalizePhone(user.Phone)
	requestedPhone, phoneProvided := resolveOptionalPhone(req.Phone)
	phoneChanged := phoneProvided && requestedPhone != currentPhone
	var verifiedChallenge *model.PhoneVerificationChallenge

	if phoneChanged {
		if !isValidVNPhone(requestedPhone) {
			return nil, ErrInvalidPhoneNumber
		}
		if strings.TrimSpace(req.PhoneVerificationID) == "" || phoneRepo == nil {
			return nil, ErrPhoneVerificationRequired
		}

		existingUser, err := userRepo.GetByPhone(ctx, requestedPhone)
		if err != nil {
			return nil, err
		}
		if existingUser != nil && existingUser.ID != userID {
			return nil, ErrPhoneAlreadyExists
		}

		verifiedChallenge, err = phoneRepo.GetByID(ctx, strings.TrimSpace(req.PhoneVerificationID))
		if err != nil {
			return nil, err
		}
		if verifiedChallenge == nil || verifiedChallenge.UserID != userID {
			return nil, ErrPhoneVerificationNotFound
		}
		if verifiedChallenge.Status == model.PhoneVerificationStatusConsumed || verifiedChallenge.ConsumedAt != nil {
			return nil, ErrPhoneVerificationAlreadyUsed
		}
		if verifiedChallenge.Status != model.PhoneVerificationStatusVerified || verifiedChallenge.VerifiedAt == nil {
			return nil, ErrPhoneVerificationRequired
		}
		if normalizePhone(verifiedChallenge.PhoneCandidate) != requestedPhone {
			return nil, ErrPhoneVerificationRequired
		}

		now := time.Now()
		user.Phone = requestedPhone
		user.PhoneVerified = true
		user.PhoneVerifiedAt = &now
		user.PhoneLastChangedAt = &now
		userChanged = true
	}

	var (
		normalizedAddress *dto.ProfileAddressInput
		addressChanged    bool
	)
	if req.DefaultAddress != nil && addressService != nil {
		defaultAddress, err := addressService.GetDefaultAddress(ctx, userID)
		if err != nil {
			return nil, err
		}

		addressCopy, changed := mergeProfileAddressInput(defaultAddress, profilePhoneForAddress, *req.DefaultAddress)
		if changed {
			if !isValidProfileAddressInput(addressCopy) {
				return nil, ErrInvalidProfileAddress
			}
			normalizedAddress = &addressCopy
			addressChanged = true
		}
	}

	if !userChanged && !addressChanged {
		return user, nil
	}

	if normalizedAddress != nil && addressService != nil {
		if _, err := addressService.UpsertDefaultAddress(ctx, userID, *normalizedAddress); err != nil {
			return nil, err
		}
	}

	if userChanged {
		user.UpdatedAt = time.Now()
		if err := userRepo.Update(ctx, user); err != nil {
			return nil, mapUserRepositoryError(err)
		}
	}

	if verifiedChallenge != nil {
		now := time.Now()
		verifiedChallenge.Status = model.PhoneVerificationStatusConsumed
		verifiedChallenge.ConsumedAt = &now
		verifiedChallenge.UpdatedAt = now
		if err := phoneRepo.Update(ctx, verifiedChallenge); err != nil {
			return nil, err
		}
	}

	return user, nil
}

func resolveOptionalHumanNameUpdate(current string, input *string, maxLength int) (string, bool, error) {
	if input == nil {
		return current, false, nil
	}

	normalized := normalizeHumanName(*input)
	if normalized == "" {
		return current, false, nil
	}
	if !isValidHumanName(normalized, maxLength) {
		return current, false, ErrInvalidProfileName
	}
	if normalized == current {
		return current, false, nil
	}

	return normalized, true, nil
}

func resolveOptionalPhone(input *string) (string, bool) {
	if input == nil {
		return "", false
	}

	normalized := normalizePhone(*input)
	if normalized == "" {
		return "", false
	}

	return normalized, true
}

func resolveOptionalHumanName(input *string) (string, bool) {
	if input == nil {
		return "", false
	}

	normalized := normalizeHumanName(*input)
	if normalized == "" {
		return "", false
	}

	return normalized, true
}

func resolveOptionalTrimmedText(input *string) (string, bool) {
	if input == nil {
		return "", false
	}

	trimmed := strings.TrimSpace(*input)
	if trimmed == "" {
		return "", false
	}

	return trimmed, true
}

func mergeProfileAddressInput(current *model.Address, fallbackPhone string, input dto.UpdateProfileAddressInput) (dto.ProfileAddressInput, bool) {
	merged := dto.ProfileAddressInput{}
	if current != nil {
		merged.RecipientName = current.RecipientName
		merged.Phone = current.Phone
		merged.Street = current.Street
		merged.Ward = current.Ward
		merged.District = current.District
		merged.City = current.City
	} else {
		merged.Phone = normalizePhone(fallbackPhone)
	}

	hasPatch := false
	if recipientName, ok := resolveOptionalHumanName(input.RecipientName); ok {
		merged.RecipientName = recipientName
		hasPatch = true
	}
	if phone, ok := resolveOptionalPhone(input.Phone); ok {
		merged.Phone = phone
		hasPatch = true
	}
	if street, ok := resolveOptionalTrimmedText(input.Street); ok {
		merged.Street = street
		hasPatch = true
	}
	if ward, ok := resolveOptionalTrimmedText(input.Ward); ok {
		merged.Ward = ward
		hasPatch = true
	}
	if district, ok := resolveOptionalTrimmedText(input.District); ok {
		merged.District = district
		hasPatch = true
	}
	if city, ok := resolveOptionalTrimmedText(input.City); ok {
		merged.City = city
		hasPatch = true
	}

	if !hasPatch {
		return merged, false
	}
	if current == nil {
		return merged, true
	}

	changed := merged.RecipientName != current.RecipientName ||
		merged.Phone != current.Phone ||
		merged.Street != current.Street ||
		merged.Ward != current.Ward ||
		merged.District != current.District ||
		merged.City != current.City

	return merged, changed
}

func normalizeProfileAddressInput(input dto.ProfileAddressInput) dto.ProfileAddressInput {
	return dto.ProfileAddressInput{
		RecipientName: normalizeHumanName(input.RecipientName),
		Phone:         normalizePhone(input.Phone),
		Street:        strings.TrimSpace(input.Street),
		Ward:          strings.TrimSpace(input.Ward),
		District:      strings.TrimSpace(input.District),
		City:          strings.TrimSpace(input.City),
	}
}

func isValidProfileAddressInput(input dto.ProfileAddressInput) bool {
	if !isValidHumanName(input.RecipientName, 100) {
		return false
	}
	if !isValidVNPhone(input.Phone) {
		return false
	}
	if len(input.Street) < 5 || len(input.Street) > 255 {
		return false
	}
	if len(input.Ward) > 100 {
		return false
	}
	if len(input.District) < 2 || len(input.District) > 100 {
		return false
	}
	if len(input.City) < 2 || len(input.City) > 100 {
		return false
	}

	return true
}

func mapUserRepositoryError(err error) error {
	switch {
	case errors.Is(err, repository.ErrUserEmailAlreadyExists):
		return ErrEmailAlreadyExists
	case errors.Is(err, repository.ErrUserPhoneAlreadyExists):
		return ErrPhoneAlreadyExists
	default:
		return err
	}
}

func (s *UserService) telegramOTPConfigTTL() time.Duration {
	seconds := s.telegramCfg.OTPMessageTTLSeconds
	if seconds <= 0 {
		seconds = 300
	}
	return time.Duration(seconds) * time.Second
}

func (s *UserService) telegramOTPCooldown() time.Duration {
	seconds := s.telegramCfg.OTPResendCooldownSeconds
	if seconds <= 0 {
		seconds = 60
	}
	return time.Duration(seconds) * time.Second
}

func (s *UserService) telegramOTPMaxAttempts() int {
	if s.telegramCfg.OTPMaxAttempts <= 0 {
		return 5
	}
	return s.telegramCfg.OTPMaxAttempts
}

func (s *UserService) allowOTPEvent(key string, limit int, window time.Duration, now time.Time) bool {
	if limit <= 0 {
		return true
	}

	s.otpLimiterMu.Lock()
	defer s.otpLimiterMu.Unlock()

	entries := s.otpLimiterState[key]
	cutoff := now.Add(-window)
	filtered := entries[:0]
	for _, ts := range entries {
		if ts.After(cutoff) {
			filtered = append(filtered, ts)
		}
	}
	if len(filtered) >= limit {
		s.otpLimiterState[key] = filtered
		return false
	}

	filtered = append(filtered, now)
	s.otpLimiterState[key] = filtered
	return true
}
