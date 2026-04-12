package dto

type AddWishlistItemRequest struct {
	ProductID string `json:"product_id" validate:"required,min=1"`
}

type SyncWishlistRequest struct {
	ProductIDs []string `json:"product_ids" validate:"required,min=1,dive,required"`
}
