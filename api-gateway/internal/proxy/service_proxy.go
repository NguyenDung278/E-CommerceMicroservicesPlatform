package proxy

import (
	"net/http"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/sony/gobreaker/v2"
	"go.uber.org/zap"
)

// ServiceProxy represents a reverse proxy for a backend service.
//
// DESIGN PATTERN: Proxy & Circuit Breaker.
// The API gateway remains a thin transport layer that forwards requests without
// importing downstream domain models or re-implementing service logic.
type ServiceProxy struct {
	baseURL        string
	log            *zap.Logger
	client         *http.Client
	circuitBreaker *gobreaker.CircuitBreaker[*http.Response]
	maxRetries     int
}

// NewServiceProxy creates a new service proxy instance.
//
// Inputs:
//   - baseURL is the downstream service base URL.
//   - log records proxy failures and diagnostics.
//
// Returns:
//   - a configured proxy with retry and circuit-breaker defaults.
//
// Edge cases:
//   - redirect responses are preserved and never auto-followed so OAuth and
//     similar flows can reach the browser intact.
//
// Side effects:
//   - allocates an HTTP client and a circuit breaker.
//
// Performance:
//   - O(1); construction only stores configuration and shared client state.
func NewServiceProxy(baseURL string, log *zap.Logger) *ServiceProxy {
	return &ServiceProxy{
		baseURL: baseURL,
		log:     log,
		client: &http.Client{
			Timeout: 30 * time.Second,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
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
