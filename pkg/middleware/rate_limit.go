package middleware

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"
)

// NewRateLimiter applies a simple in-memory rate limit per identifier.
// This is enough for local development and single-instance deployments.
func NewRateLimiter(requestsPerSecond int, burst int, expiresIn time.Duration) echo.MiddlewareFunc {
	if requestsPerSecond <= 0 {
		requestsPerSecond = 30
	}
	if burst <= 0 {
		burst = requestsPerSecond
	}
	if expiresIn <= 0 {
		expiresIn = 3 * time.Minute
	}

	store := echomw.NewRateLimiterMemoryStoreWithConfig(echomw.RateLimiterMemoryStoreConfig{
		Rate:      rate.Limit(requestsPerSecond),
		Burst:     burst,
		ExpiresIn: expiresIn,
	})

	return echomw.RateLimiterWithConfig(echomw.RateLimiterConfig{
		Store: store,
		IdentifierExtractor: func(c echo.Context) (string, error) {
			if claims := GetUserClaims(c); claims != nil && claims.UserID != "" {
				return claims.UserID, nil
			}
			return c.RealIP(), nil
		},
		ErrorHandler: func(c echo.Context, err error) error {
			return c.JSON(http.StatusForbidden, map[string]string{
				"error": "rate limiter failure",
			})
		},
		DenyHandler: func(c echo.Context, identifier string, err error) error {
			return c.JSON(http.StatusTooManyRequests, map[string]string{
				"error": "rate limit exceeded",
			})
		},
	})
}
