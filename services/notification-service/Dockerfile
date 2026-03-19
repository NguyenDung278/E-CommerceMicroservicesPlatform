FROM golang:1.23-alpine AS builder

WORKDIR /src

COPY pkg/go.mod pkg/go.sum ./pkg/
COPY services/notification-service/go.mod services/notification-service/go.sum ./services/notification-service/

WORKDIR /src/services/notification-service
RUN go mod download

WORKDIR /src
COPY pkg ./pkg
COPY services/notification-service ./services/notification-service

WORKDIR /src/services/notification-service
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/notification-service ./cmd/main.go

FROM gcr.io/distroless/static-debian12:nonroot

ENV CONFIG_PATH=/config/config.yaml

COPY --from=builder /out/notification-service /app/notification-service

EXPOSE 8086

ENTRYPOINT ["/app/notification-service"]
