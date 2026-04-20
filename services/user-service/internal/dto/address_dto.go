package dto

// CreateAddressRequest is the request body for creating a shipping address.
type CreateAddressRequest struct {
	RecipientName string `json:"recipient_name" validate:"required,min=2,max=100"`
	Phone         string `json:"phone" validate:"required,min=10,max=20"`
	Location      string `json:"location" validate:"required,min=5,max=255"`
	IsDefault     bool   `json:"is_default"`
}

// UpdateAddressRequest is the request body for updating a shipping address.
type UpdateAddressRequest struct {
	RecipientName *string `json:"recipient_name" validate:"omitempty,min=2,max=100"`
	Phone         *string `json:"phone" validate:"omitempty,min=10,max=20"`
	Location      *string `json:"location" validate:"omitempty,min=5,max=255"`
	IsDefault     *bool   `json:"is_default"`
}
