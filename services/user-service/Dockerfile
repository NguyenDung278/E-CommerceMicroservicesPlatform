# syntax=docker/dockerfile:1.7
FROM golang:1.25-alpine AS builder

WORKDIR /src

COPY pkg/go.mod pkg/go.sum ./pkg/
COPY proto/go.mod proto/go.sum ./proto/
COPY services/user-service/go.mod services/user-service/go.sum ./services/user-service/

WORKDIR /src/services/user-service
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

WORKDIR /src
COPY pkg ./pkg
COPY proto ./proto
COPY services/user-service ./services/user-service

WORKDIR /src/services/user-service
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/user-service ./cmd/main.go

FROM gcr.io/distroless/static-debian12:nonroot

ENV CONFIG_PATH=/config/config.yaml

COPY --from=builder /out/user-service /app/user-service

EXPOSE 8081 50051

ENTRYPOINT ["/app/user-service"]
