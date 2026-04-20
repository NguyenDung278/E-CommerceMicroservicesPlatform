package service

import (
	"context"
	"strings"
	"time"

	userclient "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
)

type wishlistProductCatalog interface {
	ListProductsByIDs(ctx context.Context, ids []string) ([]userclient.ProductSnapshot, error)
}

type wishlistUserReader interface {
	GetByID(ctx context.Context, id string) (*model.User, error)
}

type WishlistServiceOption func(*WishlistService)

type WishlistService struct {
	repo                    repository.WishlistRepository
	productCatalog          wishlistProductCatalog
	notificationPreferences *NotificationPreferenceService
	userReader              wishlistUserReader
}

func NewWishlistService(repo repository.WishlistRepository, options ...WishlistServiceOption) *WishlistService {
	service := &WishlistService{repo: repo}
	for _, option := range options {
		option(service)
	}
	return service
}

func WithWishlistProductCatalog(catalog wishlistProductCatalog) WishlistServiceOption {
	return func(service *WishlistService) {
		service.productCatalog = catalog
	}
}

func WithWishlistNotificationPreferences(
	preferences *NotificationPreferenceService,
) WishlistServiceOption {
	return func(service *WishlistService) {
		service.notificationPreferences = preferences
	}
}

func WithWishlistUserReader(userReader wishlistUserReader) WishlistServiceOption {
	return func(service *WishlistService) {
		service.userReader = userReader
	}
}

func (s *WishlistService) ListWishlist(ctx context.Context, userID string) ([]*model.WishlistItem, error) {
	return s.repo.ListByUserID(ctx, strings.TrimSpace(userID))
}

func (s *WishlistService) AddToWishlist(ctx context.Context, userID string, req dto.AddWishlistItemRequest) (*model.WishlistItem, error) {
	now := time.Now()
	productID := strings.TrimSpace(req.ProductID)
	item := &model.WishlistItem{
		UserID:    strings.TrimSpace(userID),
		ProductID: productID,
		CreatedAt: now,
		UpdatedAt: now,
	}
	s.applyProductBaseline(ctx, item)

	if err := s.repo.Upsert(ctx, item); err != nil {
		return nil, err
	}

	return item, nil
}

func (s *WishlistService) SyncWishlist(ctx context.Context, userID string, req dto.SyncWishlistRequest) ([]*model.WishlistItem, error) {
	userID = strings.TrimSpace(userID)
	productIDs := normalizeWishlistProductIDs(req.ProductIDs)
	items := make([]*model.WishlistItem, 0, len(productIDs))
	now := time.Now()
	for _, productID := range productIDs {
		items = append(items, &model.WishlistItem{
			UserID:    userID,
			ProductID: productID,
			CreatedAt: now,
			UpdatedAt: now,
		})
	}
	s.applyProductBaselines(ctx, items)

	if err := s.repo.UpsertMany(ctx, items); err != nil {
		return nil, err
	}

	return s.ListWishlist(ctx, userID)
}

func (s *WishlistService) RemoveFromWishlist(ctx context.Context, userID, productID string) error {
	return s.repo.Delete(ctx, strings.TrimSpace(userID), strings.TrimSpace(productID))
}

func (s *WishlistService) ListAlerts(ctx context.Context, userID string) ([]model.WishlistAlert, error) {
	preferences := map[string]bool{
		model.NotificationTopicWishlistBackInStock: true,
		model.NotificationTopicWishlistPriceDrop:   true,
	}
	if s.notificationPreferences != nil {
		nextPreferences, err := s.notificationPreferences.PreferenceMap(ctx, strings.TrimSpace(userID))
		if err != nil {
			return nil, err
		}
		preferences = nextPreferences
	}
	if !preferences[model.NotificationTopicWishlistBackInStock] &&
		!preferences[model.NotificationTopicWishlistPriceDrop] {
		return []model.WishlistAlert{}, nil
	}

	items, err := s.ListWishlist(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return []model.WishlistAlert{}, nil
	}

	snapshots, err := s.listProductSnapshots(ctx, wishlistProductIDs(items))
	if err != nil {
		return nil, err
	}
	snapshotsByID := make(map[string]userclient.ProductSnapshot, len(snapshots))
	for _, snapshot := range snapshots {
		snapshotsByID[snapshot.ID] = snapshot
	}

	alerts := make([]model.WishlistAlert, 0)
	detectedAt := time.Now()
	for _, item := range items {
		snapshot, ok := snapshotsByID[item.ProductID]
		if !ok {
			continue
		}
		if preferences[model.NotificationTopicWishlistBackInStock] &&
			item.BaselineStock <= 0 &&
			snapshot.Stock > 0 {
			alerts = append(alerts, model.WishlistAlert{
				ProductID:     item.ProductID,
				ProductName:   snapshot.Name,
				Kind:          model.WishlistAlertKindBackInStock,
				BaselineStock: item.BaselineStock,
				CurrentStock:  snapshot.Stock,
				DetectedAt:    detectedAt,
			})
		}
		if preferences[model.NotificationTopicWishlistPriceDrop] &&
			item.BaselinePrice > 0 &&
			snapshot.Price > 0 &&
			snapshot.Price < item.BaselinePrice {
			alerts = append(alerts, model.WishlistAlert{
				ProductID:     item.ProductID,
				ProductName:   snapshot.Name,
				Kind:          model.WishlistAlertKindPriceDrop,
				BaselinePrice: item.BaselinePrice,
				CurrentPrice:  snapshot.Price,
				DetectedAt:    detectedAt,
			})
		}
	}

	return alerts, nil
}

