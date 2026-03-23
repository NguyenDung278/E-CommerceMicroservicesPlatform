# syntax=docker/dockerfile:1.7
FROM golang:1.25-alpine AS builder

WORKDIR /src

COPY pkg/go.mod pkg/go.sum ./pkg/
COPY proto/go.mod proto/go.sum ./proto/
COPY services/order-service/go.mod services/order-service/go.sum ./services/order-service/

WORKDIR /src/services/order-service
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

WORKDIR /src
COPY pkg ./pkg
COPY proto ./proto
COPY services/order-service ./services/order-service

WORKDIR /src/services/order-service
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/order-service ./cmd/main.go

FROM gcr.io/distroless/static-debian12:nonroot

ENV CONFIG_PATH=/config/config.yaml

COPY --from=builder /out/order-service /app/order-service

EXPOSE 8084

ENTRYPOINT ["/app/order-service"]
