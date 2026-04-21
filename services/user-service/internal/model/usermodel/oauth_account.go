package usermodel

import "time"

type OAuthAccount struct {
	ID                   string     `json:"id"`
	UserID               string     `json:"user_id"`
	Provider             string     `json:"provider"`
	ProviderUserID       string     `json:"provider_user_id"`
	ProviderEmail        string     `json:"provider_email,omitempty"`
	AccessToken          string     `json:"-"`
	RefreshToken         string     `json:"-"`
	TokenType            string     `json:"token_type,omitempty"`
	Scope                string     `json:"scope,omitempty"`
	IDToken              string     `json:"-"`
	AccessTokenExpiresAt *time.Time `json:"access_token_expires_at,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}
