package service

import (
	"errors"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/email"
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

// UserService coordinates user account, profile, and token workflows across the
// repositories and optional integration clients configured for this service.
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

// WithEmailSender injects the outbound email sender used for verification and
// recovery flows.
//
// Inputs:
//   - sender is the email integration implementation.
//
// Returns:
//   - an option that mutates the service during construction.
//
// Edge cases:
//   - nil senders are allowed and cause email flows to degrade silently where
//     those paths already tolerate missing senders.
//
// Side effects:
//   - none until the option is applied by NewUserService.
//
// Performance:
//   - O(1).
func WithEmailSender(sender email.Sender) UserServiceOption {
	return func(s *UserService) {
		s.emailSender = sender
	}
}

// WithOAuthAccountRepository injects the repository used by OAuth login flows.
//
// Inputs:
//   - repo is the OAuth account persistence implementation.
//
// Returns:
//   - an option that mutates the service during construction.
//
// Edge cases:
//   - nil repositories are allowed until an OAuth flow requires them.
//
// Side effects:
//   - none until the option is applied.
//
// Performance:
//   - O(1).
func WithOAuthAccountRepository(repo repository.OAuthAccountRepository) UserServiceOption {
	return func(s *UserService) {
		s.oauthRepo = repo
	}
}

// WithOAuthProviderClient injects the external OAuth identity client.
//
// Inputs:
//   - client resolves provider redirects and exchanged identities.
//
// Returns:
//   - an option that mutates the service during construction.
//
// Edge cases:
//   - nil clients are allowed until OAuth flows are exercised.
//
// Side effects:
//   - none until the option is applied.
//
// Performance:
//   - O(1).
func WithOAuthProviderClient(client OAuthProviderClient) UserServiceOption {
	return func(s *UserService) {
		s.oauthClient = client
	}
}

// WithFrontendBaseURL configures the base URL used to construct links sent to
// frontend clients.
//
// Inputs:
//   - baseURL is the raw configured frontend origin.
//
// Returns:
//   - an option that stores the normalized URL without trailing slashes.
//
// Edge cases:
//   - blank values normalize to an empty string and let the service fall back to
//     its default constructor value.
//
// Side effects:
//   - none until the option is applied.
//
// Performance:
//   - O(n) over the URL length due to trimming.
func WithFrontendBaseURL(baseURL string) UserServiceOption {
	return func(s *UserService) {
		s.frontendBaseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	}
}

// WithPhoneVerificationRepository injects the repository used by OTP-based phone
// verification flows.
//
// Inputs:
//   - repo persists phone verification challenges.
//
// Returns:
//   - an option that mutates the service during construction.
//
// Edge cases:
//   - nil repositories are allowed until phone verification is required.
//
// Side effects:
//   - none until the option is applied.
//
// Performance:
//   - O(1).
func WithPhoneVerificationRepository(repo repository.PhoneVerificationRepository) UserServiceOption {
	return func(s *UserService) {
		s.phoneVerificationRepo = repo
	}
}

// WithProfileTxManager injects the transaction coordinator used for profile
// updates that span users, phone verification, and addresses.
//
// Inputs:
//   - txManager is the transaction manager implementation.
//
// Returns:
//   - an option that mutates the service during construction.
//
// Edge cases:
//   - nil managers are allowed and make UpdateProfile fall back to best-effort
//     non-transactional dependency calls.
//
// Side effects:
//   - none until the option is applied.
//
// Performance:
//   - O(1).
func WithProfileTxManager(txManager repository.ProfileTxManager) UserServiceOption {
	return func(s *UserService) {
		s.profileTxManager = txManager
	}
}

// WithAddressService injects the address domain service used by profile updates.
//
// Inputs:
//   - addressService is the address service implementation.
//
// Returns:
//   - an option that mutates the service during construction.
//
// Edge cases:
//   - nil services are allowed and simply disable address-upsert behavior from
//     profile updates.
//
// Side effects:
//   - none until the option is applied.
//
// Performance:
//   - O(1).
func WithAddressService(addressService *AddressService) UserServiceOption {
	return func(s *UserService) {
		s.addressService = addressService
	}
}

// WithTelegramSender injects the Telegram sender used by OTP flows.
//
// Inputs:
//   - sender is the Telegram integration implementation.
//
// Returns:
//   - an option that mutates the service during construction.
//
// Edge cases:
//   - nil senders are allowed until phone verification is attempted.
//
// Side effects:
//   - none until the option is applied.
//
// Performance:
//   - O(1).
func WithTelegramSender(sender telegramsender.Sender) UserServiceOption {
	return func(s *UserService) {
		s.telegramSender = sender
	}
}

// WithTelegramConfig injects the OTP-related Telegram configuration used by
// phone verification and rate limiting.
//
// Inputs:
//   - cfg contains the Telegram and OTP limits.
//
// Returns:
//   - an option that mutates the service during construction.
//
// Edge cases:
//   - invalid zero or negative values are normalized later by helper methods.
//
// Side effects:
//   - none until the option is applied.
//
// Performance:
//   - O(1).
func WithTelegramConfig(cfg config.TelegramConfig) UserServiceOption {
	return func(s *UserService) {
		s.telegramCfg = cfg
	}
}

// NewUserService wires the dependencies and defaults used by the user domain.
//
// Inputs:
//   - repo persists user state.
//   - jwtSecret signs access and refresh tokens.
//   - jwtExpiry controls access-token lifetime in hours.
//   - options optionally inject integration dependencies and configuration.
//
// Returns:
//   - a ready-to-use user service.
//
// Edge cases:
//   - optional repositories and clients may remain nil until a flow requires
//     them.
//
// Side effects:
//   - allocates the in-memory OTP rate limiter state.
//
// Performance:
//   - O(k) over the number of options, with O(1) work per option.
func NewUserService(repo repository.UserRepository, jwtSecret string, jwtExpiry int, options ...UserServiceOption) *UserService {
	service := &UserService{
		repo:            repo,
		jwtSecret:       jwtSecret,
		jwtExpiry:       jwtExpiry,
		frontendBaseURL: "http://localhost:5174",
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
