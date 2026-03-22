package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
)

var ErrOrderNotFound = errors.New("order not found")

type Order struct {
	ID         string  `json:"id"`
	UserID     string  `json:"user_id"`
	TotalPrice float64 `json:"total_price"`
	Status     string  `json:"status"`
}

type orderEnvelope struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error"`
	Data    Order  `json:"data"`
}

type OrderClient struct {
	baseURL string
	client  *http.Client
}

func NewOrderClient(baseURL string) *OrderClient {
	return &OrderClient{
		baseURL: normalizeBaseURL(baseURL),
		client: &http.Client{
			Timeout:   10 * time.Second,
			Transport: appobs.WrapHTTPTransport(http.DefaultTransport),
		},
	}
}

func (c *OrderClient) GetOrder(ctx context.Context, authHeader, orderID string) (*Order, error) {
	if c == nil || c.baseURL == "" {
		return nil, fmt.Errorf("order client is not configured")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/api/v1/orders/%s", c.baseURL, orderID), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create order request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch order: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusForbidden {
		return nil, ErrOrderNotFound
	}

	var envelope orderEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return nil, fmt.Errorf("failed to decode order response: %w", err)
	}

	if resp.StatusCode != http.StatusOK || !envelope.Success {
		if envelope.Error != "" {
			return nil, fmt.Errorf("failed to fetch order: %s", envelope.Error)
		}
		return nil, fmt.Errorf("failed to fetch order: status %d", resp.StatusCode)
	}

	return &envelope.Data, nil
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
