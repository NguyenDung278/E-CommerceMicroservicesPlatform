package model

import "time"

// UserAvatar stores the persisted avatar payload for one user.
type UserAvatar struct {
	UserID      string
	FileName    string
	ContentType string
	Data        []byte
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
