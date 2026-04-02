// Notification Service — Entry point
//
// This service is event-driven. It consumes RabbitMQ messages, applies bounded
// retry/DLQ policy, and exposes health plus Prometheus metrics.
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
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/logger"
	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/email"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/handler"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/inbox"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/messaging"
)

func main() {
	cfg, err := config.Load("notification-service")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	log := logger.New("notification-service")
	defer log.Sync()

	rootCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	tracingShutdown, err := appobs.SetupTracing(rootCtx, "notification-service", cfg.Tracing, log)
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

	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr(),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})
	defer redisClient.Close()

	var inboxStore inbox.Store
	if err := redisClient.Ping(rootCtx).Err(); err != nil {
		log.Warn("redis not available, duplicate inbox protection is disabled", zap.Error(err))
	} else {
		inboxStore = inbox.NewRedisStore(redisClient, "notification-service:inbox")
	}

	conn, err := amqp.Dial(cfg.RabbitMQ.URL())
	if err != nil {
		log.Fatal("failed to connect to RabbitMQ", zap.Error(err))
	}
	defer conn.Close()

	adminCh, err := conn.Channel()
	if err != nil {
		log.Fatal("failed to open RabbitMQ admin channel", zap.Error(err))
	}
	defer adminCh.Close()

	retryDelay := time.Duration(cfg.Notification.RetryDelaySeconds) * time.Second
	if err := messaging.DeclareQueues(adminCh, retryDelay); err != nil {
		log.Fatal("failed to declare notification queues", zap.Error(err))
	}

	consumerCh, err := conn.Channel()
	if err != nil {
		log.Fatal("failed to open RabbitMQ consumer channel", zap.Error(err))
	}
	defer consumerCh.Close()

	if err := consumerCh.Qos(cfg.Notification.PrefetchCount, 0, false); err != nil {
		log.Fatal("failed to set RabbitMQ QoS", zap.Error(err))
	}

	msgs, err := consumerCh.Consume(
		messaging.MainQueue,
		messaging.ConsumerTag,
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Fatal("failed to start consuming notification events", zap.Error(err))
	}

	retryCh, err := conn.Channel()
	if err != nil {
		log.Fatal("failed to open RabbitMQ retry publisher channel", zap.Error(err))
	}
	defer retryCh.Close()

	monitorCh, err := conn.Channel()
	if err != nil {
		log.Fatal("failed to open RabbitMQ monitor channel", zap.Error(err))
	}
	defer monitorCh.Close()

	sender := email.NewSender(cfg.SMTP, log)
	retryPublisher := messaging.NewRetryPublisher(retryCh, messaging.RetryQueue)
	eventHandler := handler.NewEventHandler(
		log,
		sender,
		inboxStore,
		retryPublisher,
		cfg.Notification.MaxRetries,
		time.Duration(cfg.Notification.InboxTTLHours)*time.Hour,
		time.Duration(cfg.Notification.ProcessingTTLSeconds)*time.Second,
	)

	queueMonitor := messaging.NewQueueMonitor(monitorCh, log, messaging.MainQueue, messaging.RetryQueue, messaging.DLQQueue)
	go queueMonitor.Start(rootCtx, time.Duration(cfg.Notification.QueueMetricsIntervalSeconds)*time.Second)

	workerCount := cfg.Notification.WorkerCount
	if workerCount <= 0 {
		workerCount = 1
	}
	for workerID := 1; workerID <= workerCount; workerID++ {
		go startWorker(rootCtx, workerID, log, eventHandler, msgs)
	}

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

	go func() {
		if err := e.StartServer(server); err != nil && err != http.ErrServerClosed {
			log.Error("notification health server error", zap.Error(err))
		}
	}()

	log.Info("notification service is running",
		zap.Int("worker_count", workerCount),
		zap.Int("prefetch_count", cfg.Notification.PrefetchCount),
		zap.Int("max_retries", cfg.Notification.MaxRetries),
	)

	<-rootCtx.Done()
	log.Info("notification service shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(shutdownCtx); err != nil {
		log.Warn("failed to shutdown notification health server gracefully", zap.Error(err))
	}
}

func startWorker(ctx context.Context, workerID int, log *zap.Logger, eventHandler *handler.EventHandler, msgs <-chan amqp.Delivery) {
	workerLog := log.With(zap.Int("worker_id", workerID))
	workerLog.Info("notification worker started")

	for {
		select {
		case <-ctx.Done():
			workerLog.Info("notification worker stopping")
			return
		case msg, ok := <-msgs:
			if !ok {
				workerLog.Info("notification worker stopping because consumer channel closed")
				return
			}

			messageCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			eventHandler.HandleMessage(messageCtx, msg)
			cancel()
		}
	}
}
