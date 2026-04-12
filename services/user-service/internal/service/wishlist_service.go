package service

import (
	"context"
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
)

type WishlistService struct {
	repo repository.WishlistRepository
}

func NewWishlistService(repo repository.WishlistRepository) *WishlistService {
	return &WishlistService{repo: repo}
}

func (s *WishlistService) ListWishlist(ctx context.Context, userID string) ([]*model.WishlistItem, error) {
	return s.repo.ListByUserID(ctx, strings.TrimSpace(userID))
}

func (s *WishlistService) AddToWishlist(ctx context.Context, userID string, req dto.AddWishlistItemRequest) (*model.WishlistItem, error) {
	now := time.Now()
	item := &model.WishlistItem{
		UserID:    strings.TrimSpace(userID),
		ProductID: strings.TrimSpace(req.ProductID),
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Upsert(ctx, item); err != nil {
		return nil, err
	}

	return item, nil
}

func (s *WishlistService) SyncWishlist(ctx context.Context, userID string, req dto.SyncWishlistRequest) ([]*model.WishlistItem, error) {
	productIDs := normalizeWishlistProductIDs(req.ProductIDs)
	if err := s.repo.UpsertMany(ctx, strings.TrimSpace(userID), productIDs); err != nil {
		return nil, err
	}

	return s.ListWishlist(ctx, userID)
}

func (s *WishlistService) RemoveFromWishlist(ctx context.Context, userID, productID string) error {
	return s.repo.Delete(ctx, strings.TrimSpace(userID), strings.TrimSpace(productID))
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
