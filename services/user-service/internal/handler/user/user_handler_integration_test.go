package userhandler

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service/account"
)

type integrationUserRepo struct {
	usersByEmail map[string]*model.User
	usersByPhone map[string]*model.User
	usersByID    map[string]*model.User
}

type integrationUserAvatarRepo struct {
	avatars map[string]*model.UserAvatar
}

func newIntegrationUserRepo() *integrationUserRepo {
	return &integrationUserRepo{
		usersByEmail: map[string]*model.User{},
		usersByPhone: map[string]*model.User{},
		usersByID:    map[string]*model.User{},
	}
}

func newIntegrationUserAvatarRepo() *integrationUserAvatarRepo {
	return &integrationUserAvatarRepo{
		avatars: map[string]*model.UserAvatar{},
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

func (r *integrationUserRepo) GetByEmailVerificationTokenHash(_ context.Context, tokenHash string) (*model.User, error) {
	for _, user := range r.usersByID {
		if user.EmailVerificationTokenHash == tokenHash {
			return user, nil
		}
	}
	return nil, nil
}

func (r *integrationUserRepo) GetByPasswordResetTokenHash(_ context.Context, tokenHash string) (*model.User, error) {
	for _, user := range r.usersByID {
		if user.PasswordResetTokenHash == tokenHash {
			return user, nil
		}
	}
	return nil, nil
}

func (r *integrationUserRepo) List(_ context.Context) ([]*model.User, error) {
	users := make([]*model.User, 0, len(r.usersByID))
	for _, user := range r.usersByID {
		users = append(users, user)
	}
	return users, nil
}

func (r *integrationUserRepo) Update(_ context.Context, user *model.User) error {
	r.usersByEmail[user.Email] = user
	if user.Phone != "" {
		r.usersByPhone[user.Phone] = user
	}
	r.usersByID[user.ID] = user
	return nil
}

func (r *integrationUserAvatarRepo) GetByUserID(_ context.Context, userID string) (*model.UserAvatar, error) {
	return r.avatars[userID], nil
}

func (r *integrationUserAvatarRepo) Upsert(_ context.Context, avatar *model.UserAvatar) error {
	r.avatars[avatar.UserID] = avatar
	return nil
}

func TestRegisterEndpointCreatesUserAndReturnsToken(t *testing.T) {
	repo := newIntegrationUserRepo()
	userService := account.NewUserService(repo, "super-secret-test-key-1234567890", 24)
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

func TestUploadAvatarEndpointStoresAvatarAndReturnsProfile(t *testing.T) {
	repo := newIntegrationUserRepo()
	avatarRepo := newIntegrationUserAvatarRepo()
	userService := account.NewUserService(
		repo,
		"super-secret-test-key-1234567890",
		24,
		account.WithUserAvatarRepository(avatarRepo),
	)
	handler := NewUserHandler(userService)

	user := &model.User{
		ID:        "user-upload-avatar",
		Email:     "avatar@example.com",
		FirstName: "Avatar",
		LastName:  "Owner",
	}
	repo.usersByID[user.ID] = user
	repo.usersByEmail[user.Email] = user

	e := echo.New()
	e.Validator = validation.New()
	handler.RegisterRoutes(e, "super-secret-test-key-1234567890")

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("avatar", "avatar.png")
	if err != nil {
		t.Fatalf("failed to create multipart part: %v", err)
	}
	if _, err := part.Write([]byte("\x89PNG\r\n\x1a\nmock-avatar")); err != nil {
		t.Fatalf("failed to write multipart body: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users/avatar", &body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+mustSignTestToken(t, user.ID, user.Email))
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", rec.Code, rec.Body.String())
	}

	if avatarRepo.avatars[user.ID] == nil {
		t.Fatal("expected uploaded avatar to be stored")
	}

	var responseBody struct {
		Success bool                     `json:"success"`
		Data    dto.UploadAvatarResponse `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &responseBody); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !responseBody.Success {
		t.Fatalf("expected successful response, got %s", rec.Body.String())
	}
	if responseBody.Data.AvatarURL == "" || responseBody.Data.User == nil || responseBody.Data.User.AvatarURL == "" {
		t.Fatalf("expected avatar URL in response, got %#v", responseBody.Data)
	}
}

func mustSignTestToken(t *testing.T, userID, email string) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID: userID,
		Email:  email,
		Role:   middleware.RoleUser,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})

	signed, err := token.SignedString([]byte("super-secret-test-key-1234567890"))
	if err != nil {
		t.Fatalf("failed to sign JWT: %v", err)
	}

	return signed
}
