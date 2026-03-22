// Package config provides a centralized configuration loader using Viper.
// It supports loading from environment variables, .env files, and YAML/JSON config files.
//
// WHY: In a microservices architecture, each service needs its own configuration
// (DB host, ports, secrets), but the loading mechanism should be consistent.
// Viper gives us a single abstraction for env vars, files, and defaults.
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
)

// Config holds all configuration for a microservice.
// Each service can embed this struct and add service-specific fields.
type Config struct {
	Server         ServerConfig         `mapstructure:"server"`
	Database       DatabaseConfig       `mapstructure:"database"`
	Redis          RedisConfig          `mapstructure:"redis"`
	RabbitMQ       RabbitMQConfig       `mapstructure:"rabbitmq"`
	JWT            JWTConfig            `mapstructure:"jwt"`
	GRPC           GRPCConfig           `mapstructure:"grpc"`
	SMTP           SMTPConfig           `mapstructure:"smtp"`
	Services       ServicesConfig       `mapstructure:"services"`
	Frontend       FrontendConfig       `mapstructure:"frontend"`
	PaymentGateway PaymentGatewayConfig `mapstructure:"payment_gateway"`
	ObjectStorage  ObjectStorageConfig  `mapstructure:"object_storage"`
	Tracing        TracingConfig        `mapstructure:"tracing"`
	Search         SearchConfig         `mapstructure:"search"`
}

// GRPCConfig holds gRPC server settings.
type GRPCConfig struct {
	Port string `mapstructure:"port"`
}

// ServicesConfig holds URLs to other microservices.
type ServicesConfig struct {
	ProductService     string `mapstructure:"product_service"`
	ProductServiceGRPC string `mapstructure:"product_service_grpc"`
	UserService        string `mapstructure:"user_service"`
	CartService        string `mapstructure:"cart_service"`
	OrderService       string `mapstructure:"order_service"`
	PaymentService     string `mapstructure:"payment_service"`
}

type SMTPConfig struct {
	Host        string `mapstructure:"host"`
	Port        string `mapstructure:"port"`
	Username    string `mapstructure:"username"`
	Password    string `mapstructure:"password"`
	FromName    string `mapstructure:"from_name"`
	FromAddress string `mapstructure:"from_address"`
}

type FrontendConfig struct {
	BaseURL string `mapstructure:"base_url"`
}

type PaymentGatewayConfig struct {
	WebhookSecret string `mapstructure:"webhook_secret"`
	MomoReturnURL string `mapstructure:"momo_return_url"`
}

type TracingConfig struct {
	Enabled     bool    `mapstructure:"enabled"`
	Endpoint    string  `mapstructure:"endpoint"`
	SampleRatio float64 `mapstructure:"sample_ratio"`
}

type SearchConfig struct {
	Enabled        bool   `mapstructure:"enabled"`
	Provider       string `mapstructure:"provider"`
	Endpoint       string `mapstructure:"endpoint"`
	Index          string `mapstructure:"index"`
	Username       string `mapstructure:"username"`
	Password       string `mapstructure:"password"`
	APIKey         string `mapstructure:"api_key"`
	RequestTimeout int    `mapstructure:"request_timeout"`
	SyncOnStartup  bool   `mapstructure:"sync_on_startup"`
}

type ObjectStorageConfig struct {
	Endpoint      string `mapstructure:"endpoint"`
	AccessKey     string `mapstructure:"access_key"`
	SecretKey     string `mapstructure:"secret_key"`
	Bucket        string `mapstructure:"bucket"`
	UseSSL        bool   `mapstructure:"use_ssl"`
	PublicBaseURL string `mapstructure:"public_base_url"`
}

// ServerConfig holds HTTP server settings.
type ServerConfig struct {
	Port         string `mapstructure:"port"`
	Host         string `mapstructure:"host"`
	ReadTimeout  int    `mapstructure:"read_timeout"`  // seconds
	WriteTimeout int    `mapstructure:"write_timeout"` // seconds
}

// DatabaseConfig holds PostgreSQL connection settings.
type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     string `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	DBName   string `mapstructure:"dbname"`
	SSLMode  string `mapstructure:"sslmode"`
}

// DSN returns the PostgreSQL connection string.
// Format: "host=X port=X user=X password=X dbname=X sslmode=X"
func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode,
	)
}

// RedisConfig holds Redis connection settings.
type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     string `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

// Addr returns the Redis address in "host:port" format.
func (r RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%s", r.Host, r.Port)
}

