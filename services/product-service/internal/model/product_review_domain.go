package model

import (
	"errors"
	"time"
)

var (
	ErrProductReviewNotFound      = errors.New("product review not found")
	ErrProductReviewAlreadyExists = errors.New("product review already exists")
)

type ProductRatingBreakdownDelta struct {
	One   int64
	Two   int64
	Three int64
	Four  int64
	Five  int64
}

type ProductReviewSummaryDelta struct {
	ReviewCountDelta int64
	RatingTotalDelta int64
	RatingBreakdown  ProductRatingBreakdownDelta
	UpdatedAt        time.Time
}

func NewProductReviewCreateDelta(rating int, updatedAt time.Time) ProductReviewSummaryDelta {
	breakdown := ProductRatingBreakdownDelta{}
	applyRatingDelta(&breakdown, rating, 1)

	return ProductReviewSummaryDelta{
		ReviewCountDelta: 1,
		RatingTotalDelta: int64(rating),
		RatingBreakdown:  breakdown,
		UpdatedAt:        updatedAt,
	}
}

func NewProductReviewUpdateDelta(oldRating int, newRating int, updatedAt time.Time) ProductReviewSummaryDelta {
	breakdown := ProductRatingBreakdownDelta{}
	applyRatingDelta(&breakdown, oldRating, -1)
	applyRatingDelta(&breakdown, newRating, 1)

	return ProductReviewSummaryDelta{
		RatingTotalDelta: int64(newRating - oldRating),
		RatingBreakdown:  breakdown,
		UpdatedAt:        updatedAt,
	}
}

func NewProductReviewDeleteDelta(rating int, updatedAt time.Time) ProductReviewSummaryDelta {
	breakdown := ProductRatingBreakdownDelta{}
	applyRatingDelta(&breakdown, rating, -1)

	return ProductReviewSummaryDelta{
		ReviewCountDelta: -1,
		RatingTotalDelta: int64(-rating),
		RatingBreakdown:  breakdown,
		UpdatedAt:        updatedAt,
	}
}

func applyRatingDelta(breakdown *ProductRatingBreakdownDelta, rating int, delta int64) {
	switch rating {
	case 1:
		breakdown.One += delta
	case 2:
		breakdown.Two += delta
	case 3:
		breakdown.Three += delta
	case 4:
		breakdown.Four += delta
	case 5:
		breakdown.Five += delta
	}
}
