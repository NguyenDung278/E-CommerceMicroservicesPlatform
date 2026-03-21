package service

import (
	"context"
	"testing"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type fakeUserRepo struct {
	usersByEmail map[string]*model.User
	usersByPhone map[string]*model.User
	usersByID    map[string]*model.User
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

func TestRefreshTokenRejectsInvalidToken(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, testSecret, 24)

	_, err := svc.RefreshToken(context.Background(), "invalid.token.string")
	if err != ErrInvalidToken {
		t.Fatalf("expected ErrInvalidToken for garbage token, got: %v", err)
	}
}
