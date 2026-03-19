package service

import (
	"context"
	"testing"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type fakeUserRepo struct {
	usersByEmail map[string]*model.User
	usersByID    map[string]*model.User
}

func newFakeUserRepo() *fakeUserRepo {
	return &fakeUserRepo{
		usersByEmail: map[string]*model.User{},
		usersByID:    map[string]*model.User{},
	}
}

func (r *fakeUserRepo) Create(_ context.Context, user *model.User) error {
	r.usersByEmail[user.Email] = user
	r.usersByID[user.ID] = user
	return nil
}

func (r *fakeUserRepo) GetByID(_ context.Context, id string) (*model.User, error) {
	return r.usersByID[id], nil
}

func (r *fakeUserRepo) GetByEmail(_ context.Context, email string) (*model.User, error) {
	return r.usersByEmail[email], nil
}

func (r *fakeUserRepo) Update(_ context.Context, user *model.User) error {
	r.usersByEmail[user.Email] = user
	r.usersByID[user.ID] = user
	return nil
}

func TestRegisterHashesPasswordAndReturnsToken(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, "super-secret-test-key-1234567890", 24)

	resp, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "alice@example.com",
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
		t.Fatal("expected JWT token to be returned")
	}
	if user.Role != "user" {
		t.Fatalf("expected default role user, got %q", user.Role)
	}
}

func TestLoginRejectsInvalidPassword(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo, "super-secret-test-key-1234567890", 24)

	if _, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "bob@example.com",
		Password:  "password123",
		FirstName: "Bob",
		LastName:  "Tran",
	}); err != nil {
		t.Fatalf("Register returned error: %v", err)
	}

	if _, err := svc.Login(context.Background(), dto.LoginRequest{
		Email:    "bob@example.com",
		Password: "wrong-password",
	}); err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}
