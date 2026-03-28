package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type fakePhoneVerificationRepo struct {
	challenges map[string]*model.PhoneVerificationChallenge
}

type fakeAddressRepo struct {
	addresses map[string]*model.Address
}

type fakeTelegramSender struct {
	lastOTPByPhone map[string]string
}

func newFakePhoneVerificationRepo() *fakePhoneVerificationRepo {
	return &fakePhoneVerificationRepo{challenges: map[string]*model.PhoneVerificationChallenge{}}
}

func newFakeAddressRepo() *fakeAddressRepo {
	return &fakeAddressRepo{addresses: map[string]*model.Address{}}
}

func newFakeTelegramSender() *fakeTelegramSender {
	return &fakeTelegramSender{lastOTPByPhone: map[string]string{}}
}

func (r *fakePhoneVerificationRepo) Create(_ context.Context, challenge *model.PhoneVerificationChallenge) error {
	r.challenges[challenge.ID] = challenge
	return nil
}

func (r *fakePhoneVerificationRepo) GetByID(_ context.Context, id string) (*model.PhoneVerificationChallenge, error) {
	return r.challenges[id], nil
}

func (r *fakePhoneVerificationRepo) GetLatestActiveByUserID(_ context.Context, userID, purpose string) (*model.PhoneVerificationChallenge, error) {
	var latest *model.PhoneVerificationChallenge
	for _, challenge := range r.challenges {
		if challenge.UserID != userID || challenge.Purpose != purpose {
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

func (r *fakePhoneVerificationRepo) Update(_ context.Context, challenge *model.PhoneVerificationChallenge) error {
	r.challenges[challenge.ID] = challenge
	return nil
}

func (r *fakePhoneVerificationRepo) DeleteExpired(_ context.Context) error {
	for id, challenge := range r.challenges {
		if challenge.ExpiresAt.Before(time.Now()) && (challenge.Status == model.PhoneVerificationStatusExpired || challenge.Status == model.PhoneVerificationStatusLocked || challenge.Status == model.PhoneVerificationStatusConsumed) {
			delete(r.challenges, id)
		}
	}
	return nil
}

func (r *fakeAddressRepo) Create(_ context.Context, addr *model.Address) error {
	r.addresses[addr.ID] = addr
	return nil
}

func (r *fakeAddressRepo) GetByID(_ context.Context, id string) (*model.Address, error) {
	return r.addresses[id], nil
}

func (r *fakeAddressRepo) GetByUserID(_ context.Context, userID string) ([]*model.Address, error) {
	addresses := make([]*model.Address, 0)
	for _, address := range r.addresses {
		if address.UserID == userID {
			addresses = append(addresses, address)
		}
	}
	return addresses, nil
}

func (r *fakeAddressRepo) Update(_ context.Context, addr *model.Address) error {
	r.addresses[addr.ID] = addr
	return nil
}

func (r *fakeAddressRepo) Delete(_ context.Context, id string) error {
	delete(r.addresses, id)
	return nil
}

func (r *fakeAddressRepo) ClearDefault(_ context.Context, userID string) error {
	for _, address := range r.addresses {
		if address.UserID == userID {
			address.IsDefault = false
		}
	}
	return nil
}

func (r *fakeAddressRepo) CountByUserID(_ context.Context, userID string) (int, error) {
	count := 0
	for _, address := range r.addresses {
		if address.UserID == userID {
			count++
		}
	}
	return count, nil
}

func (s *fakeTelegramSender) SendOTP(_ string, phone string, otpCode string, _ time.Duration) error {
	s.lastOTPByPhone[phone] = otpCode
	return nil
}

func seedUser(repo *fakeUserRepo, user *model.User) {
	repo.usersByID[user.ID] = user
	repo.usersByEmail[user.Email] = user
	if user.Phone != "" {
		repo.usersByPhone[user.Phone] = user
	}
}

func newPhoneVerificationTestService(userRepo *fakeUserRepo, phoneRepo *fakePhoneVerificationRepo, addressRepo *fakeAddressRepo, sender *fakeTelegramSender) *UserService {
	return NewUserService(
		userRepo,
		testSecret,
		24,
		WithPhoneVerificationRepository(phoneRepo),
		WithAddressService(NewAddressService(addressRepo)),
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

func TestStartPhoneVerificationAndVerifyOTP(t *testing.T) {
	userRepo := newFakeUserRepo()
	phoneRepo := newFakePhoneVerificationRepo()
	addressRepo := newFakeAddressRepo()
	sender := newFakeTelegramSender()
	svc := newPhoneVerificationTestService(userRepo, phoneRepo, addressRepo, sender)

	user := &model.User{
		ID:        "user-1",
		Email:     "phone@example.com",
		Phone:     "0912345678",
		FirstName: "Phone",
		LastName:  "User",
	}
	seedUser(userRepo, user)

	result, err := svc.StartPhoneVerification(context.Background(), user.ID, "127.0.0.1", dto.SendPhoneOTPRequest{
		Phone:          "0987654321",
		TelegramChatID: "123456789",
	})
	if err != nil {
		t.Fatalf("StartPhoneVerification returned error: %v", err)
	}
	if result == nil || result.VerificationID == "" || result.Status != model.PhoneVerificationStatusPending {
		t.Fatalf("expected pending challenge response, got %#v", result)
	}

	otpCode := sender.lastOTPByPhone["0987654321"]
	if otpCode == "" {
		t.Fatal("expected OTP to be dispatched through telegram sender")
	}

	verified, err := svc.VerifyPhoneOTP(context.Background(), user.ID, dto.VerifyPhoneOTPRequest{
		VerificationID: result.VerificationID,
		OTPCode:        otpCode,
	})
	if err != nil {
		t.Fatalf("VerifyPhoneOTP returned error: %v", err)
	}
	if verified.Status != model.PhoneVerificationStatusVerified {
		t.Fatalf("expected verified status, got %#v", verified)
	}
	if verified.VerifiedAt == nil {
		t.Fatal("expected verified_at to be populated")
	}
}

func TestVerifyPhoneOTPWrongCodeDecrementsAttempts(t *testing.T) {
	userRepo := newFakeUserRepo()
	phoneRepo := newFakePhoneVerificationRepo()
	addressRepo := newFakeAddressRepo()
	sender := newFakeTelegramSender()
	svc := newPhoneVerificationTestService(userRepo, phoneRepo, addressRepo, sender)

	user := &model.User{
		ID:        "user-2",
		Email:     "attempts@example.com",
		Phone:     "0912345678",
		FirstName: "Attempts",
		LastName:  "User",
	}
	seedUser(userRepo, user)

	result, err := svc.StartPhoneVerification(context.Background(), user.ID, "127.0.0.1", dto.SendPhoneOTPRequest{
		Phone:          "0987654322",
		TelegramChatID: "123456789",
	})
	if err != nil {
		t.Fatalf("StartPhoneVerification returned error: %v", err)
	}

	_, err = svc.VerifyPhoneOTP(context.Background(), user.ID, dto.VerifyPhoneOTPRequest{
		VerificationID: result.VerificationID,
		OTPCode:        "000000",
	})
	if !errors.Is(err, ErrPhoneVerificationInvalidOTP) {
		t.Fatalf("expected ErrPhoneVerificationInvalidOTP, got %v", err)
	}

	var verificationErr *PhoneVerificationError
	if !errors.As(err, &verificationErr) {
		t.Fatalf("expected PhoneVerificationError, got %T", err)
	}
	if verificationErr.RemainingAttempts != 4 {
		t.Fatalf("expected 4 remaining attempts, got %d", verificationErr.RemainingAttempts)
	}
}

func TestResendPhoneOTPRespectsCooldownAndRotatesCode(t *testing.T) {
	userRepo := newFakeUserRepo()
	phoneRepo := newFakePhoneVerificationRepo()
	addressRepo := newFakeAddressRepo()
	sender := newFakeTelegramSender()
	svc := newPhoneVerificationTestService(userRepo, phoneRepo, addressRepo, sender)

	user := &model.User{
		ID:        "user-3",
		Email:     "resend@example.com",
		Phone:     "0912345678",
		FirstName: "Resend",
		LastName:  "User",
	}
	seedUser(userRepo, user)

	result, err := svc.StartPhoneVerification(context.Background(), user.ID, "127.0.0.1", dto.SendPhoneOTPRequest{
		Phone:          "0987654323",
		TelegramChatID: "123456789",
	})
	if err != nil {
		t.Fatalf("StartPhoneVerification returned error: %v", err)
	}

	_, err = svc.ResendPhoneOTP(context.Background(), user.ID, "127.0.0.1", dto.ResendPhoneOTPRequest{
		VerificationID: result.VerificationID,
	})
	if !errors.Is(err, ErrPhoneVerificationResendTooSoon) {
		t.Fatalf("expected ErrPhoneVerificationResendTooSoon, got %v", err)
	}

	challenge := phoneRepo.challenges[result.VerificationID]
	challenge.ResendAvailableAt = time.Now().Add(-time.Second)
	previousOTP := sender.lastOTPByPhone[challenge.PhoneCandidate]

	resent, err := svc.ResendPhoneOTP(context.Background(), user.ID, "127.0.0.1", dto.ResendPhoneOTPRequest{
		VerificationID: result.VerificationID,
	})
	if err != nil {
		t.Fatalf("ResendPhoneOTP returned error: %v", err)
	}
	if resent.Status != model.PhoneVerificationStatusPending {
		t.Fatalf("expected pending status after resend, got %#v", resent)
	}
	if sender.lastOTPByPhone[challenge.PhoneCandidate] == previousOTP {
		t.Fatal("expected resend to rotate OTP code")
	}
}

func TestUpdateProfileRequiresVerifiedChallengeForPhoneChange(t *testing.T) {
	userRepo := newFakeUserRepo()
	phoneRepo := newFakePhoneVerificationRepo()
	addressRepo := newFakeAddressRepo()
	sender := newFakeTelegramSender()
	svc := newPhoneVerificationTestService(userRepo, phoneRepo, addressRepo, sender)

	user := &model.User{
		ID:            "user-4",
		Email:         "profile-required@example.com",
		Phone:         "0912345678",
		PhoneVerified: true,
		FirstName:     "Profile",
		LastName:      "Required",
	}
	seedUser(userRepo, user)

	_, err := svc.UpdateProfile(context.Background(), user.ID, dto.UpdateProfileRequest{
		FirstName: "Updated",
		LastName:  "User",
		Phone:     "0987654324",
		DefaultAddress: &dto.ProfileAddressInput{
			RecipientName: "Updated User",
			Phone:         "0987654324",
			Street:        "123 Nguyen Trai",
			Ward:          "Phuong 1",
			District:      "Quan 5",
			City:          "TP HCM",
		},
	})
	if !errors.Is(err, ErrPhoneVerificationRequired) {
		t.Fatalf("expected ErrPhoneVerificationRequired, got %v", err)
	}
}

func TestUpdateProfileConsumesVerifiedChallengeAndUpsertsDefaultAddress(t *testing.T) {
	userRepo := newFakeUserRepo()
	phoneRepo := newFakePhoneVerificationRepo()
	addressRepo := newFakeAddressRepo()
	sender := newFakeTelegramSender()
	svc := newPhoneVerificationTestService(userRepo, phoneRepo, addressRepo, sender)

	user := &model.User{
		ID:            "user-5",
		Email:         "profile-success@example.com",
		Phone:         "0912345678",
		PhoneVerified: true,
		FirstName:     "Before",
		LastName:      "Profile",
	}
	seedUser(userRepo, user)

	startResult, err := svc.StartPhoneVerification(context.Background(), user.ID, "127.0.0.1", dto.SendPhoneOTPRequest{
		Phone:          "0987654325",
		TelegramChatID: "123456789",
	})
	if err != nil {
		t.Fatalf("StartPhoneVerification returned error: %v", err)
	}

	otpCode := sender.lastOTPByPhone["0987654325"]
	if _, err := svc.VerifyPhoneOTP(context.Background(), user.ID, dto.VerifyPhoneOTPRequest{
		VerificationID: startResult.VerificationID,
		OTPCode:        otpCode,
	}); err != nil {
		t.Fatalf("VerifyPhoneOTP returned error: %v", err)
	}

	updatedUser, err := svc.UpdateProfile(context.Background(), user.ID, dto.UpdateProfileRequest{
		FirstName:           "  After ",
		LastName:            "  Update ",
		Phone:               "0987654325",
		PhoneVerificationID: startResult.VerificationID,
		DefaultAddress: &dto.ProfileAddressInput{
			RecipientName: "After Update",
			Phone:         "0901122334",
			Street:        "123 Nguyen Trai",
			Ward:          "Phuong 1",
			District:      "Quan 5",
			City:          "TP HCM",
		},
	})
	if err != nil {
		t.Fatalf("UpdateProfile returned error: %v", err)
	}
	if updatedUser.Phone != "0987654325" {
		t.Fatalf("expected updated phone, got %q", updatedUser.Phone)
	}
	if !updatedUser.PhoneVerified || updatedUser.PhoneVerifiedAt == nil || updatedUser.PhoneLastChangedAt == nil {
		t.Fatalf("expected verified phone metadata to be populated, got %#v", updatedUser)
	}
	if updatedUser.FirstName != "After" || updatedUser.LastName != "Update" {
		t.Fatalf("expected normalized names, got %#v", updatedUser)
	}

	challenge := phoneRepo.challenges[startResult.VerificationID]
	if challenge.Status != model.PhoneVerificationStatusConsumed || challenge.ConsumedAt == nil {
		t.Fatalf("expected challenge to be consumed, got %#v", challenge)
	}

	addresses, err := addressRepo.GetByUserID(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("GetByUserID returned error: %v", err)
	}
	if len(addresses) != 1 {
		t.Fatalf("expected one default address, got %d", len(addresses))
	}
	if !addresses[0].IsDefault || addresses[0].RecipientName != "After Update" || addresses[0].Phone != "0901122334" {
		t.Fatalf("expected upserted default address, got %#v", addresses[0])
	}
}
