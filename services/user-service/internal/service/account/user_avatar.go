package accountservice

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
)

const maxAvatarUploadSize = 5 << 20

// UploadAvatar validates and stores the current user's avatar image.
func (s *UserService) UploadAvatar(
	ctx context.Context,
	userID string,
	input dto.UploadAvatarInput,
) (*dto.UploadAvatarResponse, error) {
	if s.avatarRepo == nil {
		return nil, ErrAvatarRepositoryUnavailable
	}

	fileName := strings.TrimSpace(input.FileName)
	contentType := strings.TrimSpace(input.ContentType)
	if fileName == "" || contentType == "" || len(input.Data) == 0 {
		return nil, ErrInvalidAvatarFile
	}
	if len(input.Data) > maxAvatarUploadSize {
		return nil, ErrAvatarTooLarge
	}
	if !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		return nil, ErrInvalidAvatarFile
	}

	user, err := s.loadUserByID(ctx, s.repo, userID)
	if err != nil {
		return nil, err
	}

	now := currentTime()
	avatar := &model.UserAvatar{
		UserID:      user.ID,
		FileName:    fileName,
		ContentType: contentType,
		Data:        append([]byte(nil), input.Data...),
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	existingAvatar, err := s.avatarRepo.GetByUserID(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	if existingAvatar != nil {
		avatar.CreatedAt = existingAvatar.CreatedAt
	}

	if err := s.avatarRepo.Upsert(ctx, avatar); err != nil {
		return nil, err
	}

	user.AvatarURL = buildAvatarDataURL(avatar)
	return &dto.UploadAvatarResponse{
		AvatarURL: user.AvatarURL,
		User:      user,
	}, nil
}

func (s *UserService) attachAvatarURL(ctx context.Context, user *model.User) (*model.User, error) {
	if user == nil || s.avatarRepo == nil {
		return user, nil
	}

	avatar, err := s.avatarRepo.GetByUserID(ctx, user.ID)
	if err != nil {
		// Avatar rendering is optional for auth/profile bootstrap. When an older
		// local database is missing the avatar table, we keep the login flow alive.
		if repository.IsUndefinedTableError(err) {
			return user, nil
		}
		return nil, err
	}
	user.AvatarURL = buildAvatarDataURL(avatar)
	return user, nil
}

func buildAvatarDataURL(avatar *model.UserAvatar) string {
	if avatar == nil || len(avatar.Data) == 0 || strings.TrimSpace(avatar.ContentType) == "" {
		return ""
	}

	return fmt.Sprintf(
		"data:%s;base64,%s",
		avatar.ContentType,
		base64.StdEncoding.EncodeToString(avatar.Data),
	)
}
