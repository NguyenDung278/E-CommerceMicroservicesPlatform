package middleware

import (
	"net/http"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/labstack/echo/v4"
	"go.opentelemetry.io/otel/trace"
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
			status := c.Response().Status
			if status == 0 {
				if err != nil {
					status = http.StatusInternalServerError
				} else {
					status = http.StatusOK
				}
			}

			route := c.Path()
			if route == "" {
				route = c.Request().URL.Path
			}

			// Log at different levels based on status code.
			fields := []zap.Field{
				zap.String("method", c.Request().Method),
				zap.String("path", c.Request().URL.Path),
				zap.String("route", route),
				zap.Int("status", status),
				zap.Duration("latency", latency),
				zap.Int64("latency_ms", latency.Milliseconds()),
				zap.String("client_ip", c.RealIP()),
				zap.String("user_agent", c.Request().UserAgent()),
				zap.Int64("response_bytes", c.Response().Size),
			}
			if requestID := appobs.RequestIDFromRequest(c.Request()); requestID != "" {
				fields = append(fields, zap.String("request_id", requestID))
			}
			if claims := GetUserClaims(c); claims != nil && claims.UserID != "" {
				fields = append(fields, zap.String("user_id", claims.UserID))
			}
			if spanContext := trace.SpanContextFromContext(c.Request().Context()); spanContext.IsValid() {
				fields = append(fields,
					zap.String("trace_id", spanContext.TraceID().String()),
					zap.String("span_id", spanContext.SpanID().String()),
				)
			}
			if err != nil {
				fields = append(fields, zap.Error(err))
			}

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
