package engagement

import (
	"context"
	"testing"
	"time"

	userclient "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type fakeNotificationPreferenceRepo struct {
	preferencesByUser map[string][]*model.NotificationPreference
}

type fakeWishlistRepo struct {
	itemsByUser map[string][]*model.WishlistItem
	lastUpsert  *model.WishlistItem
}

type fakeWishlistProductCatalog struct {
	snapshotsByID map[string]userclient.ProductSnapshot
}

type fakeWishlistUserReader struct {
	usersByID map[string]*model.User
}

func (r *fakeNotificationPreferenceRepo) ListByUserID(
	_ context.Context,
	userID string,
) ([]*model.NotificationPreference, error) {
	source := r.preferencesByUser[userID]
	preferences := make([]*model.NotificationPreference, 0, len(source))
	for _, preference := range source {
		if preference == nil {
			continue
		}
		copyValue := *preference
		preferences = append(preferences, &copyValue)
	}
	return preferences, nil
}

func (r *fakeNotificationPreferenceRepo) UpsertMany(
	_ context.Context,
	userID string,
	preferences []*model.NotificationPreference,
) error {
	stored := make([]*model.NotificationPreference, 0, len(preferences))
	for _, preference := range preferences {
		if preference == nil {
			continue
		}
		copyValue := *preference
		copyValue.UserID = userID
		stored = append(stored, &copyValue)
	}
	if r.preferencesByUser == nil {
		r.preferencesByUser = map[string][]*model.NotificationPreference{}
	}
	r.preferencesByUser[userID] = stored
	return nil
}

func (r *fakeWishlistRepo) ListByUserID(_ context.Context, userID string) ([]*model.WishlistItem, error) {
	source := r.itemsByUser[userID]
	items := make([]*model.WishlistItem, 0, len(source))
	for _, item := range source {
		if item == nil {
			continue
		}
		copyValue := *item
		items = append(items, &copyValue)
	}
	return items, nil
}

func (r *fakeWishlistRepo) ListUserIDs(_ context.Context, limit int) ([]string, error) {
	userIDs := make([]string, 0, len(r.itemsByUser))
	for userID, items := range r.itemsByUser {
		if len(items) == 0 {
			continue
		}
		userIDs = append(userIDs, userID)
		if limit > 0 && len(userIDs) >= limit {
			break
		}
	}
	return userIDs, nil
}

func (r *fakeWishlistRepo) Upsert(_ context.Context, item *model.WishlistItem) error {
	if item == nil {
		return nil
	}
	copyValue := *item
	r.lastUpsert = &copyValue
	if r.itemsByUser == nil {
		r.itemsByUser = map[string][]*model.WishlistItem{}
	}
	replaced := false
	items := r.itemsByUser[item.UserID]
	for index, existing := range items {
		if existing != nil && existing.ProductID == item.ProductID {
			items[index] = &copyValue
			replaced = true
			break
		}
	}
	if !replaced {
		r.itemsByUser[item.UserID] = append(items, &copyValue)
	}
	return nil
}

func (r *fakeWishlistRepo) UpsertMany(_ context.Context, items []*model.WishlistItem) error {
	for _, item := range items {
		if err := r.Upsert(context.Background(), item); err != nil {
			return err
		}
	}
	return nil
}

func (r *fakeWishlistRepo) Delete(_ context.Context, userID, productID string) error {
	source := r.itemsByUser[userID]
	filtered := make([]*model.WishlistItem, 0, len(source))
	for _, item := range source {
		if item == nil || item.ProductID == productID {
			continue
		}
		filtered = append(filtered, item)
	}
	r.itemsByUser[userID] = filtered
	return nil
}

func (c *fakeWishlistProductCatalog) ListProductsByIDs(
	_ context.Context,
	ids []string,
) ([]userclient.ProductSnapshot, error) {
	snapshots := make([]userclient.ProductSnapshot, 0, len(ids))
	for _, id := range ids {
		snapshot, ok := c.snapshotsByID[id]
		if !ok {
			continue
		}
		snapshots = append(snapshots, snapshot)
	}
	return snapshots, nil
}

func (r *fakeWishlistUserReader) GetByID(_ context.Context, id string) (*model.User, error) {
	user := r.usersByID[id]
	if user == nil {
		return nil, nil
	}
	copyValue := *user
	return &copyValue, nil
}

func TestNotificationPreferenceServiceDefaultsToEnabled(t *testing.T) {
	repo := &fakeNotificationPreferenceRepo{preferencesByUser: map[string][]*model.NotificationPreference{}}
	service := NewNotificationPreferenceService(repo)

	preferences, err := service.ListPreferences(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("ListPreferences returned error: %v", err)
	}
	if len(preferences) != len(supportedNotificationTopics()) {
		t.Fatalf("expected %d preferences, got %d", len(supportedNotificationTopics()), len(preferences))
	}
	for _, preference := range preferences {
		if !preference.Enabled {
			t.Fatalf("expected topic %q to default to enabled", preference.Topic)
		}
		if preference.UserID != "user-1" {
			t.Fatalf("expected user_id to be normalized, got %#v", preference)
		}
	}
}

