package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os/exec"
	"sync"
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
	db := newProductReviewIntegrationDB(t)

	productRepo := NewProductRepository(db)
	reviewRepo := NewProductReviewRepository(db)
	txManager := NewProductReviewTxManager(db)

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
	if err := productRepo.Create(ctx, product); err != nil {
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

	if err := createReviewInTx(ctx, txManager, reviewA); err != nil {
		t.Fatalf("CreateReview A returned error: %v", err)
	}
	if err := createReviewInTx(ctx, txManager, reviewB); err != nil {
		t.Fatalf("CreateReview B returned error: %v", err)
	}

	got, err := reviewRepo.GetReviewByProductAndUser(ctx, product.ID, "user-1")
	if err != nil {
		t.Fatalf("GetReviewByProductAndUser returned error: %v", err)
	}
	if got == nil || got.Comment != reviewA.Comment {
		t.Fatalf("unexpected review returned: %+v", got)
	}

	if err := txManager.RunInTx(ctx, func(repos ProductReviewTxRepositories) error {
		lockedReview, err := repos.Reviews.GetReviewByProductAndUserForUpdate(ctx, product.ID, "user-1")
		if err != nil {
			return err
		}

		oldRating := lockedReview.Rating
		lockedReview.Comment = "Updated comment"
		lockedReview.Rating = 4
		lockedReview.UpdatedAt = now.Add(2 * time.Minute)
		if err := repos.Reviews.UpdateReview(ctx, lockedReview); err != nil {
			return err
		}

		return repos.Reviews.ApplyReviewSummaryDelta(
			ctx,
			product.ID,
			model.NewProductReviewUpdateDelta(oldRating, lockedReview.Rating, lockedReview.UpdatedAt),
		)
	}); err != nil {
		t.Fatalf("Update review transaction returned error: %v", err)
	}

	summary, err := reviewRepo.GetReviewSummary(ctx, product.ID)
	if err != nil {
		t.Fatalf("GetReviewSummary returned error: %v", err)
	}
	if summary.ReviewCount != 2 || summary.AverageRating != 3.5 {
		t.Fatalf("unexpected summary returned: %+v", summary)
	}
	if summary.RatingBreakdown.Four != 1 || summary.RatingBreakdown.Three != 1 {
		t.Fatalf("unexpected rating breakdown: %+v", summary.RatingBreakdown)
	}

	reviews, err := reviewRepo.ListReviewsByProduct(ctx, product.ID, 0, 10)
	if err != nil {
		t.Fatalf("ListReviewsByProduct returned error: %v", err)
	}
	if len(reviews) != 2 {
		t.Fatalf("expected 2 reviews, got %d", len(reviews))
	}
	if reviews[0].ID != "review-2" {
		t.Fatalf("expected latest review first, got %+v", reviews)
	}

	if err := txManager.RunInTx(ctx, func(repos ProductReviewTxRepositories) error {
		deletedReview, err := repos.Reviews.DeleteReviewByProductAndUser(ctx, product.ID, "user-2")
		if err != nil {
			return err
		}

		return repos.Reviews.ApplyReviewSummaryDelta(
			ctx,
			product.ID,
			model.NewProductReviewDeleteDelta(deletedReview.Rating, time.Now()),
		)
	}); err != nil {
		t.Fatalf("Delete review transaction returned error: %v", err)
	}

	summary, err = reviewRepo.GetReviewSummary(ctx, product.ID)
	if err != nil {
		t.Fatalf("GetReviewSummary after delete returned error: %v", err)
	}
	if summary.ReviewCount != 1 || summary.AverageRating != 4 {
		t.Fatalf("unexpected summary after delete: %+v", summary)
	}
}

