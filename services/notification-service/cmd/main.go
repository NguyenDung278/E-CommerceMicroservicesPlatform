// Notification Service — Entry point
//
// This service is PURELY EVENT-DRIVEN. It has no HTTP endpoints (except health).
// It consumes messages from RabbitMQ and processes notifications.
//
// ARCHITECTURE PATTERN: Consumer/Worker
// Unlike other services that are request-driven, this service runs a worker
// loop that waits for messages. It's the "subscribe" half of publish-subscribe.
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
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/logger"
	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/email"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/handler"
)

func main() {
	cfg, err := config.Load("notification-service")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	log := logger.New("notification-service")
	defer log.Sync()

	tracingShutdown, err := appobs.SetupTracing(context.Background(), "notification-service", cfg.Tracing, log)
	if err != nil {
		log.Warn("failed to initialize tracing", zap.Error(err))
	} else {
		defer func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := tracingShutdown(ctx); err != nil {
				log.Warn("failed to shutdown tracing", zap.Error(err))
			}
		}()
	}

	// Connect to RabbitMQ.
	conn, err := amqp.Dial(cfg.RabbitMQ.URL())
	if err != nil {
		log.Fatal("failed to connect to RabbitMQ", zap.Error(err))
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Fatal("failed to open channel", zap.Error(err))
	}
	defer ch.Close()

	// Declare the exchange (idempotent — safe to call even if it already exists).
	err = ch.ExchangeDeclare("events", "topic", true, false, false, false, nil)
	if err != nil {
		log.Fatal("failed to declare exchange", zap.Error(err))
	}

	// Declare a queue for notifications.
	// WHY A NAMED QUEUE: Named queues survive broker restarts (durable=true).
	// Anonymous queues would lose messages if the service restarts.
	q, err := ch.QueueDeclare(
		"notification-queue", // name
		true,                 // durable
		false,                // delete when unused
		false,                // exclusive
		false,                // no-wait
		nil,                  // arguments
	)
	if err != nil {
		log.Fatal("failed to declare queue", zap.Error(err))
	}

	// Bind the queue to multiple routing keys.
	// This service receives events for: order.created, order.cancelled,
	// payment.completed, payment.failed, payment.refunded.
	routingKeys := []string{"order.created", "order.cancelled", "payment.completed", "payment.failed", "payment.refunded"}
	for _, key := range routingKeys {
		err = ch.QueueBind(q.Name, key, "events", false, nil)
		if err != nil {
			log.Fatal("failed to bind queue", zap.String("routing_key", key), zap.Error(err))
		}
		log.Info("bound queue to routing key", zap.String("routing_key", key))
	}

	// Set QoS (Quality of Service).
	// prefetchCount=5 means the consumer will process 5 messages at a time.
	// This provides backpressure — if the consumer is slow, it won't get overwhelmed.
	err = ch.Qos(5, 0, false)
	if err != nil {
		log.Fatal("failed to set QoS", zap.Error(err))
	}

	// Start consuming messages.
	msgs, err := ch.Consume(
		q.Name,                  // queue
		"notification-consumer", // consumer tag
		false,                   // auto-ack (false = manual ack for reliability)
		false,                   // exclusive
		false,                   // no-local
		false,                   // no-wait
		nil,                     // args
	)
	if err != nil {
		log.Fatal("failed to start consuming", zap.Error(err))
	}

	sender := email.NewSender(cfg.SMTP, log)
	eventHandler := handler.NewEventHandler(log, sender)

	// Start the worker in a goroutine.
	go func() {
		log.Info("notification worker started, waiting for events...")
		for msg := range msgs {
			eventHandler.HandleMessage(msg)
		}
	}()

	// Start a minimal health check server.
	go func() {
		e := echo.New()
		e.HideBanner = true
		e.Use(echomw.Secure())
		e.Use(appobs.EchoMiddleware("notification-service"))
		e.Use(echoprometheus.NewMiddleware("notification_service"))
		e.GET("/metrics", echoprometheus.NewHandler())
		e.GET("/health", func(c echo.Context) error {
			return c.JSON(http.StatusOK, map[string]string{
				"status":  "healthy",
				"service": "notification-service",
			})
		})
		addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
		server := &http.Server{
			Addr:         addr,
			Handler:      e,
			ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
			WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
			IdleTimeout:  time.Duration(cfg.Server.ReadTimeout+cfg.Server.WriteTimeout) * time.Second,
		}
		if err := e.StartServer(server); err != nil && err != http.ErrServerClosed {
			log.Error("health check server error", zap.Error(err))
		}
	}()

	log.Info("notification service is running")

	// Wait for interrupt signal.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit

	log.Info("notification service shutting down...")
}
