// Payment Service — Entry point
package main

import (
	"context"
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
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/handler"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/repository"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/service"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/migrations"
)

func main() {
	cfg, err := config.Load("payment-service")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	log := logger.New("payment-service")
	defer log.Sync()

	db, err := database.NewPostgresDB(cfg.Database)
	if err != nil {
		log.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := database.RunPostgresMigrations(db, migrations.Files); err != nil {
		log.Fatal("failed to run migrations", zap.Error(err))
	}

	// Connect to RabbitMQ.
	var amqpCh *amqp.Channel
	conn, err := amqp.Dial(cfg.RabbitMQ.URL())
	if err != nil {
		log.Warn("RabbitMQ not available", zap.Error(err))
	} else {
		defer conn.Close()
		amqpCh, err = conn.Channel()
		if err != nil {
			log.Warn("failed to open RabbitMQ channel", zap.Error(err))
		} else {
			defer amqpCh.Close()
			log.Info("connected to RabbitMQ")
		}
	}

	paymentRepo := repository.NewPaymentRepository(db)
	paymentService := service.NewPaymentService(paymentRepo, amqpCh, log)
	paymentHandler := handler.NewPaymentHandler(paymentService)

	e := echo.New()
	e.HideBanner = true
	e.Use(echomw.Recover())
	e.Use(echomw.CORS())
	e.Use(echomw.Secure())
	e.Use(appmw.NewRateLimiter(40, 80, 2*time.Minute))
	e.Use(appmw.RequestLogger(log))
	e.Use(echoprometheus.NewMiddleware("payment_service"))
	e.GET("/metrics", echoprometheus.NewHandler())

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status":  "healthy",
			"service": "payment-service",
		})
	})

	paymentHandler.RegisterRoutes(e, cfg.JWT.Secret)

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
