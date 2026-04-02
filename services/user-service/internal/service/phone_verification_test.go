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
	addresses        map[string]*model.Address
	getByUserIDCalls int
}

type fakeTelegramSender struct {
	lastOTPByPhone map[string]string
	resolvedChatID string
}

func newFakePhoneVerificationRepo() *fakePhoneVerificationRepo {
	return &fakePhoneVerificationRepo{challenges: map[string]*model.PhoneVerificationChallenge{}}
}

func newFakeAddressRepo() *fakeAddressRepo {
	return &fakeAddressRepo{addresses: map[string]*model.Address{}}
}

func newFakeTelegramSender() *fakeTelegramSender {
	return &fakeTelegramSender{
		lastOTPByPhone: map[string]string{},
		resolvedChatID: "123456789",
	}
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
	r.getByUserIDCalls++
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

func (s *fakeTelegramSender) ResolveChatID(_ context.Context) (string, error) {
	return s.resolvedChatID, nil
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

	result, err := svc.StartPhoneVerification(context.Background(), user.ID, "127.0.0.1", dto.SendPhoneOTPRequest{Phone: "0987654321"})
	if err != nil {
		t.Fatalf("StartPhoneVerification returned error: %v", err)
	}
	if result == nil || result.VerificationID == "" || result.Status != model.PhoneVerificationStatusPending {
		t.Fatalf("expected pending challenge response, got %#v", result)
	}
	if phoneRepo.challenges[result.VerificationID].TelegramChatID != sender.resolvedChatID {
		t.Fatalf("expected resolved telegram chat id to be persisted, got %#v", phoneRepo.challenges[result.VerificationID])
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

func TestUpdateProfileSkipsAddressLookupForEmptyAddressPatch(t *testing.T) {
	userRepo := newFakeUserRepo()
	phoneRepo := newFakePhoneVerificationRepo()
	addressRepo := newFakeAddressRepo()
	sender := newFakeTelegramSender()
	svc := newPhoneVerificationTestService(userRepo, phoneRepo, addressRepo, sender)

	user := &model.User{
		ID:        "user-empty-address",
		Email:     "empty-address@example.com",
		Phone:     "0912345678",
		FirstName: "Empty",
		LastName:  "Patch",
	}
	seedUser(userRepo, user)

	empty := "   "
	updatedUser, err := svc.UpdateProfile(context.Background(), user.ID, dto.UpdateProfileRequest{
		DefaultAddress: &dto.UpdateProfileAddressInput{
			Street: &empty,
		},
	})
	if err != nil {
		t.Fatalf("UpdateProfile returned error: %v", err)
	}
	if updatedUser.ID != user.ID {
		t.Fatalf("expected the same user to be returned, got %#v", updatedUser)
	}
	if addressRepo.getByUserIDCalls != 0 {
		t.Fatalf("expected empty address patch to skip address lookup, got %d lookup(s)", addressRepo.getByUserIDCalls)
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

	result, err := svc.StartPhoneVerification(context.Background(), user.ID, "127.0.0.1", dto.SendPhoneOTPRequest{Phone: "0987654322"})
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

	result, err := svc.StartPhoneVerification(context.Background(), user.ID, "127.0.0.1", dto.SendPhoneOTPRequest{Phone: "0987654323"})
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

	phone := "0987654324"
	_, err := svc.UpdateProfile(context.Background(), user.ID, dto.UpdateProfileRequest{
		Phone: &phone,
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

	startResult, err := svc.StartPhoneVerification(context.Background(), user.ID, "127.0.0.1", dto.SendPhoneOTPRequest{Phone: "0987654325"})
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

	firstName := "  After "
	lastName := "  Update "
	phone := "0987654325"
	updatedUser, err := svc.UpdateProfile(context.Background(), user.ID, dto.UpdateProfileRequest{
		FirstName:           &firstName,
		LastName:            &lastName,
		Phone:               &phone,
		PhoneVerificationID: startResult.VerificationID,
		DefaultAddress: &dto.UpdateProfileAddressInput{
			RecipientName: stringPtr("After Update"),
			Phone:         stringPtr("0901122334"),
			Street:        stringPtr("123 Nguyen Trai"),
			Ward:          stringPtr("Phuong 1"),
			District:      stringPtr("Quan 5"),
			City:          stringPtr("TP HCM"),
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

func TestUpdateProfileAllowsPhoneOnlyChange(t *testing.T) {
	userRepo := newFakeUserRepo()
	phoneRepo := newFakePhoneVerificationRepo()
	addressRepo := newFakeAddressRepo()
	sender := newFakeTelegramSender()
	svc := newPhoneVerificationTestService(userRepo, phoneRepo, addressRepo, sender)

	user := &model.User{
		ID:            "user-6",
		Email:         "phone-only@example.com",
		Phone:         "0912345678",
		PhoneVerified: true,
		FirstName:     "Phone",
		LastName:      "Only",
	}
	seedUser(userRepo, user)

	startResult, err := svc.StartPhoneVerification(context.Background(), user.ID, "127.0.0.1", dto.SendPhoneOTPRequest{Phone: "0987654326"})
	if err != nil {
		t.Fatalf("StartPhoneVerification returned error: %v", err)
	}

	if _, err := svc.VerifyPhoneOTP(context.Background(), user.ID, dto.VerifyPhoneOTPRequest{
		VerificationID: startResult.VerificationID,
		OTPCode:        sender.lastOTPByPhone["0987654326"],
	}); err != nil {
		t.Fatalf("VerifyPhoneOTP returned error: %v", err)
	}

	phone := "0987654326"
	updatedUser, err := svc.UpdateProfile(context.Background(), user.ID, dto.UpdateProfileRequest{
		Phone:               &phone,
		PhoneVerificationID: startResult.VerificationID,
	})
	if err != nil {
		t.Fatalf("UpdateProfile returned error: %v", err)
	}

	if updatedUser.Phone != "0987654326" || updatedUser.FirstName != "Phone" || updatedUser.LastName != "Only" {
		t.Fatalf("expected phone-only update to preserve identity fields, got %#v", updatedUser)
	}
	if addresses, err := addressRepo.GetByUserID(context.Background(), user.ID); err != nil {
		t.Fatalf("GetByUserID returned error: %v", err)
	} else if len(addresses) != 0 {
		t.Fatalf("expected phone-only update to leave addresses untouched, got %#v", addresses)
	}
}

func TestUpdateProfileAllowsAddressOnlyChangeWithoutMutatingPhone(t *testing.T) {
	userRepo := newFakeUserRepo()
	phoneRepo := newFakePhoneVerificationRepo()
	addressRepo := newFakeAddressRepo()
	sender := newFakeTelegramSender()
	svc := newPhoneVerificationTestService(userRepo, phoneRepo, addressRepo, sender)

	user := &model.User{
		ID:            "user-7",
		Email:         "address-only@example.com",
		Phone:         "0912345678",
		PhoneVerified: true,
		FirstName:     "Address",
		LastName:      "Only",
	}
	seedUser(userRepo, user)

	addressRepo.addresses["addr-1"] = &model.Address{
		ID:            "addr-1",
		UserID:        user.ID,
		RecipientName: "Old Recipient",
		Phone:         "0901122334",
		Street:        "12 Old Street",
		Ward:          "Phuong Cu",
		District:      "Quan 1",
		City:          "TP HCM",
		IsDefault:     true,
		CreatedAt:     time.Now().Add(-time.Hour),
		UpdatedAt:     time.Now().Add(-time.Hour),
	}

	updatedUser, err := svc.UpdateProfile(context.Background(), user.ID, dto.UpdateProfileRequest{
		DefaultAddress: &dto.UpdateProfileAddressInput{
			RecipientName: stringPtr("New Recipient"),
			Street:        stringPtr("34 New Street"),
			City:          stringPtr("Da Nang"),
		},
	})
	if err != nil {
		t.Fatalf("UpdateProfile returned error: %v", err)
	}
	if updatedUser.Phone != "0912345678" || updatedUser.FirstName != "Address" || updatedUser.LastName != "Only" {
		t.Fatalf("expected address-only update to preserve profile fields, got %#v", updatedUser)
	}

	addresses, err := addressRepo.GetByUserID(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("GetByUserID returned error: %v", err)
	}
	if len(addresses) != 1 {
		t.Fatalf("expected one address after address-only update, got %d", len(addresses))
	}
	if addresses[0].Phone != "0901122334" || addresses[0].District != "Quan 1" || addresses[0].Ward != "Phuong Cu" {
		t.Fatalf("expected omitted address fields to be preserved, got %#v", addresses[0])
	}
	if addresses[0].RecipientName != "New Recipient" || addresses[0].Street != "34 New Street" || addresses[0].City != "Da Nang" {
		t.Fatalf("expected requested address fields to be updated, got %#v", addresses[0])
	}
}

func stringPtr(value string) *string {
	return &value
}
