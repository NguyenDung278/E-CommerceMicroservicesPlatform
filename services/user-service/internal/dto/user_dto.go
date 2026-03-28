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
	FirstName           *string                    `json:"first_name" validate:"omitempty,min=1,max=100"`
	LastName            *string                    `json:"last_name" validate:"omitempty,min=1,max=100"`
	Phone               *string                    `json:"phone" validate:"omitempty,min=10,max=20"`
	PhoneVerificationID string                     `json:"phone_verification_id" validate:"omitempty,uuid4"`
	DefaultAddress      *UpdateProfileAddressInput `json:"default_address" validate:"omitempty"`
}

type UpdateProfileAddressInput struct {
	RecipientName *string `json:"recipient_name" validate:"omitempty,min=2,max=100"`
	Phone         *string `json:"phone" validate:"omitempty,min=10,max=20"`
	Street        *string `json:"street" validate:"omitempty,min=5,max=255"`
	Ward          *string `json:"ward" validate:"omitempty,max=100"`
	District      *string `json:"district" validate:"omitempty,min=2,max=100"`
	City          *string `json:"city" validate:"omitempty,min=2,max=100"`
}

type ProfileAddressInput struct {
	RecipientName string `json:"recipient_name" validate:"required,min=2,max=100"`
	Phone         string `json:"phone" validate:"required,min=10,max=20"`
	Street        string `json:"street" validate:"required,min=5,max=255"`
	Ward          string `json:"ward" validate:"omitempty,max=100"`
	District      string `json:"district" validate:"required,min=2,max=100"`
	City          string `json:"city" validate:"required,min=2,max=100"`
}

type SendPhoneOTPRequest struct {
	Phone string `json:"phone" validate:"required,min=10,max=20"`
}

type VerifyPhoneOTPRequest struct {
	VerificationID string `json:"verification_id" validate:"required,uuid4"`
	OTPCode        string `json:"otp_code" validate:"required,len=6,numeric"`
}

type ResendPhoneOTPRequest struct {
	VerificationID string `json:"verification_id" validate:"required,uuid4"`
}

type PhoneVerificationStatusResponse struct {
	VerificationID    string  `json:"verification_id"`
	Phone             string  `json:"phone"`
	PhoneMasked       string  `json:"phone_masked"`
	Status            string  `json:"status"`
	ExpiresAt         string  `json:"expires_at,omitempty"`
	ResendAvailableAt string  `json:"resend_available_at,omitempty"`
	ExpiresInSeconds  int64   `json:"expires_in_seconds"`
	ResendInSeconds   int64   `json:"resend_in_seconds"`
	MaxAttempts       int     `json:"max_attempts"`
	RemainingAttempts int     `json:"remaining_attempts"`
	VerifiedAt        *string `json:"verified_at,omitempty"`
}

// ChangePasswordRequest is the request body for changing password.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8"`
}

// RefreshTokenRequest is the request body for refreshing JWT tokens.
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type OAuthExchangeRequest struct {
	Ticket string `json:"ticket" validate:"required"`
}

type VerifyEmailRequest struct {
	Token string `json:"token" validate:"required"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}

type UpdateUserRoleRequest struct {
	Role string `json:"role" validate:"required,oneof=user staff admin"`
}

// AuthResponse is the response body for successful authentication.
type AuthResponse struct {
	Token        string      `json:"token"`
	RefreshToken string      `json:"refresh_token"`
	User         interface{} `json:"user"`
}
