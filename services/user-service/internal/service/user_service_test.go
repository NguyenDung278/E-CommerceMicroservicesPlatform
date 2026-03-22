package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/email"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type fakeUserRepo struct {
	usersByEmail map[string]*model.User
	usersByPhone map[string]*model.User
	usersByID    map[string]*model.User
}

type fakeEmailSender struct {
	err error
}

func (s *fakeEmailSender) Send(_ email.Message) error {
	return s.err
}

func newFakeUserRepo() *fakeUserRepo {
	return &fakeUserRepo{
		usersByEmail: map[string]*model.User{},
		usersByPhone: map[string]*model.User{},
		usersByID:    map[string]*model.User{},
	}
}

func (r *fakeUserRepo) Create(_ context.Context, user *model.User) error {
	r.usersByEmail[user.Email] = user
	if user.Phone != "" {
		r.usersByPhone[user.Phone] = user
	}
	r.usersByID[user.ID] = user
	return nil
}

func (r *fakeUserRepo) GetByID(_ context.Context, id string) (*model.User, error) {
	return r.usersByID[id], nil
}

func (r *fakeUserRepo) GetByEmail(_ context.Context, email string) (*model.User, error) {
	return r.usersByEmail[email], nil
}

func (r *fakeUserRepo) GetByPhone(_ context.Context, phone string) (*model.User, error) {
	return r.usersByPhone[phone], nil
}

func (r *fakeUserRepo) GetByEmailVerificationTokenHash(_ context.Context, tokenHash string) (*model.User, error) {
	for _, user := range r.usersByID {
		if user.EmailVerificationTokenHash == tokenHash {
			return user, nil
		}
	}
	return nil, nil
}

func (r *fakeUserRepo) GetByPasswordResetTokenHash(_ context.Context, tokenHash string) (*model.User, error) {
	for _, user := range r.usersByID {
		if user.PasswordResetTokenHash == tokenHash {
			return user, nil
		}
	}
	return nil, nil
}

func (r *fakeUserRepo) List(_ context.Context) ([]*model.User, error) {
	users := make([]*model.User, 0, len(r.usersByID))
	for _, user := range r.usersByID {
		users = append(users, user)
	}
	return users, nil
}

func (r *fakeUserRepo) Update(_ context.Context, user *model.User) error {
	r.usersByEmail[user.Email] = user
	if user.Phone != "" {
		r.usersByPhone[user.Phone] = user
	}
	r.usersByID[user.ID] = user
	return nil
}

const testSecret = "super-secret-test-key-1234567890"

func TestRegisterHashesPasswordAndReturnsToken(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, testSecret, 24)

	resp, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "alice@example.com",
		Phone:     "0901234567",
		Password:  "password123",
		FirstName: "Alice",
		LastName:  "Nguyen",
	})
	if err != nil {
		t.Fatalf("Register returned error: %v", err)
	}

	user := repo.usersByEmail["alice@example.com"]
	if user == nil {
		t.Fatal("expected user to be stored in repository")
	}
	if user.Password == "password123" {
		t.Fatal("expected password to be hashed before storing")
	}
	if resp.Token == "" {
		t.Fatal("expected JWT access token to be returned")
	}
	if resp.RefreshToken == "" {
		t.Fatal("expected JWT refresh token to be returned")
	}
	if user.Role != "user" {
		t.Fatalf("expected default role user, got %q", user.Role)
	}
	if user.EmailVerified {
		t.Fatal("expected email to be unverified right after registration")
	}
	if user.EmailVerificationTokenHash == "" || user.EmailVerificationExpiresAt == nil {
		t.Fatal("expected email verification token fields to be populated")
	}
}

