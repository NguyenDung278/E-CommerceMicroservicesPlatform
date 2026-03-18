// API Gateway — Entry point
//
// STARTUP ORDER:
//  1. Load configuration → 2. Init logger → 3. Wire dependencies → 4. Register routes
//  5. Start server (graceful shutdown)
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/handler"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/logger"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo-contrib/echoprometheus"
)

func main() {
	// 1. Load configuration.
	cfg, err := config.Load("api-gateway")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 2. Initialize structured logger.
	log := logger.New("api-gateway")
	defer log.Sync()

	log.Info("starting API gateway",
		zap.String("port", cfg.Server.Port),
		zap.Strings("user_service", []string{cfg.Services.UserService}),
		zap.Strings("product_service", []string{cfg.Services.ProductService}),
		zap.Strings("cart_service", []string{cfg.Services.CartService}),
		zap.Strings("order_service", []string{cfg.Services.OrderService}),
		zap.Strings("payment_service", []string{cfg.Services.PaymentService}),
	)

	// 3. Create service proxies.
	userProxy := proxy.NewServiceProxy(cfg.Services.UserService, log)
	productProxy := proxy.NewServiceProxy(cfg.Services.ProductService, log)
	cartProxy := proxy.NewServiceProxy(cfg.Services.CartService, log)
	orderProxy := proxy.NewServiceProxy(cfg.Services.OrderService, log)
	paymentProxy := proxy.NewServiceProxy(cfg.Services.PaymentService, log)

	// 4. Create handlers.
	userHandler := handler.NewUserHandler(userProxy)
	productHandler := handler.NewProductHandler(productProxy)
	cartHandler := handler.NewCartHandler(cartProxy)
	orderHandler := handler.NewOrderHandler(orderProxy)
	paymentHandler := handler.NewPaymentHandler(paymentProxy)

	// 5. Set up Echo and register routes.
	e := echo.New()
	e.HideBanner = true
	e.Use(echomw.Recover())
	e.Use(echomw.CORS())
	e.Use(appmw.RequestLogger(log))
	e.Use(echoprometheus.NewMiddleware("api_gateway"))
	e.GET("/metrics", echoprometheus.NewHandler())

	// Health check — used by Docker/K8s probes.
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status":  "healthy",
			"service": "api-gateway",
		})
	})

	// Register service proxy routes.
	userHandler.RegisterRoutes(e.Group("/api/users"), cfg.JWT.Secret)
	productHandler.RegisterRoutes(e.Group("/api/products"), cfg.JWT.Secret)
	cartHandler.RegisterRoutes(e.Group("/api/cart"), cfg.JWT.Secret)
	orderHandler.RegisterRoutes(e.Group("/api/orders"), cfg.JWT.Secret)
	paymentHandler.RegisterRoutes(e.Group("/api/payments"), cfg.JWT.Secret)

	// 6. Start server with graceful shutdown.
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
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		log.Fatal("server forced shutdown", zap.Error(err))
	}
}
