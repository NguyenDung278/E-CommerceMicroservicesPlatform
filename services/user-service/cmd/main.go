// User Service — Entry point
//
// STARTUP ORDER:
//  1. Load configuration → 2. Init logger → 3. Connect DB → 4. Migrate
//  5. Wire dependencies → 6. Register routes → 7. Start server (graceful shutdown)
package main

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/database"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/logger"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	grpc_handler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/grpc"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/handler"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
	"github.com/labstack/echo-contrib/echoprometheus"
	"google.golang.org/grpc"
)

func main() {
	// 1. Load configuration.
	cfg, err := config.Load("user-service")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 2. Initialize structured logger.
	log := logger.New("user-service")
	defer log.Sync()

	log.Info("starting user service",
		zap.String("port", cfg.Server.Port),
		zap.String("db_host", cfg.Database.Host),
	)

	// 3. Connect to PostgreSQL.
	db, err := database.NewPostgresDB(cfg.Database)
	if err != nil {
		log.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// 4. Run migrations.
	if err := runMigrations(db); err != nil {
		log.Fatal("failed to run migrations", zap.Error(err))
	}
	log.Info("database migrations completed")

	// 5. Dependency injection: repo → service → handler.
	userRepo := repository.NewUserRepository(db)
	userService := service.NewUserService(userRepo, cfg.JWT.Secret, cfg.JWT.Expiration)
	userHandler := handler.NewUserHandler(userService)

	// 6. Set up Echo and register routes.
	e := echo.New()
	e.HideBanner = true
	e.Use(echomw.Recover())
	e.Use(echomw.CORS())
	e.Use(echomw.Secure())
	e.Use(appmw.NewRateLimiter(40, 80, 2*time.Minute))
	e.Use(appmw.RequestLogger(log))
	e.Use(echoprometheus.NewMiddleware("user_service"))
	e.GET("/metrics", echoprometheus.NewHandler())

	// Health check — used by Docker/K8s probes.
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status":  "healthy",
			"service": "user-service",
		})
	})

	userHandler.RegisterRoutes(e, cfg.JWT.Secret)

	// 7. Set up gRPC server.
	grpcServer := grpc.NewServer()
	pb.RegisterUserServiceServer(grpcServer, grpc_handler.NewUserGRPCServer(userService))

	// 8. Start servers with graceful shutdown.
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

	// Wait for interrupt signal to gracefully shutdown
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

// runMigrations creates the users table if it doesn't exist.
// In production, use a proper migration tool like golang-migrate.
func runMigrations(db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS users (
			id         VARCHAR(36) PRIMARY KEY,
			email      VARCHAR(255) UNIQUE NOT NULL,
			password   VARCHAR(255) NOT NULL,
			first_name VARCHAR(100) NOT NULL,
			last_name  VARCHAR(100) NOT NULL,
			role       VARCHAR(20)  NOT NULL DEFAULT 'user',
			created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
	`
	_, err := db.Exec(query)
	return err
}
