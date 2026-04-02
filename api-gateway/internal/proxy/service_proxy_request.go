package proxy

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/sony/gobreaker/v2"
	"go.uber.org/zap"
)

// Do forwards an incoming request to the configured backend service.
//
// Inputs:
//   - ctx carries cancellation and tracing metadata.
//   - req is the original client request received by the gateway.
//
// Returns:
//   - the downstream response.
//   - an error when request construction or downstream execution fails.
//
// Edge cases:
//   - the original request path and raw query string are preserved exactly.
//
// Side effects:
//   - performs a downstream HTTP request.
//
// Performance:
//   - O(h) over the header count to clone headers, plus network I/O for the downstream request.
func (p *ServiceProxy) Do(ctx context.Context, req *http.Request) (*http.Response, error) {
	backendReq, backendURL, err := p.newBackendRequest(ctx, req)
	if err != nil {
		return nil, err
	}

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

// newBackendRequest clones the inbound gateway request into a backend request.
//
// Inputs:
//   - ctx carries cancellation and tracing metadata.
//   - req is the original gateway request.
//
// Returns:
//   - the backend request ready to execute.
//   - the fully resolved backend URL for logging.
//   - an error when request construction fails.
//
// Edge cases:
//   - forwarded host and proto headers are added without disturbing existing caller headers.
//
// Side effects:
//   - none beyond request allocation.
//
// Performance:
//   - O(h) over header count via Header.Clone plus O(n) URL assembly.
func (p *ServiceProxy) newBackendRequest(ctx context.Context, req *http.Request) (*http.Request, string, error) {
	backendURL := buildBackendURL(p.baseURL, req.URL.Path, req.URL.RawQuery)
	backendReq, err := http.NewRequestWithContext(ctx, req.Method, backendURL, req.Body)
	if err != nil {
		return nil, "", err
	}

	backendReq.Header = req.Header.Clone()
	backendReq.ContentLength = req.ContentLength
	backendReq.GetBody = req.GetBody
	backendReq.URL.RawQuery = req.URL.RawQuery
	backendReq.RequestURI = ""
	if req.Host != "" {
		backendReq.Header.Set("X-Forwarded-Host", req.Host)
	}
	backendReq.Header.Set("X-Forwarded-Proto", forwardedProto(req))

	return backendReq, backendURL, nil
}

// buildBackendURL joins the base URL with the request path and raw query string.
//
// Inputs:
//   - baseURL is the downstream service base URL.
//   - path is the original request path.
//   - rawQuery is the original request query string.
//
// Returns:
//   - the fully resolved backend URL.
//
// Edge cases:
//   - empty query strings omit the trailing `?`.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the combined URL length; a single builder avoids intermediate format allocations.
func buildBackendURL(baseURL, path, rawQuery string) string {
	var builder strings.Builder
	builder.Grow(len(baseURL) + len(path) + len(rawQuery) + 1)
	builder.WriteString(baseURL)
	builder.WriteString(path)
	if rawQuery != "" {
		builder.WriteByte('?')
		builder.WriteString(rawQuery)
	}
	return builder.String()
}

// executeWithResilience wraps the downstream HTTP call with retry and
// circuit-breaker behavior.
//
// Inputs:
//   - req is the backend request to execute.
//
// Returns:
//   - the downstream response.
//   - the last error encountered after retries are exhausted.
//
// Edge cases:
//   - only idempotent methods are retried.
//   - request bodies are only re-cloned when GetBody is available.
//
// Side effects:
//   - performs one or more downstream HTTP requests.
//
// Performance:
//   - O(r) retry orchestration in the gateway, plus network I/O for each attempt.
func (p *ServiceProxy) executeWithResilience(req *http.Request) (*http.Response, error) {
	var lastErr error
	attempts := p.maxRetries + 1

	for attempt := 0; attempt < attempts; attempt++ {
		clonedReq, err := cloneRetryableRequest(req)
		if err != nil {
			return nil, err
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

// cloneRetryableRequest clones a backend request and recreates its body when possible.
//
// Inputs:
//   - req is the backend request template.
//
// Returns:
//   - a request clone ready for one execution attempt.
//   - an error when the body cannot be recreated.
//
// Edge cases:
//   - body recreation is skipped when GetBody is nil.
//
// Side effects:
//   - allocates a cloned request and possibly a new body reader.
//
// Performance:
//   - O(1) gateway work aside from optional body recreation.
func cloneRetryableRequest(req *http.Request) (*http.Request, error) {
	clonedReq := req.Clone(req.Context())
	if req.GetBody == nil {
		return clonedReq, nil
	}

	body, err := req.GetBody()
	if err != nil {
		return nil, err
	}
	clonedReq.Body = body
	return clonedReq, nil
}

// forwardedProto resolves the effective original request scheme used for
// forwarding headers.
//
// Inputs:
//   - req is the original gateway request.
//
// Returns:
//   - the best-effort request scheme.
//
// Edge cases:
//   - TLS takes precedence, then pre-existing forwarded headers, then Origin.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the small forwarded/origin header strings.
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

// shouldRetry reports whether the proxy should retry a failed request attempt.
//
// Inputs:
//   - method is the HTTP method.
//   - err is the attempt failure.
//   - attempt is the current zero-based attempt index.
//   - attempts is the total number of allowed attempts.
//
// Returns:
//   - true when the failure is retryable and attempts remain.
//
// Edge cases:
//   - only GET, HEAD, and OPTIONS are retried to avoid replaying side effects.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
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
