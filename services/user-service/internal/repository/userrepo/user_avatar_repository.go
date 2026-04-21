package userrepo

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/common"
)

type AvatarRepository struct {
	executor common.SQLExecutor
}

func NewAvatar(db *sql.DB) *AvatarRepository {
	return NewAvatarWithExecutor(db)
}

func NewAvatarWithExecutor(executor common.SQLExecutor) *AvatarRepository {
	return &AvatarRepository{executor: executor}
}

func (r *AvatarRepository) GetByUserID(ctx context.Context, userID string) (*model.UserAvatar, error) {
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

func (r *AvatarRepository) Upsert(ctx context.Context, avatar *model.UserAvatar) error {
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
