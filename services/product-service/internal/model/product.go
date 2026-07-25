package model

import (
	"time"

	productmodel "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model/product"
)

type ProductStatus = productmodel.ProductStatus

const (
	ProductStatusDraft    = productmodel.ProductStatusDraft
	ProductStatusActive   = productmodel.ProductStatusActive
	ProductStatusInactive = productmodel.ProductStatusInactive
)

type ProductVariant = productmodel.ProductVariant
type Product = productmodel.Product
type StockReservationItem = productmodel.StockReservationItem
type ProductReview = productmodel.ProductReview
type ProductRatingBreakdown = productmodel.ProductRatingBreakdown
type ProductReviewSummary = productmodel.ProductReviewSummary
type ProductReviewList = productmodel.ProductReviewList

var (
	ErrProductReviewNotFound      = productmodel.ErrProductReviewNotFound
	ErrProductReviewAlreadyExists = productmodel.ErrProductReviewAlreadyExists
)

type ProductRatingBreakdownDelta = productmodel.ProductRatingBreakdownDelta
type ProductReviewSummaryDelta = productmodel.ProductReviewSummaryDelta

func NewProductReviewCreateDelta(rating int, updatedAt time.Time) ProductReviewSummaryDelta {
	return productmodel.NewProductReviewCreateDelta(rating, updatedAt)
}

func NewProductReviewUpdateDelta(oldRating int, newRating int, updatedAt time.Time) ProductReviewSummaryDelta {
	return productmodel.NewProductReviewUpdateDelta(oldRating, newRating, updatedAt)
}

func NewProductReviewDeleteDelta(rating int, updatedAt time.Time) ProductReviewSummaryDelta {
	return productmodel.NewProductReviewDeleteDelta(rating, updatedAt)
}

type ProductSearchSuggestion = productmodel.ProductSearchSuggestion
type ProductSearchFacetValue = productmodel.ProductSearchFacetValue
type ProductSearchFacet = productmodel.ProductSearchFacet
type ProductSearchSortOption = productmodel.ProductSearchSortOption
type ProductSearchAssist = productmodel.ProductSearchAssist
type ProductSearchAnalyticsEntry = productmodel.ProductSearchAnalyticsEntry
type ProductSearchClickAnalyticsEntry = productmodel.ProductSearchClickAnalyticsEntry
type ProductSearchFilterAnalyticsEntry = productmodel.ProductSearchFilterAnalyticsEntry
type ProductSearchAnalyticsSummary = productmodel.ProductSearchAnalyticsSummary
type StorefrontCategory = productmodel.StorefrontCategory
type StorefrontEditorialSection = productmodel.StorefrontEditorialSection
type StorefrontProduct = productmodel.StorefrontProduct
type StorefrontFeaturedProduct = productmodel.StorefrontFeaturedProduct
type StorefrontCategoryPage = productmodel.StorefrontCategoryPage
type StorefrontHome = productmodel.StorefrontHome
