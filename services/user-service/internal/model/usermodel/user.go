package usermodel

import "time"

type User struct {
	ID                         string     `json:"id"`
	Email                      string     `json:"email"`
	AvatarURL                  string     `json:"avatar_url,omitempty"`
	Phone                      string     `json:"phone,omitempty"`
	PhoneVerified              bool       `json:"phone_verified"`
	PhoneVerifiedAt            *time.Time `json:"phone_verified_at,omitempty"`
	PhoneLastChangedAt         *time.Time `json:"phone_last_changed_at,omitempty"`
	Password                   string     `json:"-"`
	FirstName                  string     `json:"first_name"`
	LastName                   string     `json:"last_name"`
	Role                       string     `json:"role"`
	EmailVerified              bool       `json:"email_verified"`
	EmailVerificationTokenHash string     `json:"-"`
	EmailVerificationExpiresAt *time.Time `json:"-"`
	PasswordResetTokenHash     string     `json:"-"`
	PasswordResetExpiresAt     *time.Time `json:"-"`
	CreatedAt                  time.Time  `json:"created_at"`
	UpdatedAt                  time.Time  `json:"updated_at"`
}
