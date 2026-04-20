package dto

type UpdateNotificationPreference struct {
	Topic   string `json:"topic" validate:"required,min=1"`
	Enabled bool   `json:"enabled"`
}

type UpdateNotificationPreferencesRequest struct {
	Preferences []UpdateNotificationPreference `json:"preferences" validate:"required,min=1,dive"`
}
