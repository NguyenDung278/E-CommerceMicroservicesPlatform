package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
	"go.uber.org/zap"
)

type paymentHistoryEnvelope struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message"`
	Error   string                 `json:"error"`
	Data    []model.PaymentSummary `json:"data"`
}

type PaymentClient struct {
	baseURL string
	client  *http.Client
	log     *zap.Logger
}

func NewPaymentClient(baseURL string, log *zap.Logger) *PaymentClient {
	if log == nil {
		log = zap.NewNop()
	}

	return &PaymentClient{
		baseURL: normalizeBaseURL(baseURL),
		client: &http.Client{
			Timeout:   10 * time.Second,
			Transport: appobs.WrapHTTPTransport(http.DefaultTransport),
		},
		log: log,
	}
}

func (c *PaymentClient) ListPaymentHistory(ctx context.Context, authHeader string) ([]model.PaymentSummary, error) {
	if c == nil || c.baseURL == "" {
		return nil, fmt.Errorf("payment client is not configured")
	}

	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(c.log, ctx,
		zap.String("downstream_service", "payment-service"),
		zap.String("method", http.MethodGet),
		zap.String("path", "/api/v1/payments/history"),
	)
	outcome := appobs.OutcomeSuccess
	defer func() {
		appobs.ObserveOperation("order-service", "http_list_payment_history", outcome, time.Since(startedAt))
	}()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/api/v1/payments/history", c.baseURL), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create payment history request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("failed to call payment-service", zap.Error(err))
		return nil, fmt.Errorf("failed to fetch payment history: %w", err)
	}
	defer resp.Body.Close()

	var envelope paymentHistoryEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("failed to decode payment-service response", zap.Int("status", resp.StatusCode), zap.Error(err))
		return nil, fmt.Errorf("failed to decode payment history response: %w", err)
	}

	if resp.StatusCode != http.StatusOK || !envelope.Success {
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			outcome = appobs.OutcomeBusinessError
		} else {
			outcome = appobs.OutcomeSystemError
		}
		requestLog.Warn("payment-service returned unexpected response",
			zap.Int("status", resp.StatusCode),
			zap.Bool("success", envelope.Success),
			zap.String("error", envelope.Error),
		)
		if envelope.Error != "" {
			return nil, fmt.Errorf("failed to fetch payment history: %s", envelope.Error)
		}
		return nil, fmt.Errorf("failed to fetch payment history: status %d", resp.StatusCode)
	}

	requestLog.Info("payment history lookup completed",
		zap.Int("status", resp.StatusCode),
		zap.Int("payment_count", len(envelope.Data)),
		zap.Int64("latency_ms", time.Since(startedAt).Milliseconds()),
	)

	return envelope.Data, nil
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