func (s *WishlistService) ListDispatchableAlerts(
	ctx context.Context,
	limit int,
) ([]model.WishlistAlertDelivery, error) {
	if s.userReader == nil {
		return []model.WishlistAlertDelivery{}, nil
	}

	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	userIDs, err := s.repo.ListUserIDs(ctx, limit)
	if err != nil {
		return nil, err
	}
	if len(userIDs) == 0 {
		return []model.WishlistAlertDelivery{}, nil
	}

	deliveries := make([]model.WishlistAlertDelivery, 0)
	for _, userID := range userIDs {
		user, err := s.userReader.GetByID(ctx, strings.TrimSpace(userID))
		if err != nil {
			return nil, err
		}
		if user == nil {
			continue
		}

		alerts, err := s.ListAlerts(ctx, userID)
		if err != nil {
			return nil, err
		}
		for _, alert := range alerts {
			deliveries = append(deliveries, model.WishlistAlertDelivery{
				UserID:    user.ID,
				UserEmail: strings.TrimSpace(user.Email),
				Topic:     wishlistAlertTopic(alert.Kind),
				Alert:     alert,
			})
			if len(deliveries) >= limit {
				return deliveries, nil
			}
		}
	}

	return deliveries, nil
}

func normalizeWishlistProductIDs(productIDs []string) []string {
	if len(productIDs) == 0 {
		return []string{}
	}

	normalized := make([]string, 0, len(productIDs))
	seen := make(map[string]struct{}, len(productIDs))
	for _, productID := range productIDs {
		clean := strings.TrimSpace(productID)
		if clean == "" {
			continue
		}
		if _, exists := seen[clean]; exists {
			continue
		}

		seen[clean] = struct{}{}
		normalized = append(normalized, clean)
	}

	return normalized
}

func wishlistProductIDs(items []*model.WishlistItem) []string {
	productIDs := make([]string, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		productIDs = append(productIDs, item.ProductID)
	}
	return normalizeWishlistProductIDs(productIDs)
}

func (s *WishlistService) applyProductBaseline(ctx context.Context, item *model.WishlistItem) {
	if item == nil || s.productCatalog == nil {
		return
	}

	snapshots, err := s.listProductSnapshots(ctx, []string{item.ProductID})
	if err != nil || len(snapshots) == 0 {
		return
	}

	item.BaselinePrice = snapshots[0].Price
	item.BaselineStock = snapshots[0].Stock
}

func (s *WishlistService) applyProductBaselines(ctx context.Context, items []*model.WishlistItem) {
	if len(items) == 0 || s.productCatalog == nil {
		return
	}

	snapshots, err := s.listProductSnapshots(ctx, wishlistProductIDs(items))
	if err != nil || len(snapshots) == 0 {
		return
	}

	snapshotsByID := make(map[string]userclient.ProductSnapshot, len(snapshots))
	for _, snapshot := range snapshots {
		snapshotsByID[snapshot.ID] = snapshot
	}
	for _, item := range items {
		snapshot, ok := snapshotsByID[item.ProductID]
		if !ok {
			continue
		}
		item.BaselinePrice = snapshot.Price
		item.BaselineStock = snapshot.Stock
	}
}

func (s *WishlistService) listProductSnapshots(
	ctx context.Context,
	productIDs []string,
) ([]userclient.ProductSnapshot, error) {
	if s.productCatalog == nil {
		return []userclient.ProductSnapshot{}, nil
	}
	return s.productCatalog.ListProductsByIDs(ctx, productIDs)
}

func wishlistAlertTopic(kind string) string {
	switch kind {
	case model.WishlistAlertKindBackInStock:
		return model.NotificationTopicWishlistBackInStock
	case model.WishlistAlertKindPriceDrop:
		return model.NotificationTopicWishlistPriceDrop
	default:
		return ""
	}
}
