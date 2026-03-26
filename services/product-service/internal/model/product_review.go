package model

import "time"

type ProductReview struct {
	ID          string    `json:"id"`
	ProductID   string    `json:"product_id"`
	UserID      string    `json:"user_id"`
	AuthorLabel string    `json:"author_label"`
	Rating      int       `json:"rating"`
	Comment     string    `json:"comment"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ProductRatingBreakdown struct {
	One   int64 `json:"one"`
	Two   int64 `json:"two"`
	Three int64 `json:"three"`
	Four  int64 `json:"four"`
	Five  int64 `json:"five"`
}

type ProductReviewSummary struct {
	AverageRating   float64                `json:"average_rating"`
	ReviewCount     int64                  `json:"review_count"`
	RatingBreakdown ProductRatingBreakdown `json:"rating_breakdown"`
}

type ProductReviewList struct {
	Summary ProductReviewSummary `json:"summary"`
	Items   []*ProductReview     `json:"items"`
}
