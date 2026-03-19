package dto

// RegisterRequest is the request body for user registration.
type RegisterRequest struct {
	Email     string `json:"email" validate:"required,email"`
	Phone     string `json:"phone" validate:"omitempty,min=10,max=15"`
	Password  string `json:"password" validate:"required,min=8"`
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
}

// LoginRequest is the request body for user login.
type LoginRequest struct {
	Identifier string `json:"identifier" validate:"omitempty,min=3"`
	Email      string `json:"email" validate:"omitempty,email"`
	Password   string `json:"password" validate:"required"`
}

// UpdateProfileRequest is the request body for updating user profile.
type UpdateProfileRequest struct {
	FirstName string `json:"first_name" validate:"omitempty,min=1"`
	LastName  string `json:"last_name" validate:"omitempty,min=1"`
}

// AuthResponse is the response body for successful authentication.
type AuthResponse struct {
	Token string      `json:"token"`
	User  interface{} `json:"user"`
}