func TestLoginRejectsInvalidPassword(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, testSecret, 24)

	if _, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "bob@example.com",
		Phone:     "0912345678",
		Password:  "password123",
		FirstName: "Bob",
		LastName:  "Tran",
	}); err != nil {
		t.Fatalf("Register returned error: %v", err)
	}

	if _, err := svc.Login(context.Background(), dto.LoginRequest{
		Identifier: "bob@example.com",
		Password:   "wrong-password",
	}); err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestLoginReturnsRefreshToken(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, testSecret, 24)

	if _, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "charlie@example.com",
		Phone:     "0923456789",
		Password:  "password123",
		FirstName: "Charlie",
		LastName:  "Le",
	}); err != nil {
		t.Fatalf("Register returned error: %v", err)
	}

	resp, err := svc.Login(context.Background(), dto.LoginRequest{
		Identifier: "charlie@example.com",
		Password:   "password123",
	})
	if err != nil {
		t.Fatalf("Login returned error: %v", err)
	}
	if resp.RefreshToken == "" {
		t.Fatal("expected refresh token to be returned on login")
	}
	if resp.Token == resp.RefreshToken {
		t.Fatal("access token and refresh token should be different")
	}
}

func TestChangePasswordSuccess(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, testSecret, 24)

	// Register a user.
	resp, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "dave@example.com",
		Phone:     "0934567890",
		Password:  "oldpassword1",
		FirstName: "Dave",
		LastName:  "Pham",
	})
	if err != nil {
		t.Fatalf("Register returned error: %v", err)
	}

	// Extract the user ID from the response.
	user := repo.usersByEmail["dave@example.com"]
	_ = resp

	// Change the password.
	err = svc.ChangePassword(context.Background(), user.ID, dto.ChangePasswordRequest{
		CurrentPassword: "oldpassword1",
		NewPassword:     "newpassword2",
	})
	if err != nil {
		t.Fatalf("ChangePassword returned error: %v", err)
	}

	// Login with old password should fail.
	if _, err := svc.Login(context.Background(), dto.LoginRequest{
		Identifier: "dave@example.com",
		Password:   "oldpassword1",
	}); err != ErrInvalidCredentials {
		t.Fatalf("expected old password to fail login, got: %v", err)
	}

	// Login with new password should succeed.
	if _, err := svc.Login(context.Background(), dto.LoginRequest{
		Identifier: "dave@example.com",
		Password:   "newpassword2",
	}); err != nil {
		t.Fatalf("login with new password should succeed, got: %v", err)
	}
}

func TestChangePasswordWithWrongOldPassword(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, testSecret, 24)

	resp, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "eve@example.com",
		Phone:     "0945678901",
		Password:  "mypassword1",
		FirstName: "Eve",
		LastName:  "Vo",
	})
	if err != nil {
		t.Fatalf("Register returned error: %v", err)
	}

	user := repo.usersByEmail["eve@example.com"]
	_ = resp

	err = svc.ChangePassword(context.Background(), user.ID, dto.ChangePasswordRequest{
		CurrentPassword: "wrong-old-password",
		NewPassword:     "newpassword2",
	})
	if err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials for wrong old password, got: %v", err)
	}
}

func TestRefreshTokenReturnsNewPair(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, testSecret, 24)

	// Register to get initial tokens.
	registerResp, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "frank@example.com",
		Phone:     "0956789012",
		Password:  "password123",
		FirstName: "Frank",
		LastName:  "Bui",
	})
	if err != nil {
		t.Fatalf("Register returned error: %v", err)
	}

	// Use the refresh token to get a new pair.
	refreshResp, err := svc.RefreshToken(context.Background(), registerResp.RefreshToken)
	if err != nil {
		t.Fatalf("RefreshToken returned error: %v", err)
	}

	if refreshResp.Token == "" {
		t.Fatal("expected new access token")
	}
	if refreshResp.RefreshToken == "" {
		t.Fatal("expected new refresh token")
	}

	// Verify the new access token can be used as a basis for another refresh — proving
	// the returned tokens are valid and the user still resolves correctly.
	secondRefresh, err := svc.RefreshToken(context.Background(), refreshResp.RefreshToken)
	if err != nil {
		t.Fatalf("second RefreshToken returned error: %v", err)
	}
	if secondRefresh.Token == "" || secondRefresh.RefreshToken == "" {
		t.Fatal("expected valid tokens from second refresh")
	}
}

