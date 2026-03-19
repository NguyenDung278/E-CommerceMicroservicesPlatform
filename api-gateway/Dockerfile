FROM golang:1.23-alpine AS builder

WORKDIR /src

COPY pkg/go.mod pkg/go.sum ./pkg/
COPY api-gateway/go.mod api-gateway/go.sum ./api-gateway/

WORKDIR /src/api-gateway
RUN go mod download

WORKDIR /src
COPY pkg ./pkg
COPY api-gateway ./api-gateway

WORKDIR /src/api-gateway
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api-gateway ./cmd/main.go

FROM gcr.io/distroless/static-debian12:nonroot

ENV CONFIG_PATH=/config/config.yaml

COPY --from=builder /out/api-gateway /app/api-gateway

EXPOSE 8080

ENTRYPOINT ["/app/api-gateway"]
