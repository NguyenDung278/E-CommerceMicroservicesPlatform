package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

type handlerFakeOAuthProviderClient struct {
	redirectURL string
}

func (c *handlerFakeOAuthProviderClient) AuthorizationURL(provider, state, _ string) (string, error) {
	if provider != service.OAuthProviderGoogle {
		return "", service.ErrInvalidOAuthProvider
	}

	return c.redirectURL + "?state=" + url.QueryEscape(state), nil
}

func (c *handlerFakeOAuthProviderClient) ExchangeCode(_ context.Context, _ string, _ string, _ string) (*service.OAuthIdentity, error) {
	return nil, service.ErrOAuthProviderNotConfigured
}

func (c *handlerFakeOAuthProviderClient) DefaultRedirectURL(provider string) (string, error) {
	if provider != service.OAuthProviderGoogle {
		return "", service.ErrInvalidOAuthProvider
	}

	return c.redirectURL, nil
}

func TestOAuthStartEndpointRedirectsAndSetsNonceCookie(t *testing.T) {
	repo := newIntegrationUserRepo()
	userService := service.NewUserService(
		repo,
		"super-secret-test-key-1234567890",
		24,
		service.WithOAuthProviderClient(&handlerFakeOAuthProviderClient{
			redirectURL: "http://localhost:8080/api/v1/auth/oauth/google/callback",
		}),
		service.WithFrontendBaseURL("http://localhost:5174"),
	)
	handler := NewUserHandler(userService)

	e := echo.New()
	e.Validator = validation.New()
	handler.RegisterRoutes(e, "super-secret-test-key-1234567890")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/oauth/google/start?redirect_to=/checkout", nil)
	req.Header.Set("Referer", "http://localhost:5174/login")
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusFound {
		t.Fatalf("expected 302, got %d body=%s", rec.Code, rec.Body.String())
	}
	if location := rec.Header().Get("Location"); !strings.Contains(location, "state=") {
		t.Fatalf("expected provider redirect with state, got %q", location)
	}
	if cookie := rec.Header().Get("Set-Cookie"); !strings.Contains(cookie, service.OAuthNonceCookieName) {
		t.Fatalf("expected oauth nonce cookie, got %q", cookie)
	}
}

func TestOAuthExchangeEndpointRejectsInvalidTicket(t *testing.T) {
	repo := newIntegrationUserRepo()
	userService := service.NewUserService(repo, "super-secret-test-key-1234567890", 24)
	handler := NewUserHandler(userService)

	e := echo.New()
	e.Validator = validation.New()
	handler.RegisterRoutes(e, "super-secret-test-key-1234567890")

	body, _ := json.Marshal(map[string]string{
		"ticket": "invalid.ticket.value",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/oauth/exchange", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d body=%s", rec.Code, rec.Body.String())
	}
}
