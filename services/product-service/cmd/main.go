// Product Service — Entry point
package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"time"

	echoprometheus "github.com/labstack/echo-contrib/echoprometheus"
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/database"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/logger"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	appvalidator "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	grpc_handler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/grpc"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/handler"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/jobs"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/search"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/storage"
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

	tracingShutdown, err := appobs.SetupTracing(context.Background(), "product-service", cfg.Tracing, log)
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

	db, err := database.NewPostgresDB(cfg.Database)
	if err != nil {
		log.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := database.RunPostgresMigrations(db, migrations.Files); err != nil {
		log.Fatal("failed to run migrations", zap.Error(err))
	}

	productRepo := repository.NewProductRepository(db)
	productOptions := []service.ProductServiceOption{service.WithLogger(log)}
	if mediaStore, err := storage.NewObjectStorage(cfg.ObjectStorage); err != nil {
		log.Warn("object storage disabled", zap.Error(err))
	} else {
		ensureCtx, cancelEnsure := context.WithTimeout(context.Background(), 5*time.Second)
		if err := mediaStore.EnsureBucket(ensureCtx); err != nil {
			log.Warn("failed to prepare object storage bucket", zap.Error(err))
		}
		cancelEnsure()
		productOptions = append(productOptions, service.WithMediaStore(mediaStore))
	}

	var searchIndex *search.ElasticsearchIndex
	if cfg.Search.Enabled && strings.EqualFold(cfg.Search.Provider, "elasticsearch") {
		searchIndex, err = search.NewElasticsearchIndex(cfg.Search)
		if err != nil {
			log.Warn("Elasticsearch search disabled", zap.Error(err))
		} else {
			productOptions = append(productOptions, service.WithSearchIndex(searchIndex))
		}
	}

	productService := service.NewProductService(productRepo, productOptions...)
	if searchIndex != nil {
		searchCtx, cancelSearch := context.WithTimeout(context.Background(), 30*time.Second)
		if err := ensureSearchReady(searchCtx, searchIndex, productService, cfg.Search.SyncOnStartup, log); err != nil {
			log.Warn("failed to ensure Elasticsearch index", zap.Error(err))
		}
		cancelSearch()
	}
	productHandler := handler.NewProductHandler(productService)
	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()

	lowStockMonitor := jobs.NewLowStockMonitor(productService, log, 2*time.Minute, 5)
	go lowStockMonitor.Start(workerCtx)

	e := echo.New()
	e.HideBanner = true
	e.Validator = appvalidator.New()
	e.Use(echomw.Recover())
	e.Use(appmw.FrontendCORS())
	e.Use(echomw.Secure())
	e.Use(appobs.EchoMiddleware("product-service"))
	e.Use(appmw.NewRedisBackedRateLimiter("product-service", cfg.Redis, log, 80, 160, 2*time.Minute))
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
	grpcServer := grpc.NewServer(grpc.UnaryInterceptor(appobs.GRPCUnaryServerInterceptor("product-service")))
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
	workerCancel()

	// Then stop HTTP server
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		log.Fatal("server forced shutdown", zap.Error(err))
	}
	log.Info("server shutdown complete")
}

func ensureSearchReady(
	ctx context.Context,
	searchIndex *search.ElasticsearchIndex,
	productService *service.ProductService,
	syncOnStartup bool,
	log *zap.Logger,
) error {
	const retryDelay = 2 * time.Second

	attempt := 1
	for {
		err := searchIndex.EnsureIndex(ctx)
		if err == nil {
			if !syncOnStartup {
				return nil
			}
			if err := productService.SyncSearchIndex(ctx); err != nil {
				return fmt.Errorf("failed to sync Elasticsearch index from PostgreSQL: %w", err)
			}
			return nil
		}

		if ctx.Err() != nil {
			return err
		}

		log.Info(
			"Elasticsearch not ready yet, retrying startup sync",
			zap.Int("attempt", attempt),
			zap.Duration("retry_in", retryDelay),
			zap.Error(err),
		)
		attempt++

		select {
		case <-ctx.Done():
			return err
		case <-time.After(retryDelay):
		}
	}
}
