package service

import (
	"context"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/email"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
	accountservice "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service/account"
	engagementservice "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service/engagement"
	telegramsender "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/telegram"
	"go.uber.org/zap"
)

const (
	OAuthProviderGoogle  = accountservice.OAuthProviderGoogle
	OAuthNonceCookieName = accountservice.OAuthNonceCookieName
)

type (
	AddressService                = accountservice.AddressService
	DevAccountBootstrapper        = accountservice.DevAccountBootstrapper
	EmailVerificationError        = accountservice.EmailVerificationError
	NotificationPreferenceService = engagementservice.NotificationPreferenceService
	OAuthIdentity                 = accountservice.OAuthIdentity
	OAuthProviderClient           = accountservice.OAuthProviderClient
	OAuthStartResult              = accountservice.OAuthStartResult
	PhoneVerificationError        = accountservice.PhoneVerificationError
	UserService                   = accountservice.UserService
	UserServiceOption             = accountservice.UserServiceOption
	WishlistService               = engagementservice.WishlistService
	WishlistServiceOption         = engagementservice.WishlistServiceOption
)

type wishlistProductCatalog interface {
	ListProductsByIDs(ctx context.Context, ids []string) ([]client.ProductSnapshot, error)
}

type wishlistUserReader interface {
	GetByID(ctx context.Context, id string) (*model.User, error)
}

var (
	ErrAddressNotFound                    = accountservice.ErrAddressNotFound
	ErrAvatarRepositoryUnavailable        = accountservice.ErrAvatarRepositoryUnavailable
	ErrAvatarTooLarge                     = accountservice.ErrAvatarTooLarge
	ErrEmailAlreadyExists                 = accountservice.ErrEmailAlreadyExists
	ErrEmailVerificationAlreadyUsed       = accountservice.ErrEmailVerificationAlreadyUsed
	ErrEmailVerificationExpired           = accountservice.ErrEmailVerificationExpired
	ErrEmailVerificationInvalidOTP        = accountservice.ErrEmailVerificationInvalidOTP
	ErrEmailVerificationLocked            = accountservice.ErrEmailVerificationLocked
	ErrEmailVerificationNotFound          = accountservice.ErrEmailVerificationNotFound
	ErrEmailVerificationRateLimited       = accountservice.ErrEmailVerificationRateLimited
	ErrEmailVerificationResendTooSoon     = accountservice.ErrEmailVerificationResendTooSoon
	ErrInvalidAddress                     = accountservice.ErrInvalidAddress
	ErrInvalidAvatarFile                  = accountservice.ErrInvalidAvatarFile
	ErrInvalidCredentials                 = accountservice.ErrInvalidCredentials
	ErrInvalidNotificationPreferenceTopic = engagementservice.ErrInvalidNotificationPreferenceTopic
	ErrInvalidOAuthProvider               = accountservice.ErrInvalidOAuthProvider
	ErrInvalidOAuthState                  = accountservice.ErrInvalidOAuthState
	ErrInvalidOAuthTicket                 = accountservice.ErrInvalidOAuthTicket
	ErrInvalidPhoneNumber                 = accountservice.ErrInvalidPhoneNumber
	ErrInvalidProfileAddress              = accountservice.ErrInvalidProfileAddress
	ErrInvalidProfileName                 = accountservice.ErrInvalidProfileName
	ErrInvalidRole                        = accountservice.ErrInvalidRole
	ErrInvalidToken                       = accountservice.ErrInvalidToken
	ErrOAuthAccountConflict               = accountservice.ErrOAuthAccountConflict
	ErrOAuthEmailRequired                 = accountservice.ErrOAuthEmailRequired
	ErrOAuthProviderNotConfigured         = accountservice.ErrOAuthProviderNotConfigured
	ErrPasswordConfirmationMismatch       = accountservice.ErrPasswordConfirmationMismatch
	ErrPhoneAlreadyExists                 = accountservice.ErrPhoneAlreadyExists
	ErrPhoneVerificationAlreadyUsed       = accountservice.ErrPhoneVerificationAlreadyUsed
	ErrPhoneVerificationExpired           = accountservice.ErrPhoneVerificationExpired
	ErrPhoneVerificationInvalidOTP        = accountservice.ErrPhoneVerificationInvalidOTP
	ErrPhoneVerificationLocked            = accountservice.ErrPhoneVerificationLocked
	ErrPhoneVerificationNotFound          = accountservice.ErrPhoneVerificationNotFound
	ErrPhoneVerificationRateLimited       = accountservice.ErrPhoneVerificationRateLimited
	ErrPhoneVerificationRequired          = accountservice.ErrPhoneVerificationRequired
	ErrPhoneVerificationResendTooSoon     = accountservice.ErrPhoneVerificationResendTooSoon
	ErrTelegramChatNotLinked              = accountservice.ErrTelegramChatNotLinked
	ErrTooManyAddresses                   = accountservice.ErrTooManyAddresses
	ErrUserNotFound                       = accountservice.ErrUserNotFound
)