func TestWishlistServiceAddToWishlistCapturesProductBaseline(t *testing.T) {
	repo := &fakeWishlistRepo{itemsByUser: map[string][]*model.WishlistItem{}}
	catalog := &fakeWishlistProductCatalog{
		snapshotsByID: map[string]userclient.ProductSnapshot{
			"product-1": {
				ID:    "product-1",
				Name:  "Archive Coat",
				Price: 149.5,
				Stock: 7,
			},
		},
	}
	service := NewWishlistService(repo, WithWishlistProductCatalog(catalog))

	item, err := service.AddToWishlist(context.Background(), "user-1", dto.AddWishlistItemRequest{
		ProductID: "product-1",
	})
	if err != nil {
		t.Fatalf("AddToWishlist returned error: %v", err)
	}
	if item.BaselinePrice != 149.5 || item.BaselineStock != 7 {
		t.Fatalf("expected baseline values from catalog, got %#v", item)
	}
	if repo.lastUpsert == nil || repo.lastUpsert.BaselinePrice != 149.5 || repo.lastUpsert.BaselineStock != 7 {
		t.Fatalf("expected repo upsert to persist baseline values, got %#v", repo.lastUpsert)
	}
}

func TestWishlistServiceListAlertsHonorsNotificationPreferences(t *testing.T) {
	preferenceRepo := &fakeNotificationPreferenceRepo{
		preferencesByUser: map[string][]*model.NotificationPreference{
			"user-1": {
				{
					UserID:    "user-1",
					Topic:     model.NotificationTopicWishlistBackInStock,
					Enabled:   false,
					UpdatedAt: time.Now(),
				},
				{
					UserID:    "user-1",
					Topic:     model.NotificationTopicWishlistPriceDrop,
					Enabled:   true,
					UpdatedAt: time.Now(),
				},
			},
		},
	}
	wishlistRepo := &fakeWishlistRepo{
		itemsByUser: map[string][]*model.WishlistItem{
			"user-1": {
				{
					UserID:        "user-1",
					ProductID:     "product-1",
					BaselinePrice: 120,
					BaselineStock: 0,
				},
			},
		},
	}
	catalog := &fakeWishlistProductCatalog{
		snapshotsByID: map[string]userclient.ProductSnapshot{
			"product-1": {
				ID:    "product-1",
				Name:  "Archive Coat",
				Price: 90,
				Stock: 12,
			},
		},
	}

	service := NewWishlistService(
		wishlistRepo,
		WithWishlistProductCatalog(catalog),
		WithWishlistNotificationPreferences(NewNotificationPreferenceService(preferenceRepo)),
	)

	alerts, err := service.ListAlerts(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("ListAlerts returned error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert after preference filtering, got %d", len(alerts))
	}
	if alerts[0].Kind != model.WishlistAlertKindPriceDrop {
		t.Fatalf("expected only price_drop alert, got %#v", alerts[0])
	}
	if alerts[0].CurrentPrice != 90 || alerts[0].BaselinePrice != 120 {
		t.Fatalf("expected price delta payload, got %#v", alerts[0])
	}
}

func TestWishlistServiceListDispatchableAlertsIncludesRecipientContext(t *testing.T) {
	preferenceRepo := &fakeNotificationPreferenceRepo{
		preferencesByUser: map[string][]*model.NotificationPreference{
			"user-1": {
				{
					UserID:    "user-1",
					Topic:     model.NotificationTopicWishlistPriceDrop,
					Enabled:   true,
					UpdatedAt: time.Now(),
				},
			},
		},
	}
	wishlistRepo := &fakeWishlistRepo{
		itemsByUser: map[string][]*model.WishlistItem{
			"user-1": {
				{
					UserID:        "user-1",
					ProductID:     "product-1",
					BaselinePrice: 120,
					BaselineStock: 4,
				},
			},
		},
	}
	catalog := &fakeWishlistProductCatalog{
		snapshotsByID: map[string]userclient.ProductSnapshot{
			"product-1": {
				ID:    "product-1",
				Name:  "Archive Coat",
				Price: 95,
				Stock: 4,
			},
		},
	}
	userReader := &fakeWishlistUserReader{
		usersByID: map[string]*model.User{
			"user-1": {
				ID:    "user-1",
				Email: "buyer@example.com",
			},
		},
	}

	service := NewWishlistService(
		wishlistRepo,
		WithWishlistProductCatalog(catalog),
		WithWishlistNotificationPreferences(NewNotificationPreferenceService(preferenceRepo)),
		WithWishlistUserReader(userReader),
	)

	deliveries, err := service.ListDispatchableAlerts(context.Background(), 10)
	if err != nil {
		t.Fatalf("ListDispatchableAlerts returned error: %v", err)
	}
	if len(deliveries) != 1 {
		t.Fatalf("expected 1 dispatchable alert, got %d", len(deliveries))
	}
	if deliveries[0].UserID != "user-1" || deliveries[0].UserEmail != "buyer@example.com" {
		t.Fatalf("expected recipient context in delivery payload, got %#v", deliveries[0])
	}
	if deliveries[0].Topic != model.NotificationTopicWishlistPriceDrop {
		t.Fatalf("expected price drop topic, got %#v", deliveries[0])
	}
}
