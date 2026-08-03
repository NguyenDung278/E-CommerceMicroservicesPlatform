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

// Environment names recognised by App.Env (APP_ENV).
const (
	EnvDevelopment = "development"
	EnvStaging     = "staging"
	EnvProduction  = "production"
)

// Default placeholder secrets. They exist so local dev works out of the box,
// and validateProductionSecrets refuses to boot production with any of them.
const (
	defaultJWTSecret        = "change-me-in-production"
	defaultDatabasePassword = "postgres"
	defaultRabbitMQPassword = "guest"
	defaultWebhookSecret    = "dev-momo-secret"
	defaultSecretPepper     = "change-me"
	defaultObjectStorageKey = "minioadmin"
)

// AppConfig identifies which environment the service is running in.
type AppConfig struct {
	Env string `mapstructure:"env"`
}

// Config holds all configuration for a microservice.
// Each service can embed this struct and add service-specific fields.
type Config struct {
	App               AppConfig               `mapstructure:"app"`
	Server            ServerConfig            `mapstructure:"server"`
	Database          DatabaseConfig          `mapstructure:"database"`
	Redis             RedisConfig             `mapstructure:"redis"`
	Reviews           ReviewsConfig           `mapstructure:"reviews"`
	RabbitMQ          RabbitMQConfig          `mapstructure:"rabbitmq"`
	JWT               JWTConfig               `mapstructure:"jwt"`
	GRPC              GRPCConfig              `mapstructure:"grpc"`
	SMTP              SMTPConfig              `mapstructure:"smtp"`
	OAuth             OAuthConfig             `mapstructure:"oauth"`
	Services          ServicesConfig          `mapstructure:"services"`
	Frontend          FrontendConfig          `mapstructure:"frontend"`
	Notification      NotificationConfig      `mapstructure:"notification"`
	PaymentGateway    PaymentGatewayConfig    `mapstructure:"payment_gateway"`
	ObjectStorage     ObjectStorageConfig     `mapstructure:"object_storage"`
	Tracing           TracingConfig           `mapstructure:"tracing"`
	Search            SearchConfig            `mapstructure:"search"`
	Bootstrap         BootstrapConfig         `mapstructure:"bootstrap"`
	Telegram          TelegramConfig          `mapstructure:"telegram"`
	EmailVerification EmailVerificationConfig `mapstructure:"email_verification"`
}

type TelegramConfig struct {
	Enabled                  bool   `mapstructure:"enabled"`
	BotToken                 string `mapstructure:"bot_token"`
	APIBaseURL               string `mapstructure:"api_base_url"`
	OTPMessageTTLSeconds     int    `mapstructure:"otp_message_ttl_seconds"`
	OTPResendCooldownSeconds int    `mapstructure:"otp_resend_cooldown_seconds"`
	OTPMaxAttempts           int    `mapstructure:"otp_max_attempts"`
	OTPDailyLimitPerUser     int    `mapstructure:"otp_daily_limit_per_user"`
	OTPHourlyLimitPerIP      int    `mapstructure:"otp_hourly_limit_per_ip"`
	SecretPepper             string `mapstructure:"secret_pepper"`
}

type EmailVerificationConfig struct {
	OTPMessageTTLSeconds     int    `mapstructure:"otp_message_ttl_seconds"`
	OTPResendCooldownSeconds int    `mapstructure:"otp_resend_cooldown_seconds"`
	OTPMaxAttempts           int    `mapstructure:"otp_max_attempts"`
	OTPDailyLimitPerUser     int    `mapstructure:"otp_daily_limit_per_user"`
	OTPHourlyLimitPerIP      int    `mapstructure:"otp_hourly_limit_per_ip"`
	SecretPepper             string `mapstructure:"secret_pepper"`
}

type BootstrapConfig struct {
	DevAccounts DevAccountsConfig `mapstructure:"dev_accounts"`
}

type DevAccountsConfig struct {
	Enabled       bool   `mapstructure:"enabled"`
	AdminPassword string `mapstructure:"admin_password"`
	StaffPassword string `mapstructure:"staff_password"`
}

// GRPCConfig holds gRPC server settings.
type GRPCConfig struct {
	Port string `mapstructure:"port"`
}

// ServicesConfig holds URLs to other microservices.
type ServicesConfig struct {
	ProductService      string `mapstructure:"product_service"`
	ProductServiceGRPC  string `mapstructure:"product_service_grpc"`
	UserService         string `mapstructure:"user_service"`
	CartService         string `mapstructure:"cart_service"`
	OrderService        string `mapstructure:"order_service"`
	PaymentService      string `mapstructure:"payment_service"`
	NotificationService string `mapstructure:"notification_service"`
}

