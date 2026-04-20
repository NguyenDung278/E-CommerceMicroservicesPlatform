package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
)

type NotificationPreference struct {
	Topic   string `json:"topic"`
	Enabled bool   `json:"enabled"`
}

type WishlistAlert struct {
	ProductID     string    `json:"product_id"`
	ProductName   string    `json:"product_name"`
	Kind          string    `json:"kind"`
	BaselinePrice float64   `json:"baseline_price"`
	CurrentPrice  float64   `json:"current_price"`
	BaselineStock int       `json:"baseline_stock"`
	CurrentStock  int       `json:"current_stock"`
	DetectedAt    time.Time `json:"detected_at"`
}

type WishlistAlertDelivery struct {
	UserID    string        `json:"user_id"`
	UserEmail string        `json:"user_email"`
	Topic     string        `json:"topic"`
	Alert     WishlistAlert `json:"alert"`
}

type notificationPreferencesEnvelope struct {
	Success bool                     `json:"success"`
	Message string                   `json:"message"`
	Error   string                   `json:"error"`
	Data    []NotificationPreference `json:"data"`
}

type wishlistAlertsEnvelope struct {
	Success bool                    `json:"success"`
	Message string                  `json:"message"`
	Error   string                  `json:"error"`
	Data    []WishlistAlertDelivery `json:"data"`
}

type UserClient struct {
	baseURL   string
	jwtSecret string
	client    *http.Client
	log       *zap.Logger
}

func NewUserClient(cfg *config.Config, log *zap.Logger) *UserClient {
	if log == nil {
		log = zap.NewNop()
	}
	if cfg == nil {
		cfg = &config.Config{}
	}

	return &UserClient{
		baseURL:   normalizeBaseURL(cfg.Services.UserService),
		jwtSecret: strings.TrimSpace(cfg.JWT.Secret),
		client: &http.Client{
			Timeout:   10 * time.Second,
			Transport: appobs.WrapHTTPTransport(http.DefaultTransport),
		},
		log: log,
	}
}

func (c *UserClient) PreferenceMap(ctx context.Context, userID string) (map[string]bool, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return map[string]bool{}, nil
	}

	requestURL := fmt.Sprintf("%s/api/v1/users/notification-preferences", c.baseURL)
	tokenString, err := c.signToken(userID, appmw.RoleUser, "")
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create preference request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+tokenString)

	startedAt := time.Now()
	outcome := appobs.OutcomeSuccess
	defer func() {
		appobs.ObserveOperation("notification-service", "http_list_notification_preferences", outcome, time.Since(startedAt))
	}()

	resp, err := c.client.Do(req)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		return nil, fmt.Errorf("failed to fetch notification preferences: %w", err)
	}
	defer resp.Body.Close()

	var envelope notificationPreferencesEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		outcome = appobs.OutcomeSystemError
		return nil, fmt.Errorf("failed to decode notification preferences response: %w", err)
	}

	if resp.StatusCode != http.StatusOK || !envelope.Success {
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			outcome = appobs.OutcomeBusinessError
		} else {
			outcome = appobs.OutcomeSystemError
		}
		if envelope.Error != "" {
			return nil, fmt.Errorf("failed to fetch notification preferences: %s", envelope.Error)
		}
		return nil, fmt.Errorf("failed to fetch notification preferences: status %d", resp.StatusCode)
	}

	preferences := make(map[string]bool, len(envelope.Data))
	for _, preference := range envelope.Data {
		topic := strings.TrimSpace(preference.Topic)
		if topic == "" {
			continue
		}
		preferences[topic] = preference.Enabled
	}
	return preferences, nil
}

func (c *UserClient) ListDispatchableWishlistAlerts(
	ctx context.Context,
	limit int,
) ([]WishlistAlertDelivery, error) {
	if limit <= 0 {
		limit = 50
	}

	params := url.Values{}
	params.Set("limit", fmt.Sprintf("%d", limit))
	requestURL := fmt.Sprintf("%s/api/v1/admin/wishlist-alerts?%s", c.baseURL, params.Encode())
	tokenString, err := c.signToken("notification-service", appmw.RoleAdmin, "notifications@internal.local")
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create dispatchable wishlist alerts request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+tokenString)

	startedAt := time.Now()
	outcome := appobs.OutcomeSuccess
	defer func() {
		appobs.ObserveOperation("notification-service", "http_list_dispatchable_wishlist_alerts", outcome, time.Since(startedAt))
	}()

	resp, err := c.client.Do(req)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		return nil, fmt.Errorf("failed to fetch dispatchable wishlist alerts: %w", err)
	}
	defer resp.Body.Close()

	var envelope wishlistAlertsEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		outcome = appobs.OutcomeSystemError
		return nil, fmt.Errorf("failed to decode dispatchable wishlist alerts response: %w", err)
	}
	if resp.StatusCode != http.StatusOK || !envelope.Success {
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			outcome = appobs.OutcomeBusinessError
		} else {
			outcome = appobs.OutcomeSystemError
		}
		if envelope.Error != "" {
			return nil, fmt.Errorf("failed to fetch dispatchable wishlist alerts: %s", envelope.Error)
		}
		return nil, fmt.Errorf("failed to fetch dispatchable wishlist alerts: status %d", resp.StatusCode)
	}

	return envelope.Data, nil
}

func (c *UserClient) signToken(userID, role, email string) (string, error) {
	if c == nil || strings.TrimSpace(c.baseURL) == "" {
		return "", fmt.Errorf("user client is not configured")
	}
	if strings.TrimSpace(c.jwtSecret) == "" {
		return "", fmt.Errorf("user client jwt secret is not configured")
	}

	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, appmw.JWTClaims{
		UserID: strings.TrimSpace(userID),
		Email:  strings.TrimSpace(email),
		Role:   strings.TrimSpace(role),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(5 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	})

	signedToken, err := token.SignedString([]byte(c.jwtSecret))
	if err != nil {
		return "", fmt.Errorf("failed to sign internal user-service token: %w", err)
	}
	return signedToken, nil
}

func normalizeBaseURL(value string) string {
	trimmed := strings.TrimRight(strings.TrimSpace(value), "/")
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		return trimmed
	}
	return "http://" + trimmed
}
