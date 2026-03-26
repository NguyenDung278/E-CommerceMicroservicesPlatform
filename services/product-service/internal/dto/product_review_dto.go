package dto

type CreateProductReviewRequest struct {
	Rating  int    `json:"rating" validate:"required,min=1,max=5"`
	Comment string `json:"comment" validate:"max=2000"`
}

type UpdateProductReviewRequest struct {
	Rating  int    `json:"rating" validate:"required,min=1,max=5"`
	Comment string `json:"comment" validate:"max=2000"`
}

type ListProductReviewsQuery struct {
	Page  int `query:"page"`
	Limit int `query:"limit"`
}
