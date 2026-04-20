package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type NotificationPreferenceRepository interface {
	ListByUserID(ctx context.Context, userID string) ([]*model.NotificationPreference, error)
	UpsertMany(ctx context.Context, userID string, preferences []*model.NotificationPreference) error
}

type postgresNotificationPreferenceRepository struct {
	executor sqlExecutor
}

func NewNotificationPreferenceRepository(db *sql.DB) NotificationPreferenceRepository {
	return &postgresNotificationPreferenceRepository{executor: db}
}

func (r *postgresNotificationPreferenceRepository) ListByUserID(
	ctx context.Context,
	userID string,
) ([]*model.NotificationPreference, error) {
	rows, err := r.executor.QueryContext(ctx, `
		SELECT user_id, topic, enabled, updated_at
		FROM notification_preferences
		WHERE user_id = $1
		ORDER BY topic ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list notification preferences: %w", err)
	}
	defer rows.Close()

	preferences := make([]*model.NotificationPreference, 0)
	for rows.Next() {
		preference := &model.NotificationPreference{}
		if err := rows.Scan(
			&preference.UserID,
			&preference.Topic,
			&preference.Enabled,
			&preference.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan notification preference: %w", err)
		}
		preferences = append(preferences, preference)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate notification preferences: %w", err)
	}

	return preferences, nil
}

func (r *postgresNotificationPreferenceRepository) UpsertMany(
	ctx context.Context,
	userID string,
	preferences []*model.NotificationPreference,
) error {
	if len(preferences) == 0 {
		return nil
	}

	topics := make([]string, 0, len(preferences))
	enabledFlags := make([]bool, 0, len(preferences))
	for _, preference := range preferences {
		if preference == nil {
			continue
		}
		topics = append(topics, preference.Topic)
		enabledFlags = append(enabledFlags, preference.Enabled)
	}
	if len(topics) == 0 {
		return nil
	}

	_, err := r.executor.ExecContext(ctx, `
		INSERT INTO notification_preferences (user_id, topic, enabled, updated_at)
		SELECT $1, topic, enabled, NOW()
		FROM unnest($2::text[], $3::boolean[]) AS payload(topic, enabled)
		ON CONFLICT (user_id, topic)
		DO UPDATE SET
			enabled = EXCLUDED.enabled,
			updated_at = EXCLUDED.updated_at
	`, userID, pq.Array(topics), pq.Array(enabledFlags))
	if err != nil {
		return fmt.Errorf("failed to upsert notification preferences: %w", err)
	}

	return nil
}
