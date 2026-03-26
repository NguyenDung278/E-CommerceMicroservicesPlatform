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
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/migrations"
)

func TestPostgresProductReviewRepositoryIntegration(t *testing.T) {
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

	if err := database.RunPostgresMigrations(db, migrations.Files); err != nil {
		t.Fatalf("failed to run product service migrations: %v", err)
	}

	repo := NewProductRepository(db)
	now := time.Now()
	product := &model.Product{
		ID:          "product-1",
		Name:        "Reviewable Product",
		Description: "A product used for repository review integration tests",
		Price:       199,
		Stock:       8,
		Category:    "Accessories",
		Brand:       "ND Atelier",
		Tags:        []string{"review"},
		Status:      "active",
		SKU:         "SKU-REVIEW-1",
		Variants:    []model.ProductVariant{},
		ImageURL:    "",
		ImageURLs:   []string{},
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := repo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	reviewA := &model.ProductReview{
		ID:          "review-1",
		ProductID:   product.ID,
		UserID:      "user-1",
		AuthorLabel: "a***@example.com",
		Rating:      5,
		Comment:     "Excellent",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	reviewB := &model.ProductReview{
		ID:          "review-2",
		ProductID:   product.ID,
		UserID:      "user-2",
		AuthorLabel: "b***@example.com",
		Rating:      3,
		Comment:     "Solid overall",
		CreatedAt:   now.Add(time.Minute),
		UpdatedAt:   now.Add(time.Minute),
	}

	if err := repo.CreateReview(ctx, reviewA); err != nil {
		t.Fatalf("CreateReview A returned error: %v", err)
	}
	if err := repo.CreateReview(ctx, reviewB); err != nil {
		t.Fatalf("CreateReview B returned error: %v", err)
	}

	got, err := repo.GetReviewByProductAndUser(ctx, product.ID, "user-1")
	if err != nil {
		t.Fatalf("GetReviewByProductAndUser returned error: %v", err)
	}
	if got == nil || got.Comment != reviewA.Comment {
		t.Fatalf("unexpected review returned: %+v", got)
	}

	reviewA.Comment = "Updated comment"
	reviewA.Rating = 4
	reviewA.UpdatedAt = now.Add(2 * time.Minute)
	if err := repo.UpdateReview(ctx, reviewA); err != nil {
		t.Fatalf("UpdateReview returned error: %v", err)
	}

	summary, err := repo.GetReviewSummary(ctx, product.ID)
	if err != nil {
		t.Fatalf("GetReviewSummary returned error: %v", err)
	}
	if summary.ReviewCount != 2 || summary.AverageRating != 3.5 {
		t.Fatalf("unexpected summary returned: %+v", summary)
	}
	if summary.RatingBreakdown.Four != 1 || summary.RatingBreakdown.Three != 1 {
		t.Fatalf("unexpected rating breakdown: %+v", summary.RatingBreakdown)
	}

	reviews, total, err := repo.ListReviewsByProduct(ctx, product.ID, 0, 10)
	if err != nil {
		t.Fatalf("ListReviewsByProduct returned error: %v", err)
	}
	if total != 2 || len(reviews) != 2 {
		t.Fatalf("expected 2 reviews, got total=%d reviews=%d", total, len(reviews))
	}
	if reviews[0].ID != "review-2" {
		t.Fatalf("expected latest review first, got %+v", reviews)
	}

	deleted, err := repo.DeleteReviewByProductAndUser(ctx, product.ID, "user-2")
	if err != nil {
		t.Fatalf("DeleteReviewByProductAndUser returned error: %v", err)
	}
	if !deleted {
		t.Fatal("expected review deletion to return true")
	}

	summary, err = repo.GetReviewSummary(ctx, product.ID)
	if err != nil {
		t.Fatalf("GetReviewSummary after delete returned error: %v", err)
	}
	if summary.ReviewCount != 1 || summary.AverageRating != 4 {
		t.Fatalf("unexpected summary after delete: %+v", summary)
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
