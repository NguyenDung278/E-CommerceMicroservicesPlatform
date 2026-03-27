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
	"go.uber.org/zap"
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
	log     *zap.Logger
}

func NewOrderClient(baseURL string, log *zap.Logger) *OrderClient {
	if log == nil {
		log = zap.NewNop()
	}

	return &OrderClient{
		baseURL: normalizeBaseURL(baseURL),
		client: &http.Client{
			Timeout:   10 * time.Second,
			Transport: appobs.WrapHTTPTransport(http.DefaultTransport),
		},
		log: log,
	}
}

func (c *OrderClient) GetOrder(ctx context.Context, authHeader, orderID string) (*Order, error) {
	if c == nil {
		return nil, fmt.Errorf("order client is not configured")
	}

	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(c.log, ctx,
		zap.String("order_id", orderID),
		zap.String("downstream_service", "order-service"),
		zap.String("method", http.MethodGet),
	)
	outcome := appobs.OutcomeSuccess
	defer func() {
		appobs.ObserveOperation("payment-service", "http_get_order", outcome, time.Since(startedAt))
	}()

	if c.baseURL == "" {
		outcome = appobs.OutcomeSystemError
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
		outcome = appobs.OutcomeSystemError
		requestLog.Error("failed to call order-service", zap.Error(err))
		return nil, fmt.Errorf("failed to fetch order: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusForbidden {
		outcome = appobs.OutcomeBusinessError
		requestLog.Warn("order lookup returned non-accessible order", zap.Int("status", resp.StatusCode))
		return nil, ErrOrderNotFound
	}

	var envelope orderEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("failed to decode order-service response", zap.Int("status", resp.StatusCode), zap.Error(err))
		return nil, fmt.Errorf("failed to decode order response: %w", err)
	}

	if resp.StatusCode != http.StatusOK || !envelope.Success {
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			outcome = appobs.OutcomeBusinessError
		} else {
			outcome = appobs.OutcomeSystemError
		}
		requestLog.Warn("order-service returned unexpected response",
			zap.Int("status", resp.StatusCode),
			zap.Bool("success", envelope.Success),
			zap.String("error", envelope.Error),
		)
		if envelope.Error != "" {
			return nil, fmt.Errorf("failed to fetch order: %s", envelope.Error)
		}
		return nil, fmt.Errorf("failed to fetch order: status %d", resp.StatusCode)
	}

	requestLog.Info("order lookup completed",
		zap.Int("status", resp.StatusCode),
		zap.Int64("latency_ms", time.Since(startedAt).Milliseconds()),
	)

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
