package repository

import (
	"context"
	"os/exec"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/database"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

func TestPostgresUserRepositoryIntegration(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "postgres:15-alpine",
			ExposedPorts: []string{"5432/tcp"},
			Env: map[string]string{
				"POSTGRES_DB":       "ecommerce",
				"POSTGRES_USER":     "admin",
				"POSTGRES_PASSWORD": "password123",
			},
			WaitingFor: wait.ForLog("database system is ready to accept connections").WithOccurrence(2).WithStartupTimeout(60 * time.Second),
		},
		Started: true,
	})
	if err != nil {
		t.Fatalf("failed to start postgres container: %v", err)
	}
	defer func() { _ = container.Terminate(ctx) }()

	host, err := container.Host(ctx)
	if err != nil {
		t.Fatalf("failed to get postgres host: %v", err)
	}
	port, err := container.MappedPort(ctx, "5432/tcp")
	if err != nil {
		t.Fatalf("failed to get postgres port: %v", err)
	}

	db, err := database.NewPostgresDB(config.DatabaseConfig{
		Host:     host,
		Port:     port.Port(),
		User:     "admin",
		Password: "password123",
		DBName:   "ecommerce",
		SSLMode:  "disable",
	})
	if err != nil {
		t.Fatalf("failed to connect postgres: %v", err)
	}
	defer db.Close()

	if _, err := db.ExecContext(ctx, `
		CREATE TABLE users (
			id VARCHAR(36) PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			phone VARCHAR(20) UNIQUE,
			phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
			phone_verified_at TIMESTAMP,
			phone_last_changed_at TIMESTAMP,
			password VARCHAR(255) NOT NULL,
			first_name VARCHAR(100) NOT NULL,
			last_name VARCHAR(100) NOT NULL,
			role VARCHAR(20) NOT NULL,
			email_verified BOOLEAN NOT NULL DEFAULT FALSE,
			email_verification_token_hash VARCHAR(64),
			email_verification_expires_at TIMESTAMP,
			password_reset_token_hash VARCHAR(64),
			password_reset_expires_at TIMESTAMP,
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL
		)
	`); err != nil {
		t.Fatalf("failed to create users table: %v", err)
	}

	repo := NewUserRepository(db)
	now := time.Now()
	user := &model.User{
		ID:            "user-1",
		Email:         "alice@example.com",
		Phone:         "0901234567",
		Password:      "hashed-password",
		FirstName:     "Alice",
		LastName:      "Nguyen",
		Role:          "user",
		EmailVerified: false,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := repo.Create(ctx, user); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	got, err := repo.GetByEmail(ctx, user.Email)
	if err != nil {
		t.Fatalf("GetByEmail returned error: %v", err)
	}
	if got == nil || got.Email != user.Email {
		t.Fatalf("expected user %q, got %+v", user.Email, got)
	}
	if got.Phone != user.Phone {
		t.Fatalf("expected phone %q, got %+v", user.Phone, got)
	}
}

func skipIfDockerUnavailable(t *testing.T) {
	t.Helper()

	if _, err := exec.LookPath("docker"); err != nil {
		t.Skip("docker binary not found")
	}

	cmd := exec.Command("docker", "info")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Skipf("docker daemon unavailable: %v (%s)", err, string(output))
	}
}
