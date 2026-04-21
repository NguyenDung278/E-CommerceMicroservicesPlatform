package repository

import (
	"context"
	"database/sql"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/addressrepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/authrepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/common"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/notificationpreferencerepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/oauthrepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/userrepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/wishlistrepo"
)

type AddressRepository interface {
	Create(ctx context.Context, addr *model.Address) error
	GetByID(ctx context.Context, id string) (*model.Address, error)
	GetByUserID(ctx context.Context, userID string) ([]*model.Address, error)
	Update(ctx context.Context, addr *model.Address) error
	Delete(ctx context.Context, id string) error
	ClearDefault(ctx context.Context, userID string) error
	CountByUserID(ctx context.Context, userID string) (int, error)
}

type EmailSignupRepository interface {
	Create(ctx context.Context, challenge *model.EmailSignupChallenge) error
	GetByID(ctx context.Context, id string) (*model.EmailSignupChallenge, error)
	GetLatestActiveByEmail(ctx context.Context, email string) (*model.EmailSignupChallenge, error)
	Update(ctx context.Context, challenge *model.EmailSignupChallenge) error
	DeleteExpired(ctx context.Context) error
}

type EmailVerificationRepository interface {
	Create(ctx context.Context, challenge *model.EmailVerificationChallenge) error
	GetByID(ctx context.Context, id string) (*model.EmailVerificationChallenge, error)
	GetLatestActiveByUserID(ctx context.Context, userID, purpose string) (*model.EmailVerificationChallenge, error)
	Update(ctx context.Context, challenge *model.EmailVerificationChallenge) error
	DeleteExpired(ctx context.Context) error
}

type NotificationPreferenceRepository interface {
	ListByUserID(ctx context.Context, userID string) ([]*model.NotificationPreference, error)
	UpsertMany(ctx context.Context, userID string, preferences []*model.NotificationPreference) error
}

type OAuthAccountRepository interface {
	Create(ctx context.Context, account *model.OAuthAccount) error
	Update(ctx context.Context, account *model.OAuthAccount) error
	GetByProviderUserID(ctx context.Context, provider, providerUserID string) (*model.OAuthAccount, error)
	GetByUserIDAndProvider(ctx context.Context, userID, provider string) (*model.OAuthAccount, error)
}

type PhoneSignupRepository interface {
	Create(ctx context.Context, challenge *model.PhoneSignupChallenge) error
	GetByID(ctx context.Context, id string) (*model.PhoneSignupChallenge, error)
	GetLatestActiveByPhone(ctx context.Context, phone string) (*model.PhoneSignupChallenge, error)
	Update(ctx context.Context, challenge *model.PhoneSignupChallenge) error
	DeleteExpired(ctx context.Context) error
}

type PhoneVerificationRepository interface {
	Create(ctx context.Context, challenge *model.PhoneVerificationChallenge) error
	GetByID(ctx context.Context, id string) (*model.PhoneVerificationChallenge, error)
	GetLatestActiveByUserID(ctx context.Context, userID, purpose string) (*model.PhoneVerificationChallenge, error)
	Update(ctx context.Context, challenge *model.PhoneVerificationChallenge) error
	DeleteExpired(ctx context.Context) error
}

type UserAvatarRepository interface {
	GetByUserID(ctx context.Context, userID string) (*model.UserAvatar, error)
	Upsert(ctx context.Context, avatar *model.UserAvatar) error
}

type UserRepository interface {
	Create(ctx context.Context, user *model.User) error
	GetByID(ctx context.Context, id string) (*model.User, error)
	GetByEmail(ctx context.Context, email string) (*model.User, error)
	GetByPhone(ctx context.Context, phone string) (*model.User, error)
	GetByEmailVerificationTokenHash(ctx context.Context, tokenHash string) (*model.User, error)
	GetByPasswordResetTokenHash(ctx context.Context, tokenHash string) (*model.User, error)
	List(ctx context.Context) ([]*model.User, error)
	Update(ctx context.Context, user *model.User) error
}

type WishlistRepository interface {
	ListByUserID(ctx context.Context, userID string) ([]*model.WishlistItem, error)
	ListUserIDs(ctx context.Context, limit int) ([]string, error)
	Upsert(ctx context.Context, item *model.WishlistItem) error
	UpsertMany(ctx context.Context, items []*model.WishlistItem) error
	Delete(ctx context.Context, userID, productID string) error
}

var (
	ErrOAuthAccountAlreadyExists = oauthrepo.ErrOAuthAccountAlreadyExists
	ErrUserEmailAlreadyExists    = userrepo.ErrUserEmailAlreadyExists
	ErrUserPhoneAlreadyExists    = userrepo.ErrUserPhoneAlreadyExists
)

func NewAddressRepository(db *sql.DB) AddressRepository {
	return addressrepo.New(db)
}

func NewEmailSignupRepository(db *sql.DB) EmailSignupRepository {
	return authrepo.NewEmailSignup(db)
}

func NewEmailVerificationRepository(db *sql.DB) EmailVerificationRepository {
	return authrepo.NewEmailVerification(db)
}

func NewNotificationPreferenceRepository(db *sql.DB) NotificationPreferenceRepository {
	return notificationpreferencerepo.New(db)
}

func NewOAuthAccountRepository(db *sql.DB) OAuthAccountRepository {
	return oauthrepo.New(db)
}

func NewPhoneSignupRepository(db *sql.DB) PhoneSignupRepository {
	return authrepo.NewPhoneSignup(db)
}

func NewPhoneVerificationRepository(db *sql.DB) PhoneVerificationRepository {
	return authrepo.NewPhoneVerification(db)
}

func NewUserAvatarRepository(db *sql.DB) UserAvatarRepository {
	return userrepo.NewAvatar(db)
}

func NewUserRepository(db *sql.DB) UserRepository {
	return userrepo.New(db)
}

func NewWishlistRepository(db *sql.DB) WishlistRepository {
	return wishlistrepo.New(db)
}

func IsUndefinedTableError(err error) bool {
	return common.IsUndefinedTableError(err)
}
