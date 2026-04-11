package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/email"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type fakeEmailVerificationRepo struct {
	challenges map[string]*model.EmailVerificationChallenge
}

type captureEmailSender struct {
	err      error
	messages []email.Message
}

func newFakeEmailVerificationRepo() *fakeEmailVerificationRepo {
	return &fakeEmailVerificationRepo{challenges: map[string]*model.EmailVerificationChallenge{}}
}

func (r *fakeEmailVerificationRepo) Create(_ context.Context, challenge *model.EmailVerificationChallenge) error {
	r.challenges[challenge.ID] = challenge
	return nil
}

func (r *fakeEmailVerificationRepo) GetByID(_ context.Context, id string) (*model.EmailVerificationChallenge, error) {
	return r.challenges[id], nil
}

func (r *fakeEmailVerificationRepo) GetLatestActiveByUserID(_ context.Context, userID, purpose string) (*model.EmailVerificationChallenge, error) {
	var latest *model.EmailVerificationChallenge
	for _, challenge := range r.challenges {
		if challenge.UserID != userID || challenge.Purpose != purpose {
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

func (r *fakeEmailVerificationRepo) Update(_ context.Context, challenge *model.EmailVerificationChallenge) error {
	r.challenges[challenge.ID] = challenge
	return nil
}

func (r *fakeEmailVerificationRepo) DeleteExpired(_ context.Context) error {
	for id, challenge := range r.challenges {
		if challenge.ExpiresAt.Before(time.Now()) && (challenge.Status == model.EmailVerificationStatusExpired || challenge.Status == model.EmailVerificationStatusLocked || challenge.Status == model.EmailVerificationStatusConsumed) {
			delete(r.challenges, id)
		}
	}
	return nil
}

func (s *captureEmailSender) Send(message email.Message) error {
	s.messages = append(s.messages, message)
	return s.err
}

func newEmailVerificationTestService(userRepo *fakeUserRepo, emailRepo *fakeEmailVerificationRepo, sender *captureEmailSender) *UserService {
	return NewUserService(
		userRepo,
		testSecret,
		24,
		WithEmailSender(sender),
		WithEmailVerificationRepository(emailRepo),
		WithEmailVerificationConfig(config.EmailVerificationConfig{
			OTPMessageTTLSeconds:     600,
			OTPResendCooldownSeconds: 60,
			OTPMaxAttempts:           5,
			OTPDailyLimitPerUser:     5,
			OTPHourlyLimitPerIP:      10,
			SecretPepper:             "email-otp-test-pepper",
		}),
	)
}

func TestStartEmailVerificationOTPSendsChallenge(t *testing.T) {
	userRepo := newFakeUserRepo()
	emailRepo := newFakeEmailVerificationRepo()
	sender := &captureEmailSender{}
	svc := newEmailVerificationTestService(userRepo, emailRepo, sender)

	user := &model.User{
		ID:        "email-user-1",
		Email:     "verify@example.com",
		FirstName: "Verify",
		LastName:  "User",
	}
	seedUser(userRepo, user)

	result, err := svc.StartEmailVerificationOTP(context.Background(), user.ID, "127.0.0.1")
	if err != nil {
		t.Fatalf("StartEmailVerificationOTP returned error: %v", err)
	}
	if result == nil || result.VerificationID == "" || result.Status != model.EmailVerificationStatusPending {
		t.Fatalf("expected pending challenge response, got %#v", result)
	}
	if result.EmailMasked == "" || !strings.Contains(result.EmailMasked, "@") {
		t.Fatalf("expected masked email in response, got %#v", result)
	}
	if len(sender.messages) != 1 {
		t.Fatalf("expected exactly one email to be dispatched, got %d", len(sender.messages))
	}

	otpCode := extractOTPCodeFromBody(sender.messages[0].Body)
	if otpCode == "" {
		t.Fatalf("expected OTP code in email body, got %q", sender.messages[0].Body)
	}
}

func TestVerifyEmailOTPMarksUserVerified(t *testing.T) {
	userRepo := newFakeUserRepo()
	emailRepo := newFakeEmailVerificationRepo()
	sender := &captureEmailSender{}
	svc := newEmailVerificationTestService(userRepo, emailRepo, sender)

	user := &model.User{
		ID:        "email-user-2",
		Email:     "verified@example.com",
		FirstName: "Verified",
		LastName:  "User",
	}
	seedUser(userRepo, user)

	pending, err := svc.StartEmailVerificationOTP(context.Background(), user.ID, "127.0.0.1")
	if err != nil {
		t.Fatalf("StartEmailVerificationOTP returned error: %v", err)
	}

	verified, err := svc.VerifyEmailOTP(context.Background(), user.ID, dto.VerifyEmailOTPRequest{
		VerificationID: pending.VerificationID,
		OTPCode:        extractOTPCodeFromBody(sender.messages[0].Body),
	})
	if err != nil {
		t.Fatalf("VerifyEmailOTP returned error: %v", err)
	}
	if !user.EmailVerified {
		t.Fatal("expected user email to be marked verified")
	}
	if verified == nil || verified.Status != model.EmailVerificationStatusVerified {
		t.Fatalf("expected verified challenge response, got %#v", verified)
	}
}

func TestVerifyEmailOTPRejectsInvalidCode(t *testing.T) {
	userRepo := newFakeUserRepo()
	emailRepo := newFakeEmailVerificationRepo()
	sender := &captureEmailSender{}
	svc := newEmailVerificationTestService(userRepo, emailRepo, sender)

	user := &model.User{
		ID:        "email-user-3",
		Email:     "invalid-otp@example.com",
		FirstName: "Invalid",
		LastName:  "OTP",
	}
	seedUser(userRepo, user)

	pending, err := svc.StartEmailVerificationOTP(context.Background(), user.ID, "127.0.0.1")
	if err != nil {
		t.Fatalf("StartEmailVerificationOTP returned error: %v", err)
	}

	_, err = svc.VerifyEmailOTP(context.Background(), user.ID, dto.VerifyEmailOTPRequest{
		VerificationID: pending.VerificationID,
		OTPCode:        "999999",
	})
	var verificationErr *EmailVerificationError
	if !errors.As(err, &verificationErr) {
		t.Fatalf("expected EmailVerificationError, got %v", err)
	}
	if !errors.Is(err, ErrEmailVerificationInvalidOTP) {
		t.Fatalf("expected ErrEmailVerificationInvalidOTP, got %v", err)
	}
	if verificationErr.RemainingAttempts != 4 {
		t.Fatalf("expected 4 attempts remaining, got %d", verificationErr.RemainingAttempts)
	}
}

func TestResendEmailVerificationOTPSendsNewCode(t *testing.T) {
	userRepo := newFakeUserRepo()
	emailRepo := newFakeEmailVerificationRepo()
	sender := &captureEmailSender{}
	svc := newEmailVerificationTestService(userRepo, emailRepo, sender)

	user := &model.User{
		ID:        "email-user-4",
		Email:     "resend@example.com",
		FirstName: "Resend",
		LastName:  "User",
	}
	seedUser(userRepo, user)

	pending, err := svc.StartEmailVerificationOTP(context.Background(), user.ID, "127.0.0.1")
	if err != nil {
		t.Fatalf("StartEmailVerificationOTP returned error: %v", err)
	}

	challenge := emailRepo.challenges[pending.VerificationID]
	if challenge == nil {
		t.Fatalf("expected stored challenge for %s", pending.VerificationID)
	}
	challenge.ResendAvailableAt = time.Now().Add(-time.Second)
	challenge.UpdatedAt = time.Now()

	firstCode := extractOTPCodeFromBody(sender.messages[0].Body)
	resent, err := svc.ResendEmailVerificationOTP(context.Background(), user.ID, "127.0.0.1", dto.ResendEmailOTPRequest{
		VerificationID: pending.VerificationID,
	})
	if err != nil {
		t.Fatalf("ResendEmailVerificationOTP returned error: %v", err)
	}
	if resent == nil || resent.Status != model.EmailVerificationStatusPending {
		t.Fatalf("expected pending challenge after resend, got %#v", resent)
	}
	if len(sender.messages) != 2 {
		t.Fatalf("expected resend to dispatch a second email, got %d", len(sender.messages))
	}
	secondCode := extractOTPCodeFromBody(sender.messages[1].Body)
	if secondCode == "" || secondCode == firstCode {
		t.Fatalf("expected resend to generate a new OTP, first=%q second=%q", firstCode, secondCode)
	}
}

func extractOTPCodeFromBody(body string) string {
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if len(trimmed) != 6 {
			continue
		}

		isDigitsOnly := true
		for _, r := range trimmed {
			if r < '0' || r > '9' {
				isDigitsOnly = false
				break
			}
		}
		if isDigitsOnly {
			return trimmed
		}
	}

	return ""
}
