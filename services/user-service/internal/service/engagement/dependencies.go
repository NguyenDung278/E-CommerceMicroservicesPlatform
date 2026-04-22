package engagement

import (
	"context"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type NotificationPreferenceRepository interface {
	ListByUserID(ctx context.Context, userID string) ([]*model.NotificationPreference, error)
	UpsertMany(ctx context.Context, userID string, preferences []*model.NotificationPreference) error
}

type WishlistRepository interface {
	ListByUserID(ctx context.Context, userID string) ([]*model.WishlistItem, error)
	ListUserIDs(ctx context.Context, limit int) ([]string, error)
	Upsert(ctx context.Context, item *model.WishlistItem) error
	UpsertMany(ctx context.Context, items []*model.WishlistItem) error
	Delete(ctx context.Context, userID, productID string) error
}
