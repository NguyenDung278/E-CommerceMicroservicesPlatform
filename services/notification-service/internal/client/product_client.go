// Client đọc tồn kho thấp từ product-service.
//
// Vì sao pull chứ không phải event qua RabbitMQ: product-service không có một
// mẩu hạ tầng messaging nào (không amqp, không outbox), và "tồn kho thấp" là
// một TRẠNG THÁI đứng yên chứ không phải một sự kiện rời rạc — hàng nằm dưới
// ngưỡng suốt nhiều ngày cho tới khi có người nhập kho. Bắn event mỗi lần trừ
// kho sẽ vừa ồn vừa vẫn phải quét lại định kỳ để biết "còn đang thấp không".
// Poll đúng hình dạng bài toán hơn, và lặp lại đúng pattern wishlist alert đang
// chạy (user_client.go).
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

// LowStockEntry khớp với model.LowStockEntry bên product-service. SKU rỗng
// nghĩa là cảnh báo ở mức sản phẩm, không phải một variant cụ thể.
type LowStockEntry struct {
	ProductID    string `json:"product_id"`
	ProductName  string `json:"product_name"`
	SKU          string `json:"sku"`
	VariantLabel string `json:"variant_label"`
	Stock        int    `json:"stock"`
	Threshold    int    `json:"threshold"`
}

// IsOutOfStock phân biệt "đã hết" với "sắp hết" — dùng cho cả nội dung email
// lẫn khoá khử trùng lặp.
func (e LowStockEntry) IsOutOfStock() bool {
	return e.Stock <= 0
}

// DisplayName mô tả đúng thứ cần nhập: tên sản phẩm kèm variant nếu có.
func (e LowStockEntry) DisplayName() string {
	name := strings.TrimSpace(e.ProductName)
	if name == "" {
		name = strings.TrimSpace(e.ProductID)
	}

	label := strings.TrimSpace(e.VariantLabel)
	if label == "" {
		label = strings.TrimSpace(e.SKU)
	}
	if label == "" {
		return name
	}
	return fmt.Sprintf("%s - %s", name, label)
}

type lowStockEnvelope struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Error   string          `json:"error"`
	Data    []LowStockEntry `json:"data"`
}

type ProductClient struct {
	baseURL   string
	jwtSecret string
	client    *http.Client
	log       *zap.Logger
}

func NewProductClient(cfg *config.Config, log *zap.Logger) *ProductClient {
	if log == nil {
		log = zap.NewNop()
	}
	if cfg == nil {
		cfg = &config.Config{}
	}

	return &ProductClient{
		baseURL:   normalizeBaseURL(cfg.Services.ProductService),
		jwtSecret: strings.TrimSpace(cfg.JWT.Secret),
		client: &http.Client{
			Timeout:   10 * time.Second,
			Transport: appobs.WrapHTTPTransport(http.DefaultTransport),
		},
		log: log,
	}
}

// ListLowStock lấy danh sách tồn kho chạm ngưỡng từ product-service.
func (c *ProductClient) ListLowStock(
	ctx context.Context,
	threshold int,
	limit int,
) ([]LowStockEntry, error) {
	if threshold < 0 {
		threshold = 0
	}
	if limit <= 0 {
		limit = 50
	}

	params := url.Values{}
	params.Set("threshold", fmt.Sprintf("%d", threshold))
	params.Set("limit", fmt.Sprintf("%d", limit))
	requestURL := fmt.Sprintf("%s/api/v1/products/low-stock?%s", c.baseURL, params.Encode())

	tokenString, err := c.signToken("notification-service", appmw.RoleAdmin, "notifications@internal.local")
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create low stock request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+tokenString)

	startedAt := time.Now()
	outcome := appobs.OutcomeSuccess
	defer func() {
		appobs.ObserveOperation("notification-service", "http_list_low_stock", outcome, time.Since(startedAt))
	}()

	resp, err := c.client.Do(req)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		return nil, fmt.Errorf("failed to fetch low stock products: %w", err)
	}
	defer resp.Body.Close()

	var envelope lowStockEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		outcome = appobs.OutcomeSystemError
		return nil, fmt.Errorf("failed to decode low stock response: %w", err)
	}
	if resp.StatusCode != http.StatusOK || !envelope.Success {
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			outcome = appobs.OutcomeBusinessError
		} else {
			outcome = appobs.OutcomeSystemError
		}
		if envelope.Error != "" {
			return nil, fmt.Errorf("failed to fetch low stock products: %s", envelope.Error)
		}
		return nil, fmt.Errorf("failed to fetch low stock products: status %d", resp.StatusCode)
	}

	return envelope.Data, nil
}

func (c *ProductClient) signToken(userID, role, email string) (string, error) {
	if c == nil || strings.TrimSpace(c.baseURL) == "" {
		return "", fmt.Errorf("product client is not configured")
	}
	if strings.TrimSpace(c.jwtSecret) == "" {
		return "", fmt.Errorf("product client jwt secret is not configured")
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
		return "", fmt.Errorf("failed to sign internal product-service token: %w", err)
	}
	return signedToken, nil
}
