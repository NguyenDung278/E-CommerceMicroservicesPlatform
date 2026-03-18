package middleware

import (
	"time"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

// RequestLogger returns an Echo middleware that logs every HTTP request
// with structured fields for easy searching and monitoring.
//
// WHY: Echo has its own logger, but we want structured JSON logs that
// integrate with our Zap logger and can be indexed by log aggregation tools.
//
// LOGGED FIELDS:
//   - method, path, status: Basic request info
//   - latency_ms: Critical for identifying slow endpoints
//   - client_ip: Useful for debugging and rate limiting
//   - user_agent: Helps identify bot traffic vs real users
func RequestLogger(log *zap.Logger) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()

			// Process the request.
			err := next(c)

			latency := time.Since(start)

			// Log at different levels based on status code.
			fields := []zap.Field{
				zap.String("method", c.Request().Method),
				zap.String("path", c.Request().URL.Path),
				zap.Int("status", c.Response().Status),
				zap.Duration("latency", latency),
				zap.Int64("latency_ms", latency.Milliseconds()),
				zap.String("client_ip", c.RealIP()),
				zap.String("user_agent", c.Request().UserAgent()),
			}

			status := c.Response().Status
			switch {
			case status >= 500:
				log.Error("server error", fields...)
			case status >= 400:
				log.Warn("client error", fields...)
			default:
				log.Info("request", fields...)
			}

			return err
		}
	}
}
