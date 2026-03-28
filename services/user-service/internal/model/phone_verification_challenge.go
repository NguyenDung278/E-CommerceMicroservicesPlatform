package model

import "time"

const (
	PhoneVerificationPurposeProfileUpdate = "profile_phone_update"

	PhoneVerificationStatusPending  = "pending"
	PhoneVerificationStatusVerified = "verified"
	PhoneVerificationStatusLocked   = "locked"
	PhoneVerificationStatusConsumed = "consumed"
	PhoneVerificationStatusExpired  = "expired"
)

type PhoneVerificationChallenge struct {
	ID                string     `json:"verification_id"`
	UserID            string     `json:"-"`
	Purpose           string     `json:"purpose"`
	PhoneCandidate    string     `json:"phone"`
	OTPHash           string     `json:"-"`
	ExpiresAt         time.Time  `json:"expires_at"`
	ResendAvailableAt time.Time  `json:"resend_available_at"`
	LastSentAt        time.Time  `json:"last_sent_at"`
	AttemptCount      int        `json:"attempt_count"`
	MaxAttempts       int        `json:"max_attempts"`
	Status            string     `json:"status"`
	TelegramChatID    string     `json:"-"`
	VerifiedAt        *time.Time `json:"verified_at,omitempty"`
	ConsumedAt        *time.Time `json:"consumed_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}
