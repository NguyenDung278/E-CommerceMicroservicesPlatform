package repository

import (
	"database/sql"
	"time"

	"github.com/redis/go-redis/v9"

	productrepo "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository/product"
)

var (
	ErrInvalidCursor     = productrepo.ErrInvalidCursor
	ErrInsufficientStock = productrepo.ErrInsufficientStock
)

type ListProductsParams = productrepo.ListProductsParams
type SearchAssistParams = productrepo.SearchAssistParams
type ProductRepository = productrepo.ProductRepository
type ProductReviewRepository = productrepo.ProductReviewRepository
type RedisProductReviewCache = productrepo.RedisProductReviewCache
type ProductReviewTxRepositories = productrepo.ProductReviewTxRepositories
type ProductReviewTxManager = productrepo.ProductReviewTxManager
type SearchAnalyticsRecord = productrepo.SearchAnalyticsRecord
type SearchAnalyticsEventRecord = productrepo.SearchAnalyticsEventRecord
type SearchAnalyticsSummaryParams = productrepo.SearchAnalyticsSummaryParams
type SearchAnalyticsRepository = productrepo.SearchAnalyticsRepository
type StorefrontRepository = productrepo.StorefrontRepository

func NewProductRepository(db *sql.DB) ProductRepository {
	return productrepo.NewProductRepository(db)
}

func NewRedisProductReviewCache(client *redis.Client, ttl time.Duration) *RedisProductReviewCache {
	return productrepo.NewRedisProductReviewCache(client, ttl)
}

func NewProductReviewRepository(db *sql.DB) ProductReviewRepository {
	return productrepo.NewProductReviewRepository(db)
}

func NewProductReviewTxManager(db *sql.DB) ProductReviewTxManager {
	return productrepo.NewProductReviewTxManager(db)
}

func NewSearchAnalyticsRepository(db *sql.DB) SearchAnalyticsRepository {
	return productrepo.NewSearchAnalyticsRepository(db)
}

func NewStorefrontRepository(db *sql.DB) StorefrontRepository {
	return productrepo.NewStorefrontRepository(db)
}