func TestPostgresProductReviewRepositoryConcurrentCreateUsesUniqueConstraint(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newProductReviewIntegrationDB(t)
	productRepo := NewProductRepository(db)
	reviewRepo := NewProductReviewRepository(db)
	txManager := NewProductReviewTxManager(db)

	product := &model.Product{
		ID:        "product-1",
		Name:      "Concurrent Reviewable Product",
		Price:     200,
		Status:    "active",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := productRepo.Create(ctx, product); err != nil {
		t.Fatalf("Create product returned error: %v", err)
	}

	const attempts = 8
	var (
		wg            sync.WaitGroup
		mu            sync.Mutex
		successCount  int
		duplicateHits int
	)
	for index := 0; index < attempts; index++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()

			review := &model.ProductReview{
				ID:          fmt.Sprintf("review-%d", index),
				ProductID:   product.ID,
				UserID:      "user-1",
				AuthorLabel: "a***@example.com",
				Rating:      5,
				Comment:     "Excellent",
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			}

			err := createReviewInTx(ctx, txManager, review)
			mu.Lock()
			defer mu.Unlock()
			switch {
			case err == nil:
				successCount++
			case errors.Is(err, model.ErrProductReviewAlreadyExists):
				duplicateHits++
			default:
				t.Errorf("unexpected create error: %v", err)
			}
		}(index)
	}
	wg.Wait()

	if successCount != 1 {
		t.Fatalf("expected exactly one successful create, got %d", successCount)
	}
	if duplicateHits != attempts-1 {
		t.Fatalf("expected %d duplicate conflicts, got %d", attempts-1, duplicateHits)
	}

	var reviewCount int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM product_reviews WHERE product_id = $1`, product.ID).Scan(&reviewCount); err != nil {
		t.Fatalf("failed to count product reviews: %v", err)
	}
	if reviewCount != 1 {
		t.Fatalf("expected one persisted review row, got %d", reviewCount)
	}

	summary, err := reviewRepo.GetReviewSummary(ctx, product.ID)
	if err != nil {
		t.Fatalf("GetReviewSummary returned error: %v", err)
	}
	if summary.ReviewCount != 1 || summary.AverageRating != 5 {
		t.Fatalf("unexpected summary after concurrent create: %+v", summary)
	}
}

func TestProductReviewSummaryMigrationBackfillsExistingData(t *testing.T) {
	skipIfDockerUnavailable(t)

	db := newProductReviewIntegrationDB(t)

	if err := resetReviewSchemaForBackfillTest(db); err != nil {
		t.Fatalf("failed to reset review schema: %v", err)
	}
	if err := runMigrationFiles(db, []string{
		"000001_create_products.up.sql",
		"000002_create_product_reviews.up.sql",
		"000003_add_products_listing_index.up.sql",
	}); err != nil {
		t.Fatalf("failed to prepare pre-summary schema: %v", err)
	}

	ctx := context.Background()
	now := time.Now()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO products (
			id, name, description, price, stock, category, brand, tags, status, sku, variants, image_url, image_urls, created_at, updated_at
		)
		VALUES ($1, $2, '', 199, 10, '', '', '[]'::jsonb, 'active', '', '[]'::jsonb, '', '[]'::jsonb, $3, $3)
	`, "product-1", "Reviewable Product", now); err != nil {
		t.Fatalf("failed to seed product: %v", err)
	}

	if _, err := db.ExecContext(ctx, `
		INSERT INTO product_reviews (id, product_id, user_id, author_label, rating, comment, created_at, updated_at)
		VALUES
			('review-1', 'product-1', 'user-1', 'a***@example.com', 5, 'Excellent', $1, $1),
			('review-2', 'product-1', 'user-2', 'b***@example.com', 3, 'Good', $2, $2)
	`, now, now.Add(time.Minute)); err != nil {
		t.Fatalf("failed to seed product reviews: %v", err)
	}

	if err := runMigrationFiles(db, []string{"000004_create_product_review_summaries.up.sql"}); err != nil {
		t.Fatalf("failed to apply summary migration: %v", err)
	}

	reviewRepo := NewProductReviewRepository(db)
	summary, err := reviewRepo.GetReviewSummary(ctx, "product-1")
	if err != nil {
		t.Fatalf("GetReviewSummary returned error: %v", err)
	}
	if summary.ReviewCount != 2 || summary.AverageRating != 4 {
		t.Fatalf("unexpected summary after backfill: %+v", summary)
	}
	if summary.RatingBreakdown.Five != 1 || summary.RatingBreakdown.Three != 1 {
		t.Fatalf("unexpected backfilled rating breakdown: %+v", summary.RatingBreakdown)
	}
}

func createReviewInTx(ctx context.Context, txManager ProductReviewTxManager, review *model.ProductReview) error {
	return txManager.RunInTx(ctx, func(repos ProductReviewTxRepositories) error {
		if err := repos.Reviews.CreateReview(ctx, review); err != nil {
			return err
		}
		return repos.Reviews.ApplyReviewSummaryDelta(ctx, review.ProductID, model.NewProductReviewCreateDelta(review.Rating, review.UpdatedAt))
	})
}

func newProductReviewIntegrationDB(t *testing.T) *sql.DB {
	t.Helper()

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
	t.Cleanup(func() { _ = container.Terminate(ctx) })

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
	t.Cleanup(func() { _ = db.Close() })

	if err := database.RunPostgresMigrations(db, migrations.Files); err != nil {
		t.Fatalf("failed to run product service migrations: %v", err)
	}

	return db
}

func resetReviewSchemaForBackfillTest(db *sql.DB) error {
	statements := []string{
		`DROP TABLE IF EXISTS product_review_summaries`,
		`DROP TABLE IF EXISTS product_reviews`,
		`DROP TABLE IF EXISTS products`,
		`DROP INDEX IF EXISTS idx_product_reviews_product_created_at_id`,
		`DROP INDEX IF EXISTS idx_product_reviews_product_created_at`,
	}

	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}

	return nil
}

func runMigrationFiles(db *sql.DB, fileNames []string) error {
	for _, fileName := range fileNames {
		contents, err := migrations.Files.ReadFile(fileName)
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", fileName, err)
		}
		if _, err := db.Exec(string(contents)); err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", fileName, err)
		}
	}

	return nil
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
