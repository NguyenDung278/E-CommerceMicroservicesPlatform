package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"go.uber.org/zap"
)

type ProductSnapshot struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
	Stock int     `json:"stock"`
}

type productsEnvelope struct {
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Error   string            `json:"error"`
	Data    []ProductSnapshot `json:"data"`
}

type ProductClient struct {
	baseURL string
	client  *http.Client
	log     *zap.Logger
}

func NewProductClient(baseURL string, log *zap.Logger) *ProductClient {
	if log == nil {
		log = zap.NewNop()
	}

	return &ProductClient{
		baseURL: normalizeBaseURL(baseURL),
		client: &http.Client{
			Timeout:   10 * time.Second,
			Transport: appobs.WrapHTTPTransport(http.DefaultTransport),
		},
		log: log,
	}
}

func (c *ProductClient) ListProductsByIDs(ctx context.Context, ids []string) ([]ProductSnapshot, error) {
	if c == nil || c.baseURL == "" {
		return []ProductSnapshot{}, nil
	}
	normalizedIDs := normalizeIDs(ids)
	if len(normalizedIDs) == 0 {
		return []ProductSnapshot{}, nil
	}

	params := url.Values{}
	params.Set("ids", strings.Join(normalizedIDs, ","))
	requestURL := fmt.Sprintf("%s/api/v1/products/batch?%s", c.baseURL, params.Encode())

	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(c.log, ctx,
		zap.Int("product_count", len(normalizedIDs)),
		zap.String("downstream_service", "product-service"),
		zap.String("method", http.MethodGet),
	)
	outcome := appobs.OutcomeSuccess
	defer func() {
		appobs.ObserveOperation("user-service", "http_list_products_by_ids", outcome, time.Since(startedAt))
	}()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		return nil, fmt.Errorf("failed to create product batch request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Warn("failed to call product-service batch endpoint", zap.Error(err))
		return nil, fmt.Errorf("failed to fetch product batch: %w", err)
	}
	defer resp.Body.Close()

	var envelope productsEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Warn("failed to decode product-service batch response", zap.Error(err))
		return nil, fmt.Errorf("failed to decode product batch response: %w", err)
	}
	if resp.StatusCode != http.StatusOK || !envelope.Success {
		outcome = appobs.OutcomeSystemError
		if envelope.Error != "" {
			return nil, fmt.Errorf("failed to fetch product batch: %s", envelope.Error)
		}
		return nil, fmt.Errorf("failed to fetch product batch: status %d", resp.StatusCode)
	}

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

func normalizeIDs(ids []string) []string {
	normalized := make([]string, 0, len(ids))
	seen := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		trimmed := strings.TrimSpace(id)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}
