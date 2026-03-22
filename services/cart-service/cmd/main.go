// Cart Service — Entry point
// Uses Redis for storage instead of PostgreSQL.
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
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/logger"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	appvalidator "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/grpc_client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/handler"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/repository"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/service"
)

func main() {
	cfg, err := config.Load("cart-service")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	log := logger.New("cart-service")
	defer log.Sync()

	tracingShutdown, err := appobs.SetupTracing(context.Background(), "cart-service", cfg.Tracing, log)
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

	// Connect to Redis.
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr(),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	// Verify Redis connection.
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatal("failed to connect to Redis", zap.Error(err))
	}
	defer rdb.Close()

	log.Info("connected to Redis", zap.String("addr", cfg.Redis.Addr()))

	productClient, err := grpc_client.NewProductClient(cfg.Services.ProductServiceGRPC)
	if err != nil {
		log.Fatal("failed to connect to product service gRPC", zap.Error(err))
	}
	defer productClient.Close()

	cartRepo := repository.NewCartRepository(rdb)
	cartService := service.NewCartService(cartRepo, productClient)
	cartHandler := handler.NewCartHandler(cartService)

	e := echo.New()
	e.HideBanner = true
	e.Validator = appvalidator.New()
	e.Use(echomw.Recover())
	e.Use(appmw.FrontendCORS())
	e.Use(echomw.Secure())
	e.Use(appobs.EchoMiddleware("cart-service"))
	e.Use(appmw.NewRedisBackedRateLimiter("cart-service", cfg.Redis, log, 60, 120, 2*time.Minute))
	e.Use(appmw.RequestLogger(log))
	e.Use(echoprometheus.NewMiddleware("cart_service"))
	e.GET("/metrics", echoprometheus.NewHandler())

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status":  "healthy",
			"service": "cart-service",
		})
	})

	cartHandler.RegisterRoutes(e, cfg.JWT.Secret)

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
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(shutdownCtx); err != nil {
		log.Fatal("server forced shutdown", zap.Error(err))
	}
}
