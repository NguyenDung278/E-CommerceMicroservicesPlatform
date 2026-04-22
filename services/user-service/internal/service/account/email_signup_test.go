package account

import (
	"context"
	"testing"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type fakeEmailSignupRepo struct {
	challenges map[string]*model.EmailSignupChallenge
}

func newFakeEmailSignupRepo() *fakeEmailSignupRepo {
	return &fakeEmailSignupRepo{
		challenges: map[string]*model.EmailSignupChallenge{},
	}
}

func (r *fakeEmailSignupRepo) Create(_ context.Context, challenge *model.EmailSignupChallenge) error {
	r.challenges[challenge.ID] = challenge
	return nil
}

func (r *fakeEmailSignupRepo) GetByID(_ context.Context, id string) (*model.EmailSignupChallenge, error) {
	return r.challenges[id], nil
}

func (r *fakeEmailSignupRepo) GetLatestActiveByEmail(_ context.Context, email string) (*model.EmailSignupChallenge, error) {
	var latest *model.EmailSignupChallenge
	for _, challenge := range r.challenges {
		if challenge.Email != email {
			continue
		}
		if challenge.Status != model.EmailVerificationStatusPending && challenge.Status != model.EmailVerificationStatusVerified {
			continue
		}
		if latest == nil || challenge.UpdatedAt.After(latest.UpdatedAt) {
			latest = challenge
		}
	}
	return latest, nil
}

func (r *fakeEmailSignupRepo) Update(_ context.Context, challenge *model.EmailSignupChallenge) error {
	r.challenges[challenge.ID] = challenge
	return nil
}

func (r *fakeEmailSignupRepo) DeleteExpired(_ context.Context) error {
	return nil
}

func newEmailSignupTestService(userRepo *fakeUserRepo, signupRepo *fakeEmailSignupRepo, sender *captureEmailSender) *UserService {
	return NewUserService(
		userRepo,
		testSecret,
		24,
		WithEmailSender(sender),
		WithEmailSignupRepository(signupRepo),
		WithEmailVerificationConfig(config.EmailVerificationConfig{
			OTPMessageTTLSeconds:     600,
			OTPResendCooldownSeconds: 60,
			OTPMaxAttempts:           5,
			OTPDailyLimitPerUser:     5,
			OTPHourlyLimitPerIP:      10,
			SecretPepper:             "email-signup-test-pepper",
		}),
	)
}

func TestStartEmailSignupAndVerifyOTPCreatesUserAfterVerification(t *testing.T) {
	userRepo := newFakeUserRepo()
	signupRepo := newFakeEmailSignupRepo()
	sender := &captureEmailSender{}
	svc := newEmailSignupTestService(userRepo, signupRepo, sender)

	status, err := svc.StartEmailSignup(context.Background(), "127.0.0.1", dto.StartEmailSignupRequest{
		Email:           "new.signup@example.com",
		Password:        "password123",
		ConfirmPassword: "password123",
	})
	if err != nil {
		t.Fatalf("StartEmailSignup returned error: %v", err)
	}
	if status == nil || status.VerificationID == "" {
		t.Fatalf("expected email signup challenge, got %#v", status)
	}
	if userRepo.usersByEmail["new.signup@example.com"] != nil {
		t.Fatal("expected email signup to defer user creation until OTP verification")
	}
	if len(sender.messages) != 1 {
		t.Fatalf("expected one signup email OTP to be sent, got %d", len(sender.messages))
	}

	authResp, err := svc.VerifyEmailSignupOTP(context.Background(), dto.VerifyEmailOTPRequest{
		VerificationID: status.VerificationID,
		OTPCode:        extractOTPCodeFromBody(sender.messages[0].Body),
	})
	if err != nil {
		t.Fatalf("VerifyEmailSignupOTP returned error: %v", err)
	}
	if authResp == nil || authResp.Token == "" || authResp.RefreshToken == "" {
		t.Fatalf("expected auth response after signup verification, got %#v", authResp)
	}

	createdUser := userRepo.usersByEmail["new.signup@example.com"]
	if createdUser == nil {
		t.Fatal("expected verified email signup to create user")
	}
	if !createdUser.EmailVerified {
		t.Fatal("expected created user email to be marked verified")
	}
	if createdUser.FirstName == "" || createdUser.LastName == "" {
		t.Fatalf("expected email signup to assign a random profile name, got %q %q", createdUser.FirstName, createdUser.LastName)
	}
	if createdUser.FirstName == "ND" && createdUser.LastName == "Customer" {
		t.Fatalf("expected email signup to stop using the legacy placeholder name, got %q %q", createdUser.FirstName, createdUser.LastName)
	}

	challenge := signupRepo.challenges[status.VerificationID]
	if challenge == nil || challenge.Status != model.EmailVerificationStatusConsumed || challenge.ConsumedAt == nil {
		t.Fatalf("expected email signup challenge to be consumed after success, got %#v", challenge)
	}
}

func TestStartEmailSignupRejectsMismatchedPasswordConfirmation(t *testing.T) {
	userRepo := newFakeUserRepo()
	signupRepo := newFakeEmailSignupRepo()
	sender := &captureEmailSender{}
	svc := newEmailSignupTestService(userRepo, signupRepo, sender)

	_, err := svc.StartEmailSignup(context.Background(), "127.0.0.1", dto.StartEmailSignupRequest{
		Email:           "new.signup@example.com",
		Password:        "password123",
		ConfirmPassword: "password456",
	})
	if err != ErrPasswordConfirmationMismatch {
		t.Fatalf("expected ErrPasswordConfirmationMismatch, got %v", err)
	}
}
