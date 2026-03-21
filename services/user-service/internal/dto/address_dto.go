package dto

// CreateAddressRequest is the request body for creating a shipping address.
type CreateAddressRequest struct {
	RecipientName string `json:"recipient_name" validate:"required,min=2,max=100"`
	Phone         string `json:"phone" validate:"required,min=10,max=20"`
	Street        string `json:"street" validate:"required,min=5,max=255"`
	Ward          string `json:"ward" validate:"omitempty,max=100"`
	District      string `json:"district" validate:"required,min=2,max=100"`
	City          string `json:"city" validate:"required,min=2,max=100"`
	IsDefault     bool   `json:"is_default"`
}

// UpdateAddressRequest is the request body for updating a shipping address.
type UpdateAddressRequest struct {
	RecipientName *string `json:"recipient_name" validate:"omitempty,min=2,max=100"`
	Phone         *string `json:"phone" validate:"omitempty,min=10,max=20"`
	Street        *string `json:"street" validate:"omitempty,min=5,max=255"`
	Ward          *string `json:"ward" validate:"omitempty,max=100"`
	District      *string `json:"district" validate:"omitempty,min=2,max=100"`
	City          *string `json:"city" validate:"omitempty,min=2,max=100"`
	IsDefault     *bool   `json:"is_default"`
}
