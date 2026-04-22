// User Service — Entry point
//
// STARTUP ORDER:
//  1. Load configuration → 2. Init logger → 3. Connect DB → 4. Migrate
//  5. Bootstrap development accounts (optional) → 6. Wire dependencies
//  7. Register routes → 8. Start servers (graceful shutdown)
package main

import (
	"context"
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
	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	appvalidator "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	userclient "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/email"
	grpc_handler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/grpc"
	addresshandler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/handler/address"
	notificationpreferencehandler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/handler/notificationpreference"
	userhandler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/handler/user"
	wishlisthandler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/handler/wishlist"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/addressrepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/authrepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/notificationpreferencerepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/oauthrepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/profiletxrepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/userrepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/wishlistrepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service/account"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service/engagement"
	telegramsender "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/telegram"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/migrations"
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

	tracingShutdown, err := appobs.SetupTracing(context.Background(), "user-service", cfg.Tracing, log)
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

	log.Info("starting user service",
		zap.String("port", cfg.Server.Port),
		zap.String("db_host", cfg.Database.Host),
	)
	log.Info("telegram otp configuration",
		zap.Bool("enabled", cfg.Telegram.Enabled),
		zap.Bool("bot_token_configured", cfg.Telegram.BotToken != ""),
		zap.String("api_base_url", cfg.Telegram.APIBaseURL),
	)
	log.Info("email verification otp configuration",
		zap.Int("ttl_seconds", cfg.EmailVerification.OTPMessageTTLSeconds),
		zap.Int("resend_cooldown_seconds", cfg.EmailVerification.OTPResendCooldownSeconds),
		zap.Int("max_attempts", cfg.EmailVerification.OTPMaxAttempts),
	)

	// 3. Connect to PostgreSQL.
	db, err := database.NewPostgresDB(cfg.Database)
	if err != nil {
		log.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// 4. Run migrations.
	if err := database.RunPostgresMigrations(db, migrations.Files); err != nil {
		log.Fatal("failed to run migrations", zap.Error(err))
	}
	log.Info("database migrations completed")

	// 5. Bootstrap development-only test accounts if explicitly enabled.
	userRepo := userrepo.New(db)
	if cfg.Bootstrap.DevAccounts.Enabled {
		devAccountBootstrapper := account.NewDevAccountBootstrapper(
			userRepo,
			log,
			cfg.Bootstrap.DevAccounts.AdminPassword,
			cfg.Bootstrap.DevAccounts.StaffPassword,
		)
		bootstrapCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		if err := devAccountBootstrapper.Ensure(bootstrapCtx); err != nil {
			cancel()
			log.Fatal("failed to bootstrap development test accounts", zap.Error(err))
		}
		cancel()
	}

	// 6. Dependency injection: repo → service → handler.
	emailSender := email.NewSender(cfg.SMTP, log)
	telegramSender := telegramsender.NewSender(cfg.Telegram, log)
	oauthRepo := oauthrepo.New(db)
	phoneVerificationRepo := authrepo.NewPhoneVerification(db)
	phoneSignupRepo := authrepo.NewPhoneSignup(db)
	emailSignupRepo := authrepo.NewEmailSignup(db)
	emailVerificationRepo := authrepo.NewEmailVerification(db)
	avatarRepo := userrepo.NewAvatar(db)
	addressRepo := addressrepo.New(db)
	wishlistRepo := wishlistrepo.New(db)
	notificationPreferenceRepo := notificationpreferencerepo.New(db)
	profileTxManager := profiletxrepo.New(db)
	productClient := userclient.NewProductClient(cfg.Services.ProductService, log)
	addressService := account.NewAddressService(addressRepo)
	notificationPreferenceService := engagement.NewNotificationPreferenceService(notificationPreferenceRepo)
	wishlistService := engagement.NewWishlistService(
		wishlistRepo,
		engagement.WithWishlistProductCatalog(productClient),
		engagement.WithWishlistNotificationPreferences(notificationPreferenceService),
		engagement.WithWishlistUserReader(userRepo),
	)
	oauthClient := account.NewOAuthProviderClient(cfg.OAuth)
	userService := account.NewUserService(
		userRepo,
		cfg.JWT.Secret,
		cfg.JWT.Expiration,
		account.WithEmailSender(emailSender),
		account.WithOAuthAccountRepository(oauthRepo),
		account.WithPhoneVerificationRepository(phoneVerificationRepo),
		account.WithPhoneSignupRepository(phoneSignupRepo),
		account.WithEmailSignupRepository(emailSignupRepo),
		account.WithEmailVerificationRepository(emailVerificationRepo),
		account.WithUserAvatarRepository(avatarRepo),
		account.WithProfileTxManager(profileTxManager),
		account.WithAddressService(addressService),
		account.WithTelegramSender(telegramSender),
		account.WithTelegramConfig(cfg.Telegram),
		account.WithEmailVerificationConfig(cfg.EmailVerification),
		account.WithOAuthProviderClient(oauthClient),
		account.WithFrontendBaseURL(cfg.Frontend.BaseURL),
	)
	userHandler := userhandler.NewUserHandler(userService)
	addressHandler := addresshandler.NewAddressHandler(addressService)
	wishlistHandler := wishlisthandler.NewWishlistHandler(wishlistService)
	notificationPreferenceHandler := notificationpreferencehandler.NewNotificationPreferenceHandler(notificationPreferenceService)

	// 7. Set up Echo and register routes.
	e := echo.New()
	e.HideBanner = true
	e.Validator = appvalidator.New()
	e.Use(echomw.Recover())
	e.Use(appmw.FrontendCORS())
	e.Use(echomw.Secure())
	e.Use(appobs.RequestIDMiddleware())
	e.Use(appobs.EchoMiddleware("user-service"))
	e.Use(appmw.NewRedisBackedRateLimiter("user-service", cfg.Redis, log, 40, 80, 2*time.Minute))
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
	addressHandler.RegisterRoutes(e, cfg.JWT.Secret)
	wishlistHandler.RegisterRoutes(e, cfg.JWT.Secret)
	notificationPreferenceHandler.RegisterRoutes(e, cfg.JWT.Secret)

	// 8. Set up gRPC server.
	grpcServer := grpc.NewServer(grpc.UnaryInterceptor(appobs.GRPCUnaryServerInterceptor("user-service")))
	pb.RegisterUserServiceServer(grpcServer, grpc_handler.NewUserGRPCServer(userService))

	// 9. Start servers with graceful shutdown.
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