type SMTPConfig struct {
	Host        string `mapstructure:"host"`
	Port        string `mapstructure:"port"`
	Username    string `mapstructure:"username"`
	Password    string `mapstructure:"password"`
	FromName    string `mapstructure:"from_name"`
	FromAddress string `mapstructure:"from_address"`
}

type OAuthConfig struct {
	Google OAuthProviderConfig `mapstructure:"google"`
}

type OAuthProviderConfig struct {
	ClientID     string `mapstructure:"client_id"`
	ClientSecret string `mapstructure:"client_secret"`
	RedirectURL  string `mapstructure:"redirect_url"`
}

type FrontendConfig struct {
	BaseURL string `mapstructure:"base_url"`
}

type NotificationConfig struct {
	WorkerCount                 int `mapstructure:"worker_count"`
	PrefetchCount               int `mapstructure:"prefetch_count"`
	MaxRetries                  int `mapstructure:"max_retries"`
	RetryDelaySeconds           int `mapstructure:"retry_delay_seconds"`
	RetryMaxDelaySeconds        int `mapstructure:"retry_max_delay_seconds"`
	InboxTTLHours               int `mapstructure:"inbox_ttl_hours"`
	ProcessingTTLSeconds        int `mapstructure:"processing_ttl_seconds"`
	QueueMetricsIntervalSeconds int `mapstructure:"queue_metrics_interval_seconds"`
	WishlistPollIntervalSeconds int `mapstructure:"wishlist_poll_interval_seconds"`
	WishlistBatchLimit          int `mapstructure:"wishlist_batch_limit"`

	LowStockPollIntervalSeconds int `mapstructure:"low_stock_poll_interval_seconds"`
	LowStockThreshold           int `mapstructure:"low_stock_threshold"`
	LowStockBatchLimit          int `mapstructure:"low_stock_batch_limit"`

	// LowStockRecipients là danh sách email nhận cảnh báo tồn kho, phân tách bởi
	// dấu phẩy. Để trống thì worker không chạy — cảnh báo vận hành không có địa
	// chỉ mặc định nào an toàn để đoán, và đây không phải secret bắt buộc nên
	// không đưa vào validateProductionSecrets.
	LowStockRecipients string `mapstructure:"low_stock_recipients"`
}

// LowStockRecipientList tách chuỗi config thành danh sách địa chỉ.
func (c NotificationConfig) LowStockRecipientList() []string {
	raw := strings.Split(c.LowStockRecipients, ",")
	recipients := make([]string, 0, len(raw))
	for _, value := range raw {
		if address := strings.TrimSpace(value); address != "" {
			recipients = append(recipients, address)
		}
	}
	return recipients
}

