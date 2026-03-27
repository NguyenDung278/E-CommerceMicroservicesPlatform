package observability

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

const HeaderRequestID = "X-Request-ID"

type contextKey string

const requestIDContextKey contextKey = "request_id"

func RequestIDMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			req := c.Request()
			requestID := strings.TrimSpace(req.Header.Get(HeaderRequestID))
			if requestID == "" {
				requestID = uuid.NewString()
			}

			ctx := WithRequestID(req.Context(), requestID)
			req = req.WithContext(ctx)
			req.Header.Set(HeaderRequestID, requestID)
			c.SetRequest(req)
			c.Response().Header().Set(HeaderRequestID, requestID)

			return next(c)
		}
	}
}

func WithRequestID(ctx context.Context, requestID string) context.Context {
	trimmed := strings.TrimSpace(requestID)
	if trimmed == "" {
		return ctx
	}

	return context.WithValue(ctx, requestIDContextKey, trimmed)
}

func RequestIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}

	if requestID, ok := ctx.Value(requestIDContextKey).(string); ok {
		return strings.TrimSpace(requestID)
	}

	return ""
}

func RequestIDFromRequest(req *http.Request) string {
	if req == nil {
		return ""
	}

	if requestID := RequestIDFromContext(req.Context()); requestID != "" {
		return requestID
	}

	return strings.TrimSpace(req.Header.Get(HeaderRequestID))
}

func ContextFields(ctx context.Context) []zap.Field {
	fields := make([]zap.Field, 0, 3)
	if requestID := RequestIDFromContext(ctx); requestID != "" {
		fields = append(fields, zap.String("request_id", requestID))
	}

	if spanContext := trace.SpanContextFromContext(ctx); spanContext.IsValid() {
		fields = append(fields,
			zap.String("trace_id", spanContext.TraceID().String()),
			zap.String("span_id", spanContext.SpanID().String()),
		)
	}

	return fields
}

func LoggerWithContext(log *zap.Logger, ctx context.Context, fields ...zap.Field) *zap.Logger {
	if log == nil {
		log = zap.NewNop()
	}

	contextFields := ContextFields(ctx)
	if len(fields) > 0 {
		contextFields = append(contextFields, fields...)
	}

	return log.With(contextFields...)
}
