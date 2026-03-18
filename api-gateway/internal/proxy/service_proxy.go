package proxy

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
)

// ServiceProxy represents a reverse proxy for a backend service
type ServiceProxy struct {
	baseURL string
	log     *zap.Logger
	client  *http.Client
}

// NewServiceProxy creates a new service proxy instance
func NewServiceProxy(baseURL string, log *zap.Logger) *ServiceProxy {
	return &ServiceProxy{
		baseURL: baseURL,
		log:     log,
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 20,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

// Do forwards HTTP request to the backend service
func (p *ServiceProxy) Do(ctx context.Context, req *http.Request) (*http.Response, error) {
	// Create a new request to the backend service
	backendURL := fmt.Sprintf("%s%s", p.baseURL, req.URL.Path)
	backendReq, err := http.NewRequest(req.Method, backendURL, req.Body)
	if err != nil {
		return nil, err
	}

	// Copy headers from original request
	backendReq.Header = make(http.Header)
	for name, values := range req.Header {
		for _, value := range values {
			backendReq.Header.Add(name, value)
		}
	}

	// Add context to request
	backendReq = backendReq.WithContext(ctx)

	// Make the request
	resp, err := p.client.Do(backendReq)
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

// ForwardResponse copies backend response to the client response
func (p *ServiceProxy) ForwardResponse(w http.ResponseWriter, resp *http.Response) error {
	// Copy status code
	w.WriteHeader(resp.StatusCode)

	// Copy headers
	for name, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(name, value)
		}
	}

	// Copy response body
	_, err := io.Copy(w, resp.Body)
	if err != nil {
		p.log.Error("failed to copy response body", zap.Error(err))
	}

	// Close response body
	resp.Body.Close()

	return err
}
