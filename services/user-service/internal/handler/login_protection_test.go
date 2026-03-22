package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

func TestLoginEndpointLocksAfterFiveFailures(t *testing.T) {
	const jwtSecret = "super-secret-test-key-1234567890"

	repo := newIntegrationUserRepo()
	userService := service.NewUserService(repo, jwtSecret, 24)
	if _, err := userService.Register(context.Background(), dto.RegisterRequest{
		Email:     "alice@example.com",
		Phone:     "0901234567",
		Password:  "password123",
		FirstName: "Alice",
		LastName:  "Nguyen",
	}); err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}

	handler := NewUserHandlerWithLoginProtector(userService, NewLoginAttemptProtector(5, 15*time.Minute, time.Hour))
	e := echo.New()
	e.Validator = validation.New()
	handler.RegisterRoutes(e, jwtSecret)

	for attempt := 1; attempt <= 4; attempt++ {
		rec := performLoginRequest(t, e, dto.LoginRequest{
			Identifier: "alice@example.com",
			Password:   "wrong-password",
		})
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: expected 401, got %d body=%s", attempt, rec.Code, rec.Body.String())
		}
	}

	locked := performLoginRequest(t, e, dto.LoginRequest{
		Identifier: "alice@example.com",
		Password:   "wrong-password",
	})
	if locked.Code != http.StatusTooManyRequests {
		t.Fatalf("fifth failure should lock endpoint with 429, got %d body=%s", locked.Code, locked.Body.String())
	}
	if retryAfter := locked.Header().Get(echo.HeaderRetryAfter); retryAfter == "" {
		t.Fatal("expected retry-after header to be set")
	}

	blocked := performLoginRequest(t, e, dto.LoginRequest{
		Identifier: "alice@example.com",
		Password:   "password123",
	})
	if blocked.Code != http.StatusTooManyRequests {
		t.Fatalf("expected locked account to keep returning 429, got %d body=%s", blocked.Code, blocked.Body.String())
	}
}

func performLoginRequest(t *testing.T, e *echo.Echo, payload dto.LoginRequest) *httptest.ResponseRecorder {
	t.Helper()

	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal login payload: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.RemoteAddr = "203.0.113.10:12345"

	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}
