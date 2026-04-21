package repository

import (
	"context"
	"os/exec"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/model"
)

func TestRedisCartRepositoryIntegration(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "redis:7-alpine",
			ExposedPorts: []string{"6379/tcp"},
			WaitingFor:   wait.ForLog("Ready to accept connections").WithStartupTimeout(30 * time.Second),
		},
		Started: true,
	})
	if err != nil {
		t.Fatalf("failed to start redis container: %v", err)
	}
	defer func() { _ = container.Terminate(ctx) }()

	host, err := container.Host(ctx)
	if err != nil {
		t.Fatalf("failed to get redis host: %v", err)
	}
	port, err := container.MappedPort(ctx, "6379/tcp")
	if err != nil {
		t.Fatalf("failed to get redis port: %v", err)
	}

	client := redis.NewClient(&redis.Options{
		Addr: host + ":" + port.Port(),
	})
	defer client.Close()

	repo := NewCartRepository(client)
	cart := &model.Cart{
		UserID: "user-1",
		Items: []model.CartItem{
			{ProductID: "p1", Name: "Laptop", Price: 10, Quantity: 2},
		},
		Total: 20,
	}

	if err := repo.Save(ctx, cart); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	got, err := repo.Get(ctx, cart.UserID)
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if got.Total != cart.Total || len(got.Items) != 1 {
		t.Fatalf("unexpected cart returned: %+v", got)
	}

	if err := repo.Delete(ctx, cart.UserID); err != nil {
		t.Fatalf("Delete returned error: %v", err)
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
