package service

import (
	"context"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
)

type noopProductReviewObserver struct{}

func (noopProductReviewObserver) Handle(context.Context, ProductReviewEvent) error {
	return nil
}

type compositeProductReviewObserver struct {
	observers []ProductReviewObserver
}

func NewProductReviewObserverChain(observers ...ProductReviewObserver) ProductReviewObserver {
	filtered := make([]ProductReviewObserver, 0, len(observers))
	for _, observer := range observers {
		if observer == nil {
			continue
		}
		filtered = append(filtered, observer)
	}

	if len(filtered) == 0 {
		return noopProductReviewObserver{}
	}

	return compositeProductReviewObserver{observers: filtered}
}

func (o compositeProductReviewObserver) Handle(ctx context.Context, event ProductReviewEvent) error {
	var firstErr error
	for _, observer := range o.observers {
		if err := observer.Handle(ctx, event); err != nil && firstErr == nil {
			firstErr = err
		}
	}

	return firstErr
}

type productReviewMetricsObserver struct{}

func NewProductReviewMetricsObserver() ProductReviewObserver {
	return productReviewMetricsObserver{}
}

func (productReviewMetricsObserver) Handle(_ context.Context, event ProductReviewEvent) error {
	appobs.IncEvent(productReviewMetricsService, string(event.Type), appobs.OutcomeSuccess)
	return nil
}

type productReviewCacheInvalidationObserver struct {
	cache ProductReviewCache
}

func NewProductReviewCacheInvalidationObserver(cache ProductReviewCache) ProductReviewObserver {
	if cache == nil {
		return noopProductReviewObserver{}
	}

	return productReviewCacheInvalidationObserver{cache: cache}
}

func (o productReviewCacheInvalidationObserver) Handle(ctx context.Context, event ProductReviewEvent) error {
	return o.cache.Invalidate(ctx, event.ProductID)
}
