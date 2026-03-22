package proxy

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/sony/gobreaker/v2"
	"go.uber.org/zap"
)

// ServiceProxy represents a reverse proxy for a backend service.
//
// DESIGN PATTERN: Proxy & GoBreaker.
// Thay vì Gateway tự import Model và gọi HTTP trực tiếp, ServiceProxy đơn thuần
// copy (forward) toàn bộ Header, Body, Path của Client và đẩy thẳng xuống Service con.
// Cách tiếp cận này giúp API Gateway không bao giờ phải sửa code khi Service con thay đổi API mới.
type ServiceProxy struct {
	baseURL        string
	log            *zap.Logger
	client         *http.Client
	circuitBreaker *gobreaker.CircuitBreaker[*http.Response]
	maxRetries     int
}

// NewServiceProxy creates a new service proxy instance
func NewServiceProxy(baseURL string, log *zap.Logger) *ServiceProxy {
	return &ServiceProxy{
		baseURL: baseURL,
		log:     log,
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: appobs.WrapHTTPTransport(&http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 20,
				IdleConnTimeout:     90 * time.Second,
			}),
		},
		circuitBreaker: gobreaker.NewCircuitBreaker[*http.Response](gobreaker.Settings{
			Name:        baseURL,
			MaxRequests: 3,
			Interval:    30 * time.Second,
			Timeout:     20 * time.Second,
			ReadyToTrip: func(counts gobreaker.Counts) bool {
				return counts.ConsecutiveFailures >= 5
			},
		}),
		maxRetries: 2,
	}
}

// Do forwards HTTP request to the backend service
func (p *ServiceProxy) Do(ctx context.Context, req *http.Request) (*http.Response, error) {
	// Preserve the full request path and raw query string when forwarding.
	backendURL := fmt.Sprintf("%s%s", p.baseURL, req.URL.Path)
	if req.URL.RawQuery != "" {
		backendURL = fmt.Sprintf("%s?%s", backendURL, req.URL.RawQuery)
	}
	backendReq, err := http.NewRequest(req.Method, backendURL, req.Body)
	if err != nil {
		return nil, err
	}
	backendReq.ContentLength = req.ContentLength
	backendReq.GetBody = req.GetBody

	// Copy headers from original request
	backendReq.Header = make(http.Header)
	for name, values := range req.Header {
		for _, value := range values {
			backendReq.Header.Add(name, value)
		}
	}

	// Add context to request
	backendReq = backendReq.WithContext(ctx)
	backendReq.URL.RawQuery = req.URL.RawQuery
	backendReq.RequestURI = ""
	if req.Host != "" {
		backendReq.Header.Set("X-Forwarded-Host", req.Host)
	}
	backendReq.Header.Set("X-Forwarded-Proto", forwardedProto(req))

	resp, err := p.executeWithResilience(backendReq)
	if err != nil {
		p.log.Error("failed to proxy request",
			zap.String("method", req.Method),
			zap.String("url", req.URL.Path),
			zap.String("backend_url", backendURL),
			zap.Error(err),
		)
		return nil, err
	}

	return resp, nil
}

// executeWithResilience wraps the HTTP client call with Retry and Circuit Breaker patterns.
//
//  1. Retry: Nếu call thất bại (do Network hặc Service con 500), nó sẽ tự động chạy lại (Sleep backoff nhỏ).
//  2. Circuit Breaker (gobreaker): Xử lý đứt gãy dây chuyền. Nếu Service con ngỏm cứng (Rate fail > 5), Breaker sẽ
//     chuyển sang trạng thái "Open" và ngay lập tức trả lỗi cho các request tiếp theo thay vì bắt User chờ timeout.
func (p *ServiceProxy) executeWithResilience(req *http.Request) (*http.Response, error) {
	var lastErr error
	attempts := p.maxRetries + 1

	for attempt := 0; attempt < attempts; attempt++ {
		clonedReq := req.Clone(req.Context())
		if req.GetBody != nil {
			body, err := req.GetBody()
			if err != nil {
				return nil, err
			}
			clonedReq.Body = body
		}

		resp, err := p.circuitBreaker.Execute(func() (*http.Response, error) {
			return p.client.Do(clonedReq)
		})
		if err == nil {
			return resp, nil
		}

		lastErr = err
		if !shouldRetry(clonedReq.Method, err, attempt, attempts) {
			break
		}
		time.Sleep(time.Duration(attempt+1) * 150 * time.Millisecond)
	}

	return nil, lastErr
}

// ForwardResponse copies backend response to the client response
func (p *ServiceProxy) ForwardResponse(w http.ResponseWriter, resp *http.Response) error {
	// Copy headers
	for name, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(name, value)
		}
	}

	// Copy status code after headers are written.
	w.WriteHeader(resp.StatusCode)

	// Copy response body
	_, err := io.Copy(w, resp.Body)
	if err != nil {
		p.log.Error("failed to copy response body", zap.Error(err))
	}

	// Close response body
	resp.Body.Close()

	return err
}

func forwardedProto(req *http.Request) string {
	if req.TLS != nil {
		return "https"
	}

	if proto := req.Header.Get("X-Forwarded-Proto"); proto != "" {
		return proto
	}

	if origin, err := url.Parse(req.Header.Get("Origin")); err == nil && origin.Scheme != "" {
		return origin.Scheme
	}

	return "http"
}

func shouldRetry(method string, err error, attempt int, attempts int) bool {
	if attempt >= attempts-1 {
		return false
	}

	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
	default:
		return false
	}

	var netErr interface{ Timeout() bool }
	if errors.As(err, &netErr) {
		return true
	}

	return errors.Is(err, gobreaker.ErrOpenState) || errors.Is(err, gobreaker.ErrTooManyRequests)
}
