package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
)

type OAuthProviderClient interface {
	AuthorizationURL(provider, state, redirectURL string) (string, error)
	ExchangeCode(ctx context.Context, provider, code, redirectURL string) (*OAuthIdentity, error)
	DefaultRedirectURL(provider string) (string, error)
}

type httpOAuthProviderClient struct {
	httpClient *http.Client
	cfg        config.OAuthConfig
}

func NewOAuthProviderClient(cfg config.OAuthConfig) OAuthProviderClient {
	return &httpOAuthProviderClient{
		httpClient: &http.Client{Timeout: 10 * time.Second},
		cfg:        cfg,
	}
}

func (c *httpOAuthProviderClient) AuthorizationURL(provider, state, redirectURL string) (string, error) {
	provider, err := normalizeOAuthProvider(provider)
	if err != nil {
		return "", err
	}

	providerConfig, err := c.providerConfig(provider)
	if err != nil {
		return "", err
	}

	values := url.Values{}
	values.Set("client_id", providerConfig.ClientID)
	values.Set("redirect_uri", redirectURL)
	values.Set("response_type", "code")
	values.Set("state", state)

	switch provider {
	case OAuthProviderGoogle:
		values.Set("scope", "openid email profile")
		return "https://accounts.google.com/o/oauth2/v2/auth?" + values.Encode(), nil
	default:
		return "", ErrInvalidOAuthProvider
	}
}

func (c *httpOAuthProviderClient) ExchangeCode(ctx context.Context, provider, code, redirectURL string) (*OAuthIdentity, error) {
	provider, err := normalizeOAuthProvider(provider)
	if err != nil {
		return nil, err
	}

	switch provider {
	case OAuthProviderGoogle:
		return c.exchangeGoogleCode(ctx, code, redirectURL)
	default:
		return nil, ErrInvalidOAuthProvider
	}
}

func (c *httpOAuthProviderClient) DefaultRedirectURL(provider string) (string, error) {
	providerConfig, err := c.providerConfig(provider)
	if err != nil {
		return "", err
	}

	return providerConfig.RedirectURL, nil
}

func (c *httpOAuthProviderClient) exchangeGoogleCode(ctx context.Context, code, redirectURL string) (*OAuthIdentity, error) {
	providerConfig, err := c.providerConfig(OAuthProviderGoogle)
	if err != nil {
		return nil, err
	}

	form := url.Values{}
	form.Set("client_id", providerConfig.ClientID)
	form.Set("client_secret", providerConfig.ClientSecret)
	form.Set("code", strings.TrimSpace(code))
	form.Set("grant_type", "authorization_code")
	form.Set("redirect_uri", redirectURL)

	tokenResponse := struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
	}{}
	if err := c.doFormRequest(ctx, http.MethodPost, "https://oauth2.googleapis.com/token", form, &tokenResponse); err != nil {
		return nil, err
	}
	if strings.TrimSpace(tokenResponse.AccessToken) == "" {
		return nil, fmt.Errorf("google oauth token exchange returned empty access token")
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://openidconnect.googleapis.com/v1/userinfo", nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+tokenResponse.AccessToken)

	profileResponse := struct {
		Subject       string `json:"sub"`
		Email         string `json:"email"`
		GivenName     string `json:"given_name"`
		FamilyName    string `json:"family_name"`
		Name          string `json:"name"`
		EmailVerified bool   `json:"email_verified"`
	}{}
	if err := c.doJSONRequest(ctx, request, &profileResponse); err != nil {
		return nil, err
	}

	return &OAuthIdentity{
		Provider:       OAuthProviderGoogle,
		ProviderUserID: strings.TrimSpace(profileResponse.Subject),
		Email:          strings.TrimSpace(profileResponse.Email),
		FirstName:      strings.TrimSpace(profileResponse.GivenName),
		LastName:       strings.TrimSpace(profileResponse.FamilyName),
		FullName:       strings.TrimSpace(profileResponse.Name),
		EmailVerified:  profileResponse.EmailVerified,
	}, nil
}

func (c *httpOAuthProviderClient) providerConfig(provider string) (config.OAuthProviderConfig, error) {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case OAuthProviderGoogle:
		if !isProviderConfigured(c.cfg.Google) {
			return config.OAuthProviderConfig{}, ErrOAuthProviderNotConfigured
		}
		return c.cfg.Google, nil
	default:
		return config.OAuthProviderConfig{}, ErrInvalidOAuthProvider
	}
}

func isProviderConfigured(cfg config.OAuthProviderConfig) bool {
	return strings.TrimSpace(cfg.ClientID) != "" &&
		strings.TrimSpace(cfg.ClientSecret) != "" &&
		strings.TrimSpace(cfg.RedirectURL) != ""
}

func (c *httpOAuthProviderClient) doFormRequest(ctx context.Context, method, endpoint string, form url.Values, out any) error {
	request, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewBufferString(form.Encode()))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("Accept", "application/json")

	return c.doJSONRequest(ctx, request, out)
}

func (c *httpOAuthProviderClient) doJSONRequest(_ context.Context, request *http.Request, out any) error {
	response, err := c.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("oauth provider request failed: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return fmt.Errorf("failed to read oauth provider response: %w", err)
	}

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		detail := strings.TrimSpace(string(body))
		if detail == "" {
			detail = response.Status
		}
		return fmt.Errorf("oauth provider request failed: %s", detail)
	}

	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("failed to decode oauth provider response: %w", err)
	}

	return nil
}