func TestRegisterSucceedsWhenVerificationEmailDeliveryFails(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(
		repo,
		testSecret,
		24,
		WithEmailSender(&fakeEmailSender{err: errors.New("smtp unavailable")}),
	)

	resp, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "grace@example.com",
		Password:  "password123",
		FirstName: "Grace",
		LastName:  "Ho",
	})
	if err != nil {
		t.Fatalf("Register returned error: %v", err)
	}

	if resp == nil || resp.Token == "" {
		t.Fatal("expected register to still return auth response")
	}
	if repo.usersByEmail["grace@example.com"] == nil {
		t.Fatal("expected user to be stored even when email delivery fails")
	}
}

func TestForgotPasswordSucceedsWhenEmailDeliveryFails(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(
		repo,
		testSecret,
		24,
		WithEmailSender(&fakeEmailSender{err: errors.New("smtp unavailable")}),
	)

	if _, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "harry@example.com",
		Password:  "password123",
		FirstName: "Harry",
		LastName:  "Tran",
	}); err != nil {
		t.Fatalf("Register returned error: %v", err)
	}

	if err := svc.ForgotPassword(context.Background(), "harry@example.com"); err != nil {
		t.Fatalf("ForgotPassword returned error: %v", err)
	}
}

func TestRefreshTokenRejectsInvalidToken(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, testSecret, 24)

	_, err := svc.RefreshToken(context.Background(), "invalid.token.string")
	if err != ErrInvalidToken {
		t.Fatalf("expected ErrInvalidToken for garbage token, got: %v", err)
	}
}

func TestVerifyEmailMarksUserVerified(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, testSecret, 24)

	if _, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "verified@example.com",
		Phone:     "0967890123",
		Password:  "password123",
		FirstName: "Verified",
		LastName:  "User",
	}); err != nil {
		t.Fatalf("Register returned error: %v", err)
	}

	user := repo.usersByEmail["verified@example.com"]
	rawToken := "verify-token"
	expiresAt := time.Now().Add(time.Hour)
	user.EmailVerificationTokenHash = hashToken(rawToken)
	user.EmailVerificationExpiresAt = &expiresAt

	if err := svc.VerifyEmail(context.Background(), rawToken); err != nil {
		t.Fatalf("VerifyEmail returned error: %v", err)
	}
	if !user.EmailVerified {
		t.Fatal("expected email to be marked verified")
	}
	if user.EmailVerificationTokenHash != "" || user.EmailVerificationExpiresAt != nil {
		t.Fatal("expected verification token state to be cleared")
	}
}

func TestResetPasswordClearsResetToken(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, testSecret, 24)

	if _, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "reset@example.com",
		Phone:     "0978901234",
		Password:  "password123",
		FirstName: "Reset",
		LastName:  "User",
	}); err != nil {
		t.Fatalf("Register returned error: %v", err)
	}

	user := repo.usersByEmail["reset@example.com"]
	rawToken := "reset-token"
	expiresAt := time.Now().Add(time.Hour)
	user.PasswordResetTokenHash = hashToken(rawToken)
	user.PasswordResetExpiresAt = &expiresAt

	if err := svc.ResetPassword(context.Background(), rawToken, "newpassword2"); err != nil {
		t.Fatalf("ResetPassword returned error: %v", err)
	}
	if user.PasswordResetTokenHash != "" || user.PasswordResetExpiresAt != nil {
		t.Fatal("expected reset token state to be cleared")
	}
	if _, err := svc.Login(context.Background(), dto.LoginRequest{
		Identifier: "reset@example.com",
		Password:   "newpassword2",
	}); err != nil {
		t.Fatalf("expected login with reset password to succeed, got: %v", err)
	}
}

func TestUpdateUserRoleSupportsStaff(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, testSecret, 24)

	if _, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "staff@example.com",
		Phone:     "0989012345",
		Password:  "password123",
		FirstName: "Staff",
		LastName:  "Member",
	}); err != nil {
		t.Fatalf("Register returned error: %v", err)
	}

	user := repo.usersByEmail["staff@example.com"]
	updated, err := svc.UpdateUserRole(context.Background(), user.ID, "staff")
	if err != nil {
		t.Fatalf("UpdateUserRole returned error: %v", err)
	}
	if updated.Role != "staff" {
		t.Fatalf("expected role staff, got %q", updated.Role)
	}
}
