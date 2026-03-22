package observability

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/labstack/echo/v4"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	otelcodes "go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	sdkresource "go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

func SetupTracing(ctx context.Context, serviceName string, cfg config.TracingConfig, log *zap.Logger) (func(context.Context) error, error) {
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	if !cfg.Enabled {
		return func(context.Context) error { return nil }, nil
	}

	exporter, err := newTraceExporter(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP trace exporter: %w", err)
	}

	sampleRatio := cfg.SampleRatio
	if sampleRatio <= 0 || sampleRatio > 1 {
		sampleRatio = 1
	}

	resource := sdkresource.NewWithAttributes(
		"",
		attribute.String("service.name", serviceName),
	)

	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource),
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(sampleRatio))),
	)

	otel.SetTracerProvider(provider)
	log.Info("OpenTelemetry tracing enabled",
		zap.String("service", serviceName),
		zap.String("endpoint", strings.TrimSpace(cfg.Endpoint)),
		zap.Float64("sample_ratio", sampleRatio),
	)

	return provider.Shutdown, nil
}

func EchoMiddleware(serviceName string) echo.MiddlewareFunc {
	tracer := otel.Tracer(serviceName)

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			req := c.Request()
			ctx := otel.GetTextMapPropagator().Extract(req.Context(), propagation.HeaderCarrier(req.Header))

			route := c.Path()
			if route == "" {
				route = req.URL.Path
			}

			ctx, span := tracer.Start(ctx, req.Method+" "+route, trace.WithSpanKind(trace.SpanKindServer))
			defer span.End()

			span.SetAttributes(
				attribute.String("http.method", req.Method),
				attribute.String("http.route", route),
				attribute.String("http.target", req.URL.RequestURI()),
				attribute.String("http.client_ip", c.RealIP()),
			)

			c.SetRequest(req.WithContext(ctx))
			err := next(c)

			status := c.Response().Status
			if status == 0 {
				status = http.StatusOK
			}
			span.SetAttributes(attribute.Int("http.status_code", status))

			if err != nil {
				span.RecordError(err)
				span.SetStatus(otelcodes.Error, err.Error())
				return err
			}
			if status >= http.StatusInternalServerError {
				span.SetStatus(otelcodes.Error, http.StatusText(status))
				return nil
			}

			span.SetStatus(otelcodes.Ok, http.StatusText(status))
			return nil
		}
	}
}

func WrapHTTPTransport(base http.RoundTripper) http.RoundTripper {
	if base == nil {
		base = http.DefaultTransport
	}

	return otelhttp.NewTransport(base)
}

func newTraceExporter(ctx context.Context, cfg config.TracingConfig) (sdktrace.SpanExporter, error) {
	endpoint := strings.TrimSpace(cfg.Endpoint)
	if endpoint == "" {
		endpoint = "http://localhost:4318"
	}

	parsed, err := url.Parse(endpoint)
	if err != nil {
		return nil, fmt.Errorf("invalid OTLP endpoint: %w", err)
	}

	clientOptions := []otlptracehttp.Option{
		otlptracehttp.WithTimeout(5 * time.Second),
	}

	hostPort := parsed.Host
	if hostPort == "" {
		hostPort = parsed.Path
	}
	if hostPort != "" {
		clientOptions = append(clientOptions, otlptracehttp.WithEndpoint(hostPort))
	}
	if parsed.Scheme == "" || strings.EqualFold(parsed.Scheme, "http") {
		clientOptions = append(clientOptions, otlptracehttp.WithInsecure())
	}

	return otlptracehttp.New(ctx, clientOptions...)
}
