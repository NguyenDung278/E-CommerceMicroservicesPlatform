// Package logger provides a structured logging wrapper around Uber's Zap logger.
//
// WHY ZAP: In microservices, logs are your primary debugging tool. Zap gives us:
//   - Zero-allocation in hot paths (important for high-throughput services)
//   - Structured fields (searchable in log aggregation tools like ELK/Loki)
//   - Level-based filtering (debug in dev, info/warn in production)
//
// USAGE:
//
//	log := logger.New("user-service")
//	log.Info("user registered", zap.String("user_id", id), zap.String("email", email))
package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// New creates a new structured logger for a given service.
// The service name is automatically attached to every log entry,
// making it easy to filter logs by service in a log aggregation system.
func New(serviceName string) *zap.Logger {
	// Choose log level based on environment.
	// PITFALL: Don't use Debug level in production — it generates enormous log volume.
	level := zapcore.InfoLevel
	if os.Getenv("LOG_LEVEL") == "debug" {
		level = zapcore.DebugLevel
	}

	// Configure the encoder — JSON in production, console in development.
	var encoderConfig zapcore.EncoderConfig
	var encoder zapcore.Encoder

	env := os.Getenv("APP_ENV")
	if env == "production" {
		encoderConfig = zap.NewProductionEncoderConfig()
		encoderConfig.TimeKey = "timestamp"
		encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
		encoder = zapcore.NewJSONEncoder(encoderConfig)
	} else {
		encoderConfig = zap.NewDevelopmentEncoderConfig()
		encoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
		encoder = zapcore.NewConsoleEncoder(encoderConfig)
	}

	core := zapcore.NewCore(
		encoder,
		zapcore.AddSync(os.Stdout),
		level,
	)

	return zap.New(core,
		zap.AddCaller(),                        // Adds file:line to every log entry
		zap.AddStacktrace(zapcore.ErrorLevel),   // Stack traces only for errors
		zap.Fields(zap.String("service", serviceName)),
	)
}
