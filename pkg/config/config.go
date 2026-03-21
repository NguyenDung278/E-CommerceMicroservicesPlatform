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
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	Redis    RedisConfig    `mapstructure:"redis"`
	RabbitMQ RabbitMQConfig `mapstructure:"rabbitmq"`
	JWT      JWTConfig      `mapstructure:"jwt"`
	GRPC     GRPCConfig     `mapstructure:"grpc"`
	SMTP     SMTPConfig     `mapstructure:"smtp"`
	Services ServicesConfig `mapstructure:"services"`
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
