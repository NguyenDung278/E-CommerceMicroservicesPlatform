// Product Service — Entry point
package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"time"

	echoprometheus "github.com/labstack/echo-contrib/echoprometheus"
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/database"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/logger"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	grpc_handler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/grpc"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/handler"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/migrations"
	"google.golang.org/grpc"
)

func main() {
	cfg, err := config.Load("product-service")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	log := logger.New("product-service")
	defer log.Sync()

	db, err := database.NewPostgresDB(cfg.Database)
	if err != nil {
		log.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := database.RunPostgresMigrations(db, migrations.Files); err != nil {
		log.Fatal("failed to run migrations", zap.Error(err))
	}

	productRepo := repository.NewProductRepository(db)
	productService := service.NewProductService(productRepo)
	productHandler := handler.NewProductHandler(productService)

	e := echo.New()
	e.HideBanner = true
	e.Use(echomw.Recover())
	e.Use(echomw.CORS())
	e.Use(echomw.Secure())
	e.Use(appmw.NewRateLimiter(80, 160, 2*time.Minute))
	e.Use(appmw.RequestLogger(log))
	e.Use(echoprometheus.NewMiddleware("product_service"))
	e.GET("/metrics", echoprometheus.NewHandler())

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status":  "healthy",
			"service": "product-service",
		})
	})

	productHandler.RegisterRoutes(e, cfg.JWT.Secret)

	// Set up gRPC server.
	grpcServer := grpc.NewServer()
	pb.RegisterProductServiceServer(grpcServer, grpc_handler.NewProductGRPCServer(productService))

	go func() {
		// Start HTTP server
		addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
		server := &http.Server{
			Addr:         addr,
			Handler:      e,
			ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
			WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
			IdleTimeout:  time.Duration(cfg.Server.ReadTimeout+cfg.Server.WriteTimeout) * time.Second,
		}
		if err := e.StartServer(server); err != nil && err != http.ErrServerClosed {
			log.Fatal("HTTP server error", zap.Error(err))
		}
	}()

	go func() {
		// Start gRPC server
		lis, err := net.Listen("tcp", fmt.Sprintf(":%s", cfg.GRPC.Port))
		if err != nil {
			log.Fatal("failed to listen for gRPC", zap.Error(err))
		}
		log.Info("starting gRPC server", zap.String("port", cfg.GRPC.Port))
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatal("gRPC server error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit

	log.Info("shutting down servers...")

	// Stop gRPC server first
	grpcServer.GracefulStop()

	// Then stop HTTP server
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		log.Fatal("server forced shutdown", zap.Error(err))
	}
	log.Info("server shutdown complete")
}
