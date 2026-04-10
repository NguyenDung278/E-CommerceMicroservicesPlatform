package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

// UserAvatarRepository persists avatar payloads separately from the core user row
// so large image blobs do not bloat common authentication queries.
type UserAvatarRepository interface {
	GetByUserID(ctx context.Context, userID string) (*model.UserAvatar, error)
	Upsert(ctx context.Context, avatar *model.UserAvatar) error
}

type postgresUserAvatarRepository struct {
	executor sqlExecutor
}

func NewUserAvatarRepository(db *sql.DB) UserAvatarRepository {
	return &postgresUserAvatarRepository{executor: db}
}

func newUserAvatarRepositoryWithExecutor(executor sqlExecutor) UserAvatarRepository {
	return &postgresUserAvatarRepository{executor: executor}
}

func (r *postgresUserAvatarRepository) GetByUserID(
	ctx context.Context,
	userID string,
) (*model.UserAvatar, error) {
	query := `
		SELECT user_id, file_name, content_type, data, created_at, updated_at
		FROM user_avatars
		WHERE user_id = $1
	`

	avatar := &model.UserAvatar{}
	err := r.executor.QueryRowContext(ctx, query, userID).Scan(
		&avatar.UserID,
		&avatar.FileName,
		&avatar.ContentType,
		&avatar.Data,
		&avatar.CreatedAt,
		&avatar.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user avatar: %w", err)
	}

	return avatar, nil
}

func (r *postgresUserAvatarRepository) Upsert(ctx context.Context, avatar *model.UserAvatar) error {
	query := `
		INSERT INTO user_avatars (
			user_id, file_name, content_type, data, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id) DO UPDATE
		SET file_name = EXCLUDED.file_name,
		    content_type = EXCLUDED.content_type,
		    data = EXCLUDED.data,
		    updated_at = EXCLUDED.updated_at
	`

	_, err := r.executor.ExecContext(
		ctx,
		query,
		avatar.UserID,
		avatar.FileName,
		avatar.ContentType,
		avatar.Data,
		avatar.CreatedAt,
		avatar.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to upsert user avatar: %w", err)
	}

	return nil
}
