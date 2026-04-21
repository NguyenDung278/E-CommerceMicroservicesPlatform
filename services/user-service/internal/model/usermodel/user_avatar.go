package usermodel

import "time"

type UserAvatar struct {
	UserID      string
	FileName    string
	ContentType string
	Data        []byte
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
