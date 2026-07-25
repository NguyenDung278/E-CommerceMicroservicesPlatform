package repository

import (
	"context"
	"database/sql"
	"os/exec"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/database"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/migrations"
)

// Test này chạy trên PostgreSQL thật vì thứ cần chứng minh là SQL guard của
// ExpirePendingReservation và vòng quét release của worker, gồm cả cột
// stock_released_at từ migration 000012.

func TestReservationExpiryAndStockReleaseScanIntegration(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	db := newOrderIntegrationDB(t)
	repo := NewOrderRepository(db)

	expiredOrder := newIntegrationPendingOrder(time.Now().UTC().Add(-time.Minute))
	if err := repo.Create(ctx, expiredOrder, nil); err != nil {
		t.Fatalf("Create expired order returned error: %v", err)
	}

	allocatedAt := time.Now().UTC()
	allocatedOrder := newIntegrationPendingOrder(time.Now().UTC().Add(-time.Minute))
	allocatedOrder.ReservationAllocatedAt = &allocatedAt
	if err := repo.Create(ctx, allocatedOrder, nil); err != nil {
		t.Fatalf("Create allocated order returned error: %v", err)
	}

	unexpiredOrder := newIntegrationPendingOrder(time.Now().UTC().Add(10 * time.Minute))
	if err := repo.Create(ctx, unexpiredOrder, nil); err != nil {
		t.Fatalf("Create unexpired order returned error: %v", err)
	}

	expiredIDs, err := repo.ListExpiredPendingReservationOrderIDs(ctx, 10)
	if err != nil {
		t.Fatalf("ListExpiredPendingReservationOrderIDs returned error: %v", err)
	}
	if len(expiredIDs) != 1 || expiredIDs[0] != expiredOrder.ID {
		t.Fatalf("expected only the expired unallocated order %s, got %v", expiredOrder.ID, expiredIDs)
	}

	transitioned, err := repo.ExpirePendingReservation(ctx, expiredOrder.ID, "reservation-expiry-worker", "system", "", nil)
	if err != nil {
		t.Fatalf("ExpirePendingReservation returned error: %v", err)
	}
	if !transitioned {
		t.Fatal("expected expired order to transition to cancelled")
	}

	transitioned, err = repo.ExpirePendingReservation(ctx, expiredOrder.ID, "reservation-expiry-worker", "system", "", nil)
	if err != nil {
		t.Fatalf("replayed ExpirePendingReservation returned error: %v", err)
	}
	if transitioned {
		t.Fatal("expected replayed expiry to be a no-op")
	}

	releaseIDs, err := repo.ListCancelledOrdersPendingStockRelease(ctx, 10)
	if err != nil {
		t.Fatalf("ListCancelledOrdersPendingStockRelease returned error: %v", err)
	}
	if len(releaseIDs) != 1 || releaseIDs[0] != expiredOrder.ID {
		t.Fatalf("expected cancelled order %s pending stock release, got %v", expiredOrder.ID, releaseIDs)
	}

	if err := repo.MarkOrderStockReleased(ctx, expiredOrder.ID); err != nil {
		t.Fatalf("MarkOrderStockReleased returned error: %v", err)
	}

	releaseIDs, err = repo.ListCancelledOrdersPendingStockRelease(ctx, 10)
	if err != nil {
		t.Fatalf("ListCancelledOrdersPendingStockRelease after mark returned error: %v", err)
	}
	if len(releaseIDs) != 0 {
		t.Fatalf("expected empty release scan after mark, got %v", releaseIDs)
	}

	var stockReleasedAt sql.NullTime
	if err := db.QueryRow(
		`SELECT stock_released_at FROM orders WHERE id = $1`, expiredOrder.ID,
	).Scan(&stockReleasedAt); err != nil {
		t.Fatalf("failed to read stock_released_at: %v", err)
	}
	if !stockReleasedAt.Valid {
		t.Fatal("expected stock_released_at to be set after mark")
	}

	if err := repo.MarkOrderStockReleased(ctx, expiredOrder.ID); err != nil {
		t.Fatalf("replayed MarkOrderStockReleased returned error: %v", err)
	}
}

func newIntegrationPendingOrder(reservationExpiresAt time.Time) *model.Order {
	now := time.Now().UTC()
	orderID := uuid.New().String()
	return &model.Order{
		ID:                   orderID,
		UserID:               uuid.New().String(),
		Status:               model.OrderStatusPending,
		SubtotalPrice:        80,
		ShippingMethod:       "pickup",
		ReservationExpiresAt: &reservationExpiresAt,
		TotalPrice:           80,
		Items: []model.OrderItem{
			{
				ID:        uuid.New().String(),
				OrderID:   orderID,
				ProductID: "product-1",
				Name:      "Archive Boot",
				Price:     80,
				Quantity:  1,
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func newOrderIntegrationDB(t *testing.T) *sql.DB {
	t.Helper()

	ctx := context.Background()
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "postgres:15-alpine",
			ExposedPorts: []string{"5432/tcp"},
			Env: map[string]string{
				"POSTGRES_DB":       "ecommerce_order",
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
		DBName:   "ecommerce_order",
		SSLMode:  "disable",
	})
	if err != nil {
		t.Fatalf("failed to connect postgres: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := database.RunPostgresMigrations(db, migrations.Files); err != nil {
		t.Fatalf("failed to run order service migrations: %v", err)
	}

	return db
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
