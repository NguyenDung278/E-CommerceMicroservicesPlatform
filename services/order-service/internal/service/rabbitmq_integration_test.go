package service

import (
	"context"
	"os/exec"
	"testing"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

func TestPublishOrderEventWithRabbitMQContainer(t *testing.T) {
	skipIfDockerUnavailable(t)

	ctx := context.Background()
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "rabbitmq:3.12-management-alpine",
			ExposedPorts: []string{"5672/tcp"},
			Env: map[string]string{
				"RABBITMQ_DEFAULT_USER": "admin",
				"RABBITMQ_DEFAULT_PASS": "password123",
			},
			WaitingFor: wait.ForLog("Server startup complete").WithStartupTimeout(90 * time.Second),
		},
		Started: true,
	})
	if err != nil {
		t.Fatalf("failed to start rabbitmq container: %v", err)
	}
	defer func() { _ = container.Terminate(ctx) }()

	host, err := container.Host(ctx)
	if err != nil {
		t.Fatalf("failed to get rabbitmq host: %v", err)
	}
	port, err := container.MappedPort(ctx, "5672/tcp")
	if err != nil {
		t.Fatalf("failed to get rabbitmq port: %v", err)
	}

	conn, err := amqp.Dial("amqp://admin:password123@" + host + ":" + port.Port() + "/")
	if err != nil {
		t.Fatalf("failed to connect rabbitmq: %v", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		t.Fatalf("failed to open channel: %v", err)
	}
	defer ch.Close()

	if err := SetupExchange(ch); err != nil {
		t.Fatalf("SetupExchange returned error: %v", err)
	}

	queue, err := ch.QueueDeclare("", false, true, true, false, nil)
	if err != nil {
		t.Fatalf("failed to declare queue: %v", err)
	}

	if err := ch.QueueBind(queue.Name, "order.created", "events", false, nil); err != nil {
		t.Fatalf("failed to bind queue: %v", err)
	}

	msgs, err := ch.Consume(queue.Name, "", true, true, false, false, nil)
	if err != nil {
		t.Fatalf("failed to consume queue: %v", err)
	}

	svc := &OrderService{
		amqpCh: ch,
		log:    zap.NewNop(),
	}

	svc.publishOrderEvent(&model.Order{
		ID:         "order-1",
		UserID:     "user-1",
		Status:     model.OrderStatusPending,
		TotalPrice: 99.99,
	})

	select {
	case msg := <-msgs:
		if msg.RoutingKey != "order.created" {
			t.Fatalf("expected routing key order.created, got %q", msg.RoutingKey)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for RabbitMQ message")
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
