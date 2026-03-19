package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

type integrationUserRepo struct {
	usersByEmail map[string]*model.User
	usersByPhone map[string]*model.User
	usersByID    map[string]*model.User
}

func newIntegrationUserRepo() *integrationUserRepo {
	return &integrationUserRepo{
		usersByEmail: map[string]*model.User{},
		usersByPhone: map[string]*model.User{},
		usersByID:    map[string]*model.User{},
	}
}

func (r *integrationUserRepo) Create(_ context.Context, user *model.User) error {
	r.usersByEmail[user.Email] = user
	if user.Phone != "" {
		r.usersByPhone[user.Phone] = user
	}
	r.usersByID[user.ID] = user
	return nil
}

func (r *integrationUserRepo) GetByID(_ context.Context, id string) (*model.User, error) {
	return r.usersByID[id], nil
}

func (r *integrationUserRepo) GetByEmail(_ context.Context, email string) (*model.User, error) {
	return r.usersByEmail[email], nil
}

func (r *integrationUserRepo) GetByPhone(_ context.Context, phone string) (*model.User, error) {
	return r.usersByPhone[phone], nil
}

func (r *integrationUserRepo) Update(_ context.Context, user *model.User) error {
	r.usersByEmail[user.Email] = user
	if user.Phone != "" {
		r.usersByPhone[user.Phone] = user
	}
	r.usersByID[user.ID] = user
	return nil
}

func TestRegisterEndpointCreatesUserAndReturnsToken(t *testing.T) {
	repo := newIntegrationUserRepo()
	userService := service.NewUserService(repo, "super-secret-test-key-1234567890", 24)
	handler := NewUserHandler(userService)

	e := echo.New()
	e.Validator = validation.New()
	handler.RegisterRoutes(e, "super-secret-test-key-1234567890")

	body, _ := json.Marshal(dto.RegisterRequest{
		Email:     "alice@example.com",
		Phone:     "0901234567",
		Password:  "password123",
		FirstName: "Alice",
		LastName:  "Nguyen",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", rec.Code, rec.Body.String())
	}

	user := repo.usersByEmail["alice@example.com"]
	if user == nil {
		t.Fatal("expected user to be created")
	}
	if user.Password == "password123" {
		t.Fatal("expected password to be hashed")
	}
}