func NewAddressService(repo repository.AddressRepository) *AddressService {
	return accountservice.NewAddressService(repo)
}

func NewDevAccountBootstrapper(
	repo repository.UserRepository,
	log *zap.Logger,
	adminPassword string,
	staffPassword string,
) *DevAccountBootstrapper {
	return accountservice.NewDevAccountBootstrapper(repo, log, adminPassword, staffPassword)
}

func NewNotificationPreferenceService(
	repo repository.NotificationPreferenceRepository,
) *NotificationPreferenceService {
	return engagementservice.NewNotificationPreferenceService(repo)
}

func NewOAuthProviderClient(cfg config.OAuthConfig) OAuthProviderClient {
	return accountservice.NewOAuthProviderClient(cfg)
}

func NewUserService(
	repo repository.UserRepository,
	jwtSecret string,
	jwtExpiry int,
	options ...UserServiceOption,
) *UserService {
	return accountservice.NewUserService(repo, jwtSecret, jwtExpiry, options...)
}

func NewWishlistService(
	repo repository.WishlistRepository,
	options ...WishlistServiceOption,
) *WishlistService {
	return engagementservice.NewWishlistService(repo, options...)
}

func WithAddressService(addressService *AddressService) UserServiceOption {
	return accountservice.WithAddressService(addressService)
}

func WithEmailSender(sender email.Sender) UserServiceOption {
	return accountservice.WithEmailSender(sender)
}

func WithEmailSignupRepository(repo repository.EmailSignupRepository) UserServiceOption {
	return accountservice.WithEmailSignupRepository(repo)
}

func WithEmailVerificationConfig(cfg config.EmailVerificationConfig) UserServiceOption {
	return accountservice.WithEmailVerificationConfig(cfg)
}

func WithEmailVerificationRepository(repo repository.EmailVerificationRepository) UserServiceOption {
	return accountservice.WithEmailVerificationRepository(repo)
}

func WithFrontendBaseURL(baseURL string) UserServiceOption {
	return accountservice.WithFrontendBaseURL(baseURL)
}

func WithOAuthAccountRepository(repo repository.OAuthAccountRepository) UserServiceOption {
	return accountservice.WithOAuthAccountRepository(repo)
}

func WithOAuthProviderClient(client OAuthProviderClient) UserServiceOption {
	return accountservice.WithOAuthProviderClient(client)
}

func WithPhoneSignupRepository(repo repository.PhoneSignupRepository) UserServiceOption {
	return accountservice.WithPhoneSignupRepository(repo)
}

func WithPhoneVerificationRepository(repo repository.PhoneVerificationRepository) UserServiceOption {
	return accountservice.WithPhoneVerificationRepository(repo)
}

func WithProfileTxManager(txManager repository.ProfileTxManager) UserServiceOption {
	return accountservice.WithProfileTxManager(txManager)
}

func WithTelegramConfig(cfg config.TelegramConfig) UserServiceOption {
	return accountservice.WithTelegramConfig(cfg)
}

func WithTelegramSender(sender telegramsender.Sender) UserServiceOption {
	return accountservice.WithTelegramSender(sender)
}

func WithUserAvatarRepository(repo repository.UserAvatarRepository) UserServiceOption {
	return accountservice.WithUserAvatarRepository(repo)
}

func WithWishlistNotificationPreferences(
	preferences *NotificationPreferenceService,
) WishlistServiceOption {
	return engagementservice.WithWishlistNotificationPreferences(preferences)
}

func WithWishlistProductCatalog(catalog wishlistProductCatalog) WishlistServiceOption {
	return engagementservice.WithWishlistProductCatalog(catalog)
}

func WithWishlistUserReader(userReader wishlistUserReader) WishlistServiceOption {
	return engagementservice.WithWishlistUserReader(userReader)
}
