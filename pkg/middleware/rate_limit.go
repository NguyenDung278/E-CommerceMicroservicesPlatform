package middleware

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"golang.org/x/time/rate"
)

// NewRateLimiter applies a simple in-memory rate limit per identifier.
// This is enough for local development and single-instance deployments.
func NewRateLimiter(requestsPerSecond int, burst int, expiresIn time.Duration) echo.MiddlewareFunc {
	requestsPerSecond = defaultRate(requestsPerSecond)
	burst = defaultBurst(requestsPerSecond, burst)
	if expiresIn <= 0 {
		expiresIn = 3 * time.Minute
	}

	store := echomw.NewRateLimiterMemoryStoreWithConfig(echomw.RateLimiterMemoryStoreConfig{
		Rate:      rate.Limit(requestsPerSecond),
		Burst:     burst,
		ExpiresIn: expiresIn,
	})

	return echomw.RateLimiterWithConfig(echomw.RateLimiterConfig{
		Store:               store,
		IdentifierExtractor: extractRateLimitIdentifier,
		ErrorHandler: func(c echo.Context, err error) error {
			return c.JSON(http.StatusForbidden, map[string]string{
				"error": "rate limiter failure",
			})
		},
		DenyHandler: func(c echo.Context, identifier string, err error) error {
			return c.JSON(http.StatusTooManyRequests, map[string]string{
				"error": "rate limit exceeded",
			})
		},
	})
}

// NewRedisBackedRateLimiter coordinates rate limits through Redis so multiple
// replicas can share the same limiter state. If Redis is unavailable during
// startup or for a particular request, the middleware degrades to the local
// in-memory limiter to preserve availability, at the cost of global consistency.
func NewRedisBackedRateLimiter(namespace string, redisCfg config.RedisConfig, log *zap.Logger, requestsPerSecond int, burst int, expiresIn time.Duration) echo.MiddlewareFunc {
	fallback := NewRateLimiter(requestsPerSecond, burst, expiresIn)
	if strings.TrimSpace(namespace) == "" {
		namespace = "service"
	}

	client := redis.NewClient(&redis.Options{
		Addr:     redisCfg.Addr(),
		Password: redisCfg.Password,
		DB:       redisCfg.DB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		if log != nil {
			log.Warn("Redis-backed rate limiter unavailable, falling back to in-memory limiter",
				zap.String("namespace", namespace),
				zap.String("redis_addr", redisCfg.Addr()),
				zap.Error(err),
			)
		}
		_ = client.Close()
		return fallback
	}

	limiter := &redisRateLimiter{
		namespace:      namespace,
		client:         client,
		requestsPerSec: float64(defaultRate(requestsPerSecond)),
		burst:          defaultBurst(requestsPerSecond, burst),
		ttl:            limiterTTL(requestsPerSecond, burst, expiresIn),
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		fallbackHandler := fallback(next)

		return func(c echo.Context) error {
			identifier, err := extractRateLimitIdentifier(c)
			if err != nil {
				return c.JSON(http.StatusForbidden, map[string]string{
					"error": "rate limiter failure",
				})
			}

			allowed, retryAfter, err := limiter.Allow(c.Request().Context(), identifier)
			if err != nil {
				if log != nil {
					log.Warn("Redis rate limiter request failed, falling back to in-memory limiter",
						zap.String("namespace", namespace),
						zap.String("identifier", identifier),
						zap.Error(err),
					)
				}
				return fallbackHandler(c)
			}

			if !allowed {
				if retryAfter > 0 {
					c.Response().Header().Set(echo.HeaderRetryAfter, strconv.Itoa(int(retryAfter.Seconds())+1))
				}
				return c.JSON(http.StatusTooManyRequests, map[string]string{
					"error": "rate limit exceeded",
				})
			}

			return next(c)
		}
	}
}

type redisRateLimiter struct {
	namespace      string
	client         *redis.Client
	requestsPerSec float64
	burst          int
	ttl            time.Duration
}

func (l *redisRateLimiter) Allow(ctx context.Context, identifier string) (bool, time.Duration, error) {
	result, err := redisTokenBucketScript.Run(ctx, l.client, []string{
		"rate_limit:" + l.namespace + ":" + identifier,
	}, time.Now().UnixMilli(), l.requestsPerSec, l.burst, l.ttl.Milliseconds(), 1).Result()
	if err != nil {
		return false, 0, err
	}

	values, ok := result.([]interface{})
	if !ok || len(values) < 3 {
		return false, 0, redis.Nil
	}

	allowed := toInt64(values[0]) == 1
	retryAfterMs := toInt64(values[2])
	return allowed, time.Duration(retryAfterMs) * time.Millisecond, nil
}

func extractRateLimitIdentifier(c echo.Context) (string, error) {
	if claims := GetUserClaims(c); claims != nil && claims.UserID != "" {
		return claims.UserID, nil
	}
	return c.RealIP(), nil
}

func defaultRate(requestsPerSecond int) int {
	if requestsPerSecond <= 0 {
		return 30
	}
	return requestsPerSecond
}

func defaultBurst(requestsPerSecond int, burst int) int {
	if burst <= 0 {
		return defaultRate(requestsPerSecond)
	}
	return burst
}

func limiterTTL(requestsPerSecond int, burst int, expiresIn time.Duration) time.Duration {
	if expiresIn <= 0 {
		expiresIn = 3 * time.Minute
	}

	ratePerSec := float64(defaultRate(requestsPerSecond))
	refillWindow := time.Duration(float64(defaultBurst(requestsPerSecond, burst))/ratePerSec*float64(time.Second)) + 5*time.Second
	if refillWindow > expiresIn {
		return refillWindow
	}
	return expiresIn
}

func toInt64(value interface{}) int64 {
	switch v := value.(type) {
	case int64:
		return v
	case int:
		return int64(v)
	case float64:
		return int64(v)
	case string:
		parsed, _ := strconv.ParseInt(v, 10, 64)
		return parsed
	default:
		return 0
	}
}

var redisTokenBucketScript = redis.NewScript(`
local key = KEYS[1]
local now = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local burst = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local requested = tonumber(ARGV[5])

local data = redis.call("HMGET", key, "tokens", "last_refill")
local tokens = tonumber(data[1])
local last_refill = tonumber(data[2])

if tokens == nil then
	tokens = burst
end
if last_refill == nil then
	last_refill = now
end

local elapsed = math.max(0, now - last_refill)
local refill = elapsed * rate / 1000
tokens = math.min(burst, tokens + refill)

local allowed = 0
local retry_after = 0
if tokens >= requested then
	tokens = tokens - requested
	allowed = 1
else
	retry_after = math.ceil((requested - tokens) / rate * 1000)
end

redis.call("HMSET", key, "tokens", tokens, "last_refill", now)
redis.call("PEXPIRE", key, ttl)

return {allowed, math.floor(tokens), retry_after}
`)