type PaymentGatewayConfig struct {
	// WebhookSecret là secret ký webhook của MoMo. Giữ nguyên tên key để không
	// phá vỡ biến môi trường PAYMENT_GATEWAY_WEBHOOK_SECRET đang dùng.
	WebhookSecret string `mapstructure:"webhook_secret"`
	MomoReturnURL string `mapstructure:"momo_return_url"`

	// VNPay là provider tùy chọn: để trống thì cổng không được đăng ký và
	// request chọn phương thức `vnpay` bị từ chối ở biên thay vì đi vào luồng hỏng.
	VNPayWebhookSecret string `mapstructure:"vnpay_webhook_secret"`
	VNPayReturnURL     string `mapstructure:"vnpay_return_url"`
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

type ReviewsConfig struct {
	CacheEnabled    bool `mapstructure:"cache_enabled"`
	CacheTTLSeconds int  `mapstructure:"cache_ttl_seconds"`
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
// NOTE: Even though the function accepts serviceName, the current implementation
// does not apply an environment-variable prefix (there is no v.SetEnvPrefix call).
// Today, serviceName is only reused for defaults such as database.dbname.
// Keep this in mind before assuming variables are namespaced per service.
//
// PRIORITY (highest to lowest):
//  1. Environment variables
//  2. Config file (config.yaml)
//  3. Default values
func Load(serviceName string) (*Config, error) {
	v := viper.New()

	// Set defaults — these are sane development defaults.
	// In production, all values should come from env vars or config files;
	// Load fails fast when APP_ENV=production still uses placeholder secrets.
	v.SetDefault("app.env", EnvDevelopment)
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
	v.SetDefault("reviews.cache_enabled", false)
	v.SetDefault("reviews.cache_ttl_seconds", 60)
	v.SetDefault("rabbitmq.host", "localhost")
	v.SetDefault("rabbitmq.port", "5672")
	v.SetDefault("rabbitmq.user", "guest")
	v.SetDefault("rabbitmq.password", "guest")
	v.SetDefault("jwt.secret", defaultJWTSecret)
	v.SetDefault("jwt.expiration", 24)
	v.SetDefault("grpc.port", "50051")
	v.SetDefault("smtp.host", "")
	v.SetDefault("smtp.port", "587")
	v.SetDefault("smtp.username", "")
	v.SetDefault("smtp.password", "")
	v.SetDefault("smtp.from_name", "ND Shop")
	v.SetDefault("smtp.from_address", "")
	v.SetDefault("oauth.google.client_id", "")
	v.SetDefault("oauth.google.client_secret", "")
	v.SetDefault("oauth.google.redirect_url", "http://localhost:8080/api/v1/auth/oauth/google/callback")
	v.SetDefault("services.product_service", "http://product-service:8082")
	v.SetDefault("services.product_service_grpc", "product-service:50052")
	v.SetDefault("services.user_service", "http://user-service:8081")
	v.SetDefault("services.cart_service", "http://cart-service:8083")
	v.SetDefault("services.order_service", "http://order-service:8084")
	v.SetDefault("services.payment_service", "http://payment-service:8085")
	v.SetDefault("services.notification_service", "http://notification-service:8086")
	v.SetDefault("frontend.base_url", "http://localhost:3000")
	v.SetDefault("notification.worker_count", 4)
	v.SetDefault("notification.prefetch_count", 8)
	v.SetDefault("notification.max_retries", 5)
	v.SetDefault("notification.retry_delay_seconds", 30)
	v.SetDefault("notification.retry_max_delay_seconds", 300)
	v.SetDefault("notification.inbox_ttl_hours", 168)
	v.SetDefault("notification.processing_ttl_seconds", 300)
	v.SetDefault("notification.queue_metrics_interval_seconds", 15)
	v.SetDefault("notification.wishlist_poll_interval_seconds", 300)
	v.SetDefault("notification.wishlist_batch_limit", 50)
	// 15 phút: tồn kho thấp là trạng thái kéo dài nhiều giờ tới nhiều ngày, quét
	// dày hơn không làm ops biết sớm hơn mà chỉ tốn query.
	v.SetDefault("notification.low_stock_poll_interval_seconds", 900)
	v.SetDefault("notification.low_stock_threshold", 5)
	v.SetDefault("notification.low_stock_batch_limit", 50)
	v.SetDefault("notification.low_stock_recipients", "")
	v.SetDefault("payment_gateway.webhook_secret", defaultWebhookSecret)
	v.SetDefault("payment_gateway.momo_return_url", "http://localhost:3000/payments")
	v.SetDefault("payment_gateway.vnpay_webhook_secret", "")
	v.SetDefault("payment_gateway.vnpay_return_url", "http://localhost:3000/payments")
	v.SetDefault("object_storage.endpoint", "minio:9000")
	v.SetDefault("object_storage.access_key", defaultObjectStorageKey)
	v.SetDefault("object_storage.secret_key", defaultObjectStorageKey)
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
	v.SetDefault("bootstrap.dev_accounts.enabled", false)
	v.SetDefault("bootstrap.dev_accounts.admin_password", "")
	v.SetDefault("bootstrap.dev_accounts.staff_password", "")
	v.SetDefault("telegram.enabled", false)
	v.SetDefault("telegram.bot_token", "")
	v.SetDefault("telegram.api_base_url", "https://api.telegram.org")
	v.SetDefault("telegram.otp_message_ttl_seconds", 300)
	v.SetDefault("telegram.otp_resend_cooldown_seconds", 60)
	v.SetDefault("telegram.otp_max_attempts", 5)
	v.SetDefault("telegram.otp_daily_limit_per_user", 5)
	v.SetDefault("telegram.otp_hourly_limit_per_ip", 10)
	v.SetDefault("telegram.secret_pepper", defaultSecretPepper)
	v.SetDefault("email_verification.otp_message_ttl_seconds", 600)
	v.SetDefault("email_verification.otp_resend_cooldown_seconds", 60)
	v.SetDefault("email_verification.otp_max_attempts", 5)
	v.SetDefault("email_verification.otp_daily_limit_per_user", 5)
	v.SetDefault("email_verification.otp_hourly_limit_per_ip", 10)
	v.SetDefault("email_verification.secret_pepper", defaultSecretPepper)

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

	// Fail fast: a service must never boot in production while still using
	// placeholder secrets — a silent fallback here means everyone knows the
	// JWT signing key.
	if cfg.IsProduction() {
		if err := cfg.validateProductionSecrets(serviceName); err != nil {
			return nil, err
		}
	}

	return &cfg, nil
}

// IsProduction reports whether the service runs with APP_ENV=production.
func (c *Config) IsProduction() bool {
	return strings.EqualFold(strings.TrimSpace(c.App.Env), EnvProduction)
}

// isPlaceholderSecret catches empty values and every "change-me" style
// placeholder used across .env examples and compose defaults — string
// equality with one default is not enough because compose ships its own
// placeholder values (e.g. "change-me-jwt-secret-at-least-32-chars").
func isPlaceholderSecret(value string) bool {
	trimmed := strings.TrimSpace(value)
	return trimmed == "" || strings.Contains(strings.ToLower(trimmed), "change-me")
}

// validateProductionSecrets rejects placeholder secrets in production.
// Checks are scoped per service so a service is not blocked by secrets of
// subsystems it never touches (e.g. cart-service has no PostgreSQL).
func (c *Config) validateProductionSecrets(serviceName string) error {
	var problems []string

	// Every service validates JWT tokens, so the signing secret is universal.
	if isPlaceholderSecret(c.JWT.Secret) || len(c.JWT.Secret) < 32 {
		problems = append(problems, "jwt.secret (JWT_SECRET) must be a random string of at least 32 characters, not a placeholder")
	}

	switch serviceName {
	case "user-service", "product-service", "order-service", "payment-service":
		if isPlaceholderSecret(c.Database.Password) || c.Database.Password == defaultDatabasePassword {
			problems = append(problems, "database.password (DATABASE_PASSWORD) must not be empty, a placeholder, or the development default")
		}
	}

	switch serviceName {
	case "order-service", "payment-service", "notification-service":
		if isPlaceholderSecret(c.RabbitMQ.Password) || c.RabbitMQ.Password == defaultRabbitMQPassword {
			problems = append(problems, "rabbitmq.password (RABBITMQ_PASSWORD) must not be empty, a placeholder, or \"guest\"")
		}
	}

	if serviceName == "payment-service" {
		if isPlaceholderSecret(c.PaymentGateway.WebhookSecret) || c.PaymentGateway.WebhookSecret == defaultWebhookSecret {
			problems = append(problems, "payment_gateway.webhook_secret (PAYMENT_GATEWAY_WEBHOOK_SECRET) must not be empty, a placeholder, or the development default")
		}
		// VNPay là optional: để trống nghĩa là không bật cổng đó. Nhưng đã bật
		// thì secret phải thật, không được là placeholder.
		if strings.TrimSpace(c.PaymentGateway.VNPayWebhookSecret) != "" &&
			isPlaceholderSecret(c.PaymentGateway.VNPayWebhookSecret) {
			problems = append(problems, "payment_gateway.vnpay_webhook_secret (PAYMENT_GATEWAY_VNPAY_WEBHOOK_SECRET) must not be a placeholder when VNPay is enabled")
		}
	}

	if serviceName == "user-service" {
		if c.Bootstrap.DevAccounts.Enabled {
			problems = append(problems, "bootstrap.dev_accounts.enabled must be false in production")
		}
		if c.Telegram.Enabled && isPlaceholderSecret(c.Telegram.SecretPepper) {
			problems = append(problems, "telegram.secret_pepper (TELEGRAM_SECRET_PEPPER) must not be empty or a placeholder")
		}
		if isPlaceholderSecret(c.EmailVerification.SecretPepper) {
			problems = append(problems, "email_verification.secret_pepper (EMAIL_VERIFICATION_SECRET_PEPPER) must not be empty or a placeholder")
		}
	}

	if serviceName == "product-service" {
		if c.ObjectStorage.AccessKey == defaultObjectStorageKey || c.ObjectStorage.SecretKey == defaultObjectStorageKey {
			problems = append(problems, "object_storage access/secret key (OBJECT_STORAGE_ACCESS_KEY / OBJECT_STORAGE_SECRET_KEY) must not be \"minioadmin\"")
		}
	}

	if len(problems) > 0 {
		return fmt.Errorf("unsafe production config for %s:\n  - %s", serviceName, strings.Join(problems, "\n  - "))
	}
	return nil
}
