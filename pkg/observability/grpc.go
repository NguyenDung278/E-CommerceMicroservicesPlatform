package observability

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	otelcodes "go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	grpcstatus "google.golang.org/grpc/status"
)

func GRPCUnaryServerInterceptor(serviceName string) grpc.UnaryServerInterceptor {
	tracer := otel.Tracer(serviceName)

	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			md = metadata.New(nil)
		}

		ctx = otel.GetTextMapPropagator().Extract(ctx, metadataCarrier(md))
		ctx, span := tracer.Start(ctx, info.FullMethod, trace.WithSpanKind(trace.SpanKindServer))
		defer span.End()

		span.SetAttributes(
			attribute.String("rpc.system", "grpc"),
			attribute.String("rpc.method", info.FullMethod),
		)

		resp, err := handler(ctx, req)
		recordGRPCStatus(span, err)
		return resp, err
	}
}

func GRPCUnaryClientInterceptor(serviceName string) grpc.UnaryClientInterceptor {
	tracer := otel.Tracer(serviceName)

	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		ctx, span := tracer.Start(ctx, method, trace.WithSpanKind(trace.SpanKindClient))
		defer span.End()

		span.SetAttributes(
			attribute.String("rpc.system", "grpc"),
			attribute.String("rpc.method", method),
		)

		md, ok := metadata.FromOutgoingContext(ctx)
		if !ok {
			md = metadata.New(nil)
		} else {
			md = md.Copy()
		}
		otel.GetTextMapPropagator().Inject(ctx, metadataCarrier(md))
		ctx = metadata.NewOutgoingContext(ctx, md)

		err := invoker(ctx, method, req, reply, cc, opts...)
		recordGRPCStatus(span, err)
		return err
	}
}

type metadataCarrier metadata.MD

func (c metadataCarrier) Get(key string) string {
	values := metadata.MD(c).Get(key)
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

func (c metadataCarrier) Set(key, value string) {
	metadata.MD(c).Set(key, value)
}

func (c metadataCarrier) Keys() []string {
	keys := make([]string, 0, len(c))
	for key := range c {
		keys = append(keys, key)
	}
	return keys
}

var _ propagation.TextMapCarrier = metadataCarrier{}

func recordGRPCStatus(span trace.Span, err error) {
	code := codes.OK
	message := codes.OK.String()
	if err != nil {
		if status, ok := grpcstatus.FromError(err); ok {
			code = status.Code()
			message = status.Message()
		} else {
			code = codes.Unknown
			message = err.Error()
		}
		span.RecordError(err)
		span.SetStatus(otelcodes.Error, message)
	} else {
		span.SetStatus(otelcodes.Ok, message)
	}

	span.SetAttributes(attribute.Int("rpc.grpc.status_code", int(code)))
}
