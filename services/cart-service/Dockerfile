FROM golang:1.25-alpine AS builder

WORKDIR /src

COPY pkg/go.mod pkg/go.sum ./pkg/
COPY services/cart-service/go.mod services/cart-service/go.sum ./services/cart-service/

WORKDIR /src/services/cart-service
RUN go mod download

WORKDIR /src
COPY pkg ./pkg
COPY services/cart-service ./services/cart-service

WORKDIR /src/services/cart-service
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/cart-service ./cmd/main.go

FROM gcr.io/distroless/static-debian12:nonroot

ENV CONFIG_PATH=/config/config.yaml

COPY --from=builder /out/cart-service /app/cart-service

EXPOSE 8083

ENTRYPOINT ["/app/cart-service"]