// RabbitMQConfig holds RabbitMQ connection settings.
type RabbitMQConfig struct {
	Host     string `mapstructure:"host"`
	Port     string `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
}

// URL returns the AMQP connection URL.
func (r RabbitMQConfig) URL() string {
	return fmt.Sprintf("amqp://%s:%s@%s:%s/", r.User, r.Password, r.Host, r.Port)
}

func (s SMTPConfig) Addr() string {
	return fmt.Sprintf("%s:%s", s.Host, s.Port)
}

// JWTConfig holds JWT authentication settings.
type JWTConfig struct {
	Secret     string `mapstructure:"secret"`
	Expiration int    `mapstructure:"expiration"` // hours
}

// Load reads configuration from environment variables and optional config files.
//
// PATTERN: Environment variables are prefixed with the service name (e.g., USER_SERVICE_SERVER_PORT).
// This prevents collisions when multiple services run on the same host during development.
//
// PRIORITY (highest to lowest):
//  1. Environment variables
//  2. Config file (config.yaml)
//  3. Default values
func Load(serviceName string) (*Config, error) {
	v := viper.New()

	// Set defaults — these are sane development defaults.
	// In production, all values should come from env vars or config files.
	v.SetDefault("server.port", "8080")
	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.read_timeout", 10)
	v.SetDefault("server.write_timeout", 10)
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", "5432")
	v.SetDefault("database.user", "postgres")
	v.SetDefault("database.password", "postgres")
	v.SetDefault("database.dbname", serviceName)
	v.SetDefault("database.sslmode", "disable")
	v.SetDefault("redis.host", "localhost")
	v.SetDefault("redis.port", "6379")
	v.SetDefault("redis.password", "")
	v.SetDefault("redis.db", 0)
	v.SetDefault("rabbitmq.host", "localhost")
	v.SetDefault("rabbitmq.port", "5672")
	v.SetDefault("rabbitmq.user", "guest")
	v.SetDefault("rabbitmq.password", "guest")
	v.SetDefault("jwt.secret", "change-me-in-production")
	v.SetDefault("jwt.expiration", 24)
	v.SetDefault("grpc.port", "50051")
	v.SetDefault("smtp.host", "")
	v.SetDefault("smtp.port", "587")
	v.SetDefault("smtp.username", "")
	v.SetDefault("smtp.password", "")
	v.SetDefault("smtp.from_name", "ND Shop")
	v.SetDefault("smtp.from_address", "")
	v.SetDefault("services.product_service", "product-service:8082")
	v.SetDefault("services.product_service_grpc", "product-service:50052")
	v.SetDefault("services.user_service", "user-service:8081")
	v.SetDefault("services.cart_service", "cart-service:8083")
	v.SetDefault("services.order_service", "order-service:8084")
	v.SetDefault("services.payment_service", "payment-service:8085")
	v.SetDefault("frontend.base_url", "http://localhost:4173")
	v.SetDefault("payment_gateway.webhook_secret", "dev-momo-secret")
	v.SetDefault("payment_gateway.momo_return_url", "http://localhost:4173/payments")
	v.SetDefault("object_storage.endpoint", "minio:9000")
	v.SetDefault("object_storage.access_key", "minioadmin")
	v.SetDefault("object_storage.secret_key", "minioadmin")
	v.SetDefault("object_storage.bucket", "product-media")
	v.SetDefault("object_storage.use_ssl", false)
	v.SetDefault("object_storage.public_base_url", "http://localhost:9000/product-media")
	v.SetDefault("tracing.enabled", false)
	v.SetDefault("tracing.endpoint", "http://localhost:4318")
	v.SetDefault("tracing.sample_ratio", 1.0)
	v.SetDefault("search.enabled", false)
	v.SetDefault("search.provider", "elasticsearch")
	v.SetDefault("search.endpoint", "http://localhost:9200")
	v.SetDefault("search.index", "products")
	v.SetDefault("search.username", "")
	v.SetDefault("search.password", "")
	v.SetDefault("search.api_key", "")
	v.SetDefault("search.request_timeout", 5)
	v.SetDefault("search.sync_on_startup", true)

	// Enable reading from environment variables.
	// E.g., SERVER_PORT maps to server.port
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Optionally read from a config file.
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")

	// CONFIG_PATH lets containers mount a single explicit config file.
	if configPath := os.Getenv("CONFIG_PATH"); configPath != "" {
		v.SetConfigFile(configPath)
		if info, err := os.Stat(configPath); err == nil && !info.IsDir() {
			v.AddConfigPath(filepath.Dir(configPath))
		}
	}

	// It's OK if the config file doesn't exist — we fall back to env vars and defaults.
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	return &cfg, nil
}
