package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	repository "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository/product"
)

var (
	ErrStockAdjustmentDeltaRequired  = errors.New("stock adjustment delta must not be zero")
	ErrStockAdjustmentReasonInvalid  = errors.New("stock adjustment reason is invalid")
	ErrStockAdjustmentProductMissing = errors.New("stock adjustment requires a product id")
	ErrStockWouldGoNegative          = errors.New("stock adjustment would drive stock negative")
)

const maxStockAdjustmentIdempotencyKeyLength = 128

// AdjustStock applies one manual stock movement — goods received, a recount, a
// write-off — and records it in the ledger.
//
// Inputs:
//   - productID and sku select which stock pool moves; sku is required when the
//     product declares variants.
//   - delta is signed: positive receives stock, negative removes it.
//   - reason must be one of the known StockAdjustmentReason values.
//   - idempotencyKey, when supplied, makes a repeated submit return the earlier
//     ledger row instead of moving stock twice.
//
// Returns:
//   - the persisted ledger row, including the resulting stock of the pool.
//   - a domain error when validation, the product, the sku, or the resulting
//     count is rejected.
//
// Side effects:
//   - moves stock in PostgreSQL and appends one ledger row in the same
//     transaction; re-indexes the product into the search backend best-effort.
func (s *ProductService) AdjustStock(
	ctx context.Context,
	productID, sku string,
	delta int,
	reason model.StockAdjustmentReason,
	note, actorID, actorRole, idempotencyKey string,
) (*model.StockAdjustment, error) {
	if strings.TrimSpace(productID) == "" {
		return nil, ErrStockAdjustmentProductMissing
	}
	if delta == 0 {
		return nil, ErrStockAdjustmentDeltaRequired
	}
	if !reason.IsValid() {
		return nil, ErrStockAdjustmentReasonInvalid
	}

	normalizedKey := strings.TrimSpace(idempotencyKey)
	if len(normalizedKey) > maxStockAdjustmentIdempotencyKeyLength {
		normalizedKey = normalizedKey[:maxStockAdjustmentIdempotencyKeyLength]
	}

	adjustment := &model.StockAdjustment{
		ID:             uuid.NewString(),
		ProductID:      strings.TrimSpace(productID),
		SKU:            strings.TrimSpace(sku),
		Delta:          delta,
		Reason:         reason,
		Note:           strings.TrimSpace(note),
		ActorID:        actorID,
		ActorRole:      actorRole,
		IdempotencyKey: normalizedKey,
		CreatedAt:      time.Now(),
	}

	saved, err := s.repo.AdjustStock(ctx, adjustment)
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrProductNotFound):
			return nil, ErrProductNotFound
		case errors.Is(err, repository.ErrProductVariantNotFound):
			return nil, ErrProductVariantNotFound
		case errors.Is(err, repository.ErrProductVariantRequired):
			return nil, ErrProductVariantRequired
		case errors.Is(err, repository.ErrStockAdjustmentWouldGoNegative):
			return nil, ErrStockWouldGoNegative
		default:
			return nil, err
		}
	}

	s.reindexStockChangeBestEffort(ctx, saved.ProductID)
	s.log.Info("stock adjusted",
		zap.String("product_id", saved.ProductID),
		zap.String("sku", saved.SKU),
		zap.Int("delta", saved.Delta),
		zap.Int("resulting_stock", saved.ResultingStock),
		zap.String("reason", string(saved.Reason)),
		zap.String("actor_id", saved.ActorID),
	)

	return saved, nil
}

// ListStockAdjustments returns the recent ledger of one product so operators can
// reconcile a count difference against what was actually recorded.
func (s *ProductService) ListStockAdjustments(
	ctx context.Context,
	productID string,
	limit int,
) ([]*model.StockAdjustment, error) {
	if strings.TrimSpace(productID) == "" {
		return nil, ErrStockAdjustmentProductMissing
	}
	return s.repo.ListStockAdjustments(ctx, strings.TrimSpace(productID), limit)
}
