package service

import (
	"context"
	"errors"

	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	repository "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository/product"
)

var (
	ErrReservationOrderRequired = errors.New("order id is required")
	ErrReservationItemsRequired = errors.New("reservation requires at least one item")
	ErrReservationItemInvalid   = errors.New("reservation items require a product id and positive quantity")
)

// ReserveStockForOrder reserves stock for one order atomically across all its
// items. Replaying the same order id is a successful no-op so order-service can
// retry the call safely.
func (s *ProductService) ReserveStockForOrder(
	ctx context.Context,
	orderID string,
	items []model.StockReservationItem,
) (bool, error) {
	if orderID == "" {
		return false, ErrReservationOrderRequired
	}
	if len(items) == 0 {
		return false, ErrReservationItemsRequired
	}
	for _, item := range items {
		if item.ProductID == "" || item.Quantity <= 0 {
			return false, ErrReservationItemInvalid
		}
	}

	replayed, err := s.repo.ReserveStockForOrder(ctx, orderID, items)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientStock) {
			return false, ErrInsufficientStock
		}
		if errors.Is(err, repository.ErrProductNotFound) {
			return false, ErrProductNotFound
		}
		if errors.Is(err, repository.ErrProductVariantNotFound) {
			return false, ErrProductVariantNotFound
		}
		if errors.Is(err, repository.ErrProductVariantRequired) {
			return false, ErrProductVariantRequired
		}
		return false, err
	}

	if !replayed {
		for _, item := range items {
			s.reindexStockChangeBestEffort(ctx, item.ProductID)
		}
	}

	return replayed, nil
}

// ReleaseStockForOrder returns every still-active reservation of one order back
// into stock. Unknown or already-released orders release zero items, which
// keeps retries and stale release requests harmless.
func (s *ProductService) ReleaseStockForOrder(ctx context.Context, orderID string) (int, error) {
	if orderID == "" {
		return 0, ErrReservationOrderRequired
	}

	released, err := s.repo.ReleaseStockForOrder(ctx, orderID)
	if err != nil {
		return 0, err
	}

	for _, item := range released {
		s.reindexStockChangeBestEffort(ctx, item.ProductID)
	}

	if len(released) > 0 {
		s.log.Info("released reserved stock for order",
			zap.String("order_id", orderID),
			zap.Int("released_items", len(released)),
		)
	}

	return len(released), nil
}
