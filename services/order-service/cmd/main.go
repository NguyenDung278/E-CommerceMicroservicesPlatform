// Order Service — Entry point
package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/labstack/echo-contrib/echoprometheus"
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/database"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/logger"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/grpc_client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/handler"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/repository"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/service"
)

func main() {
	cfg, err := config.Load("order-service")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	log := logger.New("order-service")
	defer log.Sync()

	// Connect to PostgreSQL.
	db, err := database.NewPostgresDB(cfg.Database)
	if err != nil {
		log.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := runMigrations(db); err != nil {
		log.Fatal("failed to run migrations", zap.Error(err))
	}

	// Connect to RabbitMQ.
	var amqpCh *amqp.Channel
	conn, err := amqp.Dial(cfg.RabbitMQ.URL())
	if err != nil {
		log.Warn("RabbitMQ not available, events will be skipped", zap.Error(err))
	} else {
		defer conn.Close()
		amqpCh, err = conn.Channel()
		if err != nil {
			log.Warn("failed to open RabbitMQ channel", zap.Error(err))
		} else {
			defer amqpCh.Close()
			if err := service.SetupExchange(amqpCh); err != nil {
				log.Warn("failed to setup exchange", zap.Error(err))
			}
			log.Info("connected to RabbitMQ")
		}
	}

	// Setup gRPC client for Product Service
	productClient, err := grpc_client.NewProductClient(cfg.Services.ProductServiceGRPC)
	if err != nil {
		log.Fatal("failed to connect to product service via gRPC", zap.Error(err))
	}
	defer productClient.Close()

	orderRepo := repository.NewOrderRepository(db)
	orderService := service.NewOrderService(orderRepo, amqpCh, log, productClient)
	orderHandler := handler.NewOrderHandler(orderService)

	e := echo.New()
	e.HideBanner = true
	e.Use(echomw.Recover())
	e.Use(echomw.CORS())
	e.Use(echomw.Secure())
	e.Use(appmw.NewRateLimiter(40, 80, 2*time.Minute))
	e.Use(appmw.RequestLogger(log))
	e.Use(echoprometheus.NewMiddleware("order_service"))
	e.GET("/metrics", echoprometheus.NewHandler())

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status":  "healthy",
			"service": "order-service",
		})
	})

	orderHandler.RegisterRoutes(e, cfg.JWT.Secret)

	go func() {
		addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
		server := &http.Server{
			Addr:         addr,
			Handler:      e,
			ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
			WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
			IdleTimeout:  time.Duration(cfg.Server.ReadTimeout+cfg.Server.WriteTimeout) * time.Second,
		}
		if err := e.StartServer(server); err != nil && err != http.ErrServerClosed {
			log.Fatal("server error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit

	log.Info("shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		log.Fatal("server forced shutdown", zap.Error(err))
	}
}

func runMigrations(db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS orders (
			id          VARCHAR(36)    PRIMARY KEY,
			user_id     VARCHAR(36)    NOT NULL,
			status      VARCHAR(20)    NOT NULL DEFAULT 'pending',
			total_price DECIMAL(10,2)  NOT NULL,
			created_at  TIMESTAMP      NOT NULL DEFAULT NOW(),
			updated_at  TIMESTAMP      NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
		CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

		CREATE TABLE IF NOT EXISTS order_items (
			id         VARCHAR(36)    PRIMARY KEY,
			order_id   VARCHAR(36)    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
			product_id VARCHAR(36)    NOT NULL,
			name       VARCHAR(255)   NOT NULL,
			price      DECIMAL(10,2)  NOT NULL,
			quantity   INTEGER        NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
	`
	_, err := db.Exec(query)
	return err
}
