package model

import "time"

// User represents a user in the system.
// Using UUID as the primary key for:
//   - Global uniqueness across microservices (no collisions)
//   - Better distribution in distributed databases
//   - Not exposing sequential IDs (security best practice)
type User struct {
	ID                         string     `json:"id"`
	Email                      string     `json:"email"`
	Phone                      string     `json:"phone,omitempty"`
	PhoneVerified              bool       `json:"phone_verified"`
	PhoneVerifiedAt            *time.Time `json:"phone_verified_at,omitempty"`
	PhoneLastChangedAt         *time.Time `json:"phone_last_changed_at,omitempty"`
	Password                   string     `json:"-"` // Never serialize the password hash
	FirstName                  string     `json:"first_name"`
	LastName                   string     `json:"last_name"`
	Role                       string     `json:"role"` // "user", "staff" or "admin"
	EmailVerified              bool       `json:"email_verified"`
	EmailVerificationTokenHash string     `json:"-"`
	EmailVerificationExpiresAt *time.Time `json:"-"`
	PasswordResetTokenHash     string     `json:"-"`
	PasswordResetExpiresAt     *time.Time `json:"-"`
	CreatedAt                  time.Time  `json:"created_at"`
	UpdatedAt                  time.Time  `json:"updated_at"`
}
