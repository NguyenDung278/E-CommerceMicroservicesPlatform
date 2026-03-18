# Multi-stage Dockerfile for cart-service
# Stage 1: Build
FROM golang:1.21-alpine AS builder

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source files
COPY . .

# Build the application (static binary for scratch)
RUN CGO_ENABLED=0 GOOS=linux go build -o cart-service ./cmd/main.go

# Stage 2: Run
FROM scratch

# Copy CA certificates for TLS (required for external API calls)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy binary from builder stage
COPY --from=builder /app/cart-service /cart-service

# Set environment variables (defaults)
ENV CONFIG_PATH=/config/config.yaml

# Create config directory
RUN mkdir -p /config

# Expose service ports (HTTP and gRPC)
EXPOSE 8083
EXPOSE 50053

# Health check configuration (for Kubernetes)
HEALTHCHECK --interval=30s --timeout=3s \
    CMD ["/cart-service", "health-check"]

# Run the service
ENTRYPOINT ["/cart-service"]
