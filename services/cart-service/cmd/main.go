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

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo-contrib/echoprometheus"
	echomw "github.com/labstack/echo/v4/middleware"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/logger"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
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

	cartRepo := repository.NewCartRepository(rdb)
	cartService := service.NewCartService(cartRepo)
	cartHandler := handler.NewCartHandler(cartService)

	e := echo.New()
	e.HideBanner = true
	e.Use(echomw.Recover())
	e.Use(echomw.CORS())
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
		if err := e.Start(addr); err != nil && err != http.ErrServerClosed {
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
