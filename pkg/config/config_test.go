package config

import (
	"strings"
	"testing"
)

func TestLoadDefaultsToDevelopment(t *testing.T) {
	cfg, err := Load("user-service")
	if err != nil {
		t.Fatalf("Load returned error in development mode: %v", err)
	}
	if cfg.IsProduction() {
		t.Fatalf("expected development environment by default, got %q", cfg.App.Env)
	}
}

func TestLoadProductionRejectsPlaceholderSecrets(t *testing.T) {
	t.Setenv("APP_ENV", "production")

	_, err := Load("user-service")
	if err == nil {
		t.Fatal("expected Load to fail fast in production with placeholder secrets")
	}
	if !strings.Contains(err.Error(), "jwt.secret") {
		t.Fatalf("expected error to mention jwt.secret, got: %v", err)
	}
}

func TestLoadProductionRejectsComposePlaceholders(t *testing.T) {
	// Compose ships its own placeholders that are long enough to slip past a
	// naive length check — they must still be rejected.
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "change-me-jwt-secret-at-least-32-chars")
	t.Setenv("DATABASE_PASSWORD", "change-me-db-password")
	t.Setenv("EMAIL_VERIFICATION_SECRET_PEPPER", "strong-pepper")

	_, err := Load("user-service")
	if err == nil {
		t.Fatal("expected Load to reject compose placeholder secrets in production")
	}
	if !strings.Contains(err.Error(), "jwt.secret") || !strings.Contains(err.Error(), "database.password") {
		t.Fatalf("expected error to mention jwt.secret and database.password, got: %v", err)
	}
}

func TestLoadProductionRejectsDevAccounts(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	t.Setenv("DATABASE_PASSWORD", "strong-db-password")
	t.Setenv("EMAIL_VERIFICATION_SECRET_PEPPER", "strong-pepper")
	t.Setenv("BOOTSTRAP_DEV_ACCOUNTS_ENABLED", "true")

	_, err := Load("user-service")
	if err == nil {
		t.Fatal("expected Load to fail when dev accounts are enabled in production")
	}
	if !strings.Contains(err.Error(), "dev_accounts") {
		t.Fatalf("expected error to mention dev_accounts, got: %v", err)
	}
}

func TestLoadProductionAcceptsStrongSecrets(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	t.Setenv("DATABASE_PASSWORD", "strong-db-password")
	t.Setenv("EMAIL_VERIFICATION_SECRET_PEPPER", "strong-pepper")

	cfg, err := Load("user-service")
	if err != nil {
		t.Fatalf("Load returned error despite strong secrets: %v", err)
	}
	if !cfg.IsProduction() {
		t.Fatalf("expected production environment, got %q", cfg.App.Env)
	}
}

func TestLoadProductionScopesChecksPerService(t *testing.T) {
	// cart-service has no PostgreSQL/RabbitMQ, so only the JWT secret matters.
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")

	if _, err := Load("cart-service"); err != nil {
		t.Fatalf("cart-service should not be blocked by secrets it never uses: %v", err)
	}

	// payment-service must additionally reject the default webhook secret.
	t.Setenv("DATABASE_PASSWORD", "strong-db-password")
	t.Setenv("RABBITMQ_PASSWORD", "strong-mq-password")
	_, err := Load("payment-service")
	if err == nil || !strings.Contains(err.Error(), "webhook_secret") {
		t.Fatalf("expected payment-service to reject default webhook secret, got: %v", err)
	}
}
