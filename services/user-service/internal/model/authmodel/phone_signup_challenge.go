package authmodel

import "time"

type PhoneSignupChallenge struct {
	ID                string     `json:"verification_id"`
	Phone             string     `json:"phone"`
	PasswordHash      string     `json:"-"`
	FirstName         string     `json:"first_name"`
	LastName          string     `json:"last_name"`
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
