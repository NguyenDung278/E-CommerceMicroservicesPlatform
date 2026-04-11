package model

import "time"

const (
	EmailVerificationPurposeSignUp = "signup_email_verify"

	EmailVerificationStatusPending  = "pending"
	EmailVerificationStatusVerified = "verified"
	EmailVerificationStatusLocked   = "locked"
	EmailVerificationStatusConsumed = "consumed"
	EmailVerificationStatusExpired  = "expired"
)

type EmailVerificationChallenge struct {
	ID                string     `json:"verification_id"`
	UserID            string     `json:"-"`
	Purpose           string     `json:"purpose"`
	Email             string     `json:"email"`
	OTPHash           string     `json:"-"`
	ExpiresAt         time.Time  `json:"expires_at"`
	ResendAvailableAt time.Time  `json:"resend_available_at"`
	LastSentAt        time.Time  `json:"last_sent_at"`
	AttemptCount      int        `json:"attempt_count"`
	MaxAttempts       int        `json:"max_attempts"`
	Status            string     `json:"status"`
	VerifiedAt        *time.Time `json:"verified_at,omitempty"`
	ConsumedAt        *time.Time `json:"consumed_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}
