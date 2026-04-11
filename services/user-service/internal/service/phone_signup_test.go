package service

import (
	"context"
	"testing"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type fakePhoneSignupRepo struct {
	challenges map[string]*model.PhoneSignupChallenge
}

func newFakePhoneSignupRepo() *fakePhoneSignupRepo {
	return &fakePhoneSignupRepo{
		challenges: map[string]*model.PhoneSignupChallenge{},
	}
}

func (r *fakePhoneSignupRepo) Create(_ context.Context, challenge *model.PhoneSignupChallenge) error {
	r.challenges[challenge.ID] = challenge
	return nil
}

func (r *fakePhoneSignupRepo) GetByID(_ context.Context, id string) (*model.PhoneSignupChallenge, error) {
	return r.challenges[id], nil
}

func (r *fakePhoneSignupRepo) GetLatestActiveByPhone(_ context.Context, phone string) (*model.PhoneSignupChallenge, error) {
	var latest *model.PhoneSignupChallenge
	for _, challenge := range r.challenges {
		if challenge.Phone != phone {
			continue
		}
		if challenge.Status != model.PhoneVerificationStatusPending && challenge.Status != model.PhoneVerificationStatusVerified {
			continue
		}
		if latest == nil || challenge.UpdatedAt.After(latest.UpdatedAt) {
			latest = challenge
		}
	}
	return latest, nil
}

func (r *fakePhoneSignupRepo) Update(_ context.Context, challenge *model.PhoneSignupChallenge) error {
	r.challenges[challenge.ID] = challenge
	return nil
}

func (r *fakePhoneSignupRepo) DeleteExpired(_ context.Context) error {
	return nil
}

func newPhoneSignupTestService(userRepo *fakeUserRepo, signupRepo *fakePhoneSignupRepo, sender *fakeTelegramSender) *UserService {
	return NewUserService(
		userRepo,
		testSecret,
		24,
		WithPhoneSignupRepository(signupRepo),
		WithTelegramSender(sender),
		WithTelegramConfig(config.TelegramConfig{
			OTPMessageTTLSeconds:     300,
			OTPResendCooldownSeconds: 60,
			OTPMaxAttempts:           5,
			OTPDailyLimitPerUser:     5,
			OTPHourlyLimitPerIP:      10,
			SecretPepper:             "unit-test-pepper",
		}),
	)
}

func TestStartPhoneSignupAndVerifyOTPCreatesPhoneOnlyUser(t *testing.T) {
	userRepo := newFakeUserRepo()
	signupRepo := newFakePhoneSignupRepo()
	sender := newFakeTelegramSender()
	svc := newPhoneSignupTestService(userRepo, signupRepo, sender)

	status, err := svc.StartPhoneSignup(context.Background(), "127.0.0.1", dto.StartPhoneSignupRequest{
		Phone:           "0987654321",
		Password:        "password123",
		ConfirmPassword: "password123",
	})
	if err != nil {
		t.Fatalf("StartPhoneSignup returned error: %v", err)
	}
	if status == nil || status.VerificationID == "" {
		t.Fatalf("expected phone signup challenge, got %#v", status)
	}

	otpCode := sender.lastOTPByPhone["0987654321"]
	if otpCode == "" {
		t.Fatal("expected telegram otp to be dispatched for phone signup")
	}

	authResp, err := svc.VerifyPhoneSignupOTP(context.Background(), dto.VerifyPhoneOTPRequest{
		VerificationID: status.VerificationID,
		OTPCode:        otpCode,
	})
	if err != nil {
		t.Fatalf("VerifyPhoneSignupOTP returned error: %v", err)
	}
	if authResp == nil || authResp.Token == "" || authResp.RefreshToken == "" {
		t.Fatalf("expected auth response after successful phone signup verification, got %#v", authResp)
	}

	createdUser := userRepo.usersByPhone["0987654321"]
	if createdUser == nil {
		t.Fatal("expected verified phone signup to create user")
	}
	if createdUser.Email != "" {
		t.Fatalf("expected phone-only signup to keep email empty, got %q", createdUser.Email)
	}
	if !createdUser.PhoneVerified {
		t.Fatal("expected created user phone to be marked verified")
	}
	if !createdUser.EmailVerified {
		t.Fatal("expected phone-only signup to skip email verification requirement")
	}
	if createdUser.FirstName == "" || createdUser.LastName == "" {
		t.Fatalf("expected phone signup to assign a random profile name, got %q %q", createdUser.FirstName, createdUser.LastName)
	}
	if createdUser.FirstName == "ND" && createdUser.LastName == "Customer" {
		t.Fatalf("expected phone signup to stop using the legacy placeholder name, got %q %q", createdUser.FirstName, createdUser.LastName)
	}

	challenge := signupRepo.challenges[status.VerificationID]
	if challenge == nil || challenge.Status != model.PhoneVerificationStatusConsumed || challenge.ConsumedAt == nil {
		t.Fatalf("expected signup challenge to be consumed after success, got %#v", challenge)
	}
}

func TestStartPhoneSignupRejectsMismatchedPasswordConfirmation(t *testing.T) {
	userRepo := newFakeUserRepo()
	signupRepo := newFakePhoneSignupRepo()
	sender := newFakeTelegramSender()
	svc := newPhoneSignupTestService(userRepo, signupRepo, sender)

	_, err := svc.StartPhoneSignup(context.Background(), "127.0.0.1", dto.StartPhoneSignupRequest{
		Phone:           "0987654321",
		Password:        "password123",
		ConfirmPassword: "password456",
	})
	if err != ErrPasswordConfirmationMismatch {
		t.Fatalf("expected ErrPasswordConfirmationMismatch, got %v", err)
	}
}
