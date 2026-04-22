package account

import (
	"context"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
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

type ProfileTxRepositories struct {
	Users              UserRepository
	Addresses          AddressRepository
	PhoneVerifications PhoneVerificationRepository
}

type ProfileTxManager interface {
	RunInTx(ctx context.Context, fn func(ProfileTxRepositories) error) error
}
