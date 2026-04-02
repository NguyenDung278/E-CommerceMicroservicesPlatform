package service

import (
	"context"
	"errors"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

const productReviewMetricsService = "product-service"

var (
	ErrProductReviewNotFound      = model.ErrProductReviewNotFound
	ErrProductReviewAlreadyExists = model.ErrProductReviewAlreadyExists
)

type ProductLookup interface {
	GetByID(ctx context.Context, id string) (*model.Product, error)
}

type ProductReviewRepository interface {
	CreateReview(ctx context.Context, review *model.ProductReview) error
	GetReviewByProductAndUser(ctx context.Context, productID, userID string) (*model.ProductReview, error)
	GetReviewByProductAndUserForUpdate(ctx context.Context, productID, userID string) (*model.ProductReview, error)
	UpdateReview(ctx context.Context, review *model.ProductReview) error
	DeleteReviewByProductAndUser(ctx context.Context, productID, userID string) (*model.ProductReview, error)
	ListReviewsByProduct(ctx context.Context, productID string, offset, limit int) ([]*model.ProductReview, error)
	GetReviewSummary(ctx context.Context, productID string) (*model.ProductReviewSummary, error)
	ApplyReviewSummaryDelta(ctx context.Context, productID string, delta model.ProductReviewSummaryDelta) error
}

type ProductReviewTxRepositories struct {
	Reviews ProductReviewRepository
}

type ProductReviewTxManager interface {
	RunInTx(ctx context.Context, fn func(ProductReviewTxRepositories) error) error
}

type ProductReviewCache interface {
	GetSummary(ctx context.Context, productID string) (*model.ProductReviewSummary, bool, error)
	SetSummary(ctx context.Context, productID string, summary *model.ProductReviewSummary) error
	GetFirstPage(ctx context.Context, productID string, limit int) ([]*model.ProductReview, bool, error)
	SetFirstPage(ctx context.Context, productID string, limit int, reviews []*model.ProductReview) error
	Invalidate(ctx context.Context, productID string) error
}

type ProductReviewEventType string

const (
	ProductReviewCreated ProductReviewEventType = "review_created"
	ProductReviewUpdated ProductReviewEventType = "review_updated"
	ProductReviewDeleted ProductReviewEventType = "review_deleted"
)

type ProductReviewEvent struct {
	Type           ProductReviewEventType
	ProductID      string
	Review         *model.ProductReview
	PreviousReview *model.ProductReview
}

type ProductReviewObserver interface {
	Handle(ctx context.Context, event ProductReviewEvent) error
}

type ProductReviewService struct {
	productLookup ProductLookup
	repo          ProductReviewRepository
	txManager     ProductReviewTxManager
	cache         ProductReviewCache
	observer      ProductReviewObserver
	factory       ProductReviewFactory
	log           *zap.Logger
	tracer        trace.Tracer
}

type ProductReviewServiceOption func(*ProductReviewService)

func WithProductReviewTxManager(txManager ProductReviewTxManager) ProductReviewServiceOption {
	return func(service *ProductReviewService) {
		service.txManager = txManager
	}
}

func WithProductReviewCache(cache ProductReviewCache) ProductReviewServiceOption {
	return func(service *ProductReviewService) {
		service.cache = cache
	}
}

func WithProductReviewObserver(observer ProductReviewObserver) ProductReviewServiceOption {
	return func(service *ProductReviewService) {
		service.observer = observer
	}
}

func WithProductReviewLogger(log *zap.Logger) ProductReviewServiceOption {
	return func(service *ProductReviewService) {
		service.log = log
	}
}

func WithProductReviewFactory(factory ProductReviewFactory) ProductReviewServiceOption {
	return func(service *ProductReviewService) {
		service.factory = factory
	}
}

func NewProductReviewService(
	productLookup ProductLookup,
	repo ProductReviewRepository,
	options ...ProductReviewServiceOption,
) *ProductReviewService {
	service := &ProductReviewService{
		productLookup: productLookup,
		repo:          repo,
		observer:      noopProductReviewObserver{},
		factory:       NewProductReviewFactory(),
		log:           zap.NewNop(),
		tracer:        otel.Tracer("product-service/product-review"),
	}
	for _, option := range options {
		option(service)
	}

	return service
}

func (s *ProductReviewService) ListReviews(
	ctx context.Context,
	productID string,
	query dto.ListProductReviewsQuery,
) (_ *model.ProductReviewList, _ int64, err error) {
	startedAt := time.Now()
	ctx, span := s.tracer.Start(ctx, "ProductReviewService.ListReviews",
		trace.WithAttributes(attribute.String("product_id", productID)))
	defer span.End()
	defer s.observeOperation("list_reviews", startedAt, err)

	if _, err = s.productLookup.GetByID(ctx, productID); err != nil {
		return nil, 0, err
	}

	normalized := normalizeProductReviewListQuery(query)
	span.SetAttributes(
		attribute.Int("page", normalized.page),
		attribute.Int("limit", normalized.limit),
		attribute.Int("offset", normalized.offset),
	)

	summary, err := s.loadReviewSummary(ctx, productID)
	if err != nil {
		return nil, 0, err
	}

	total := summary.ReviewCount
	if total == 0 || normalized.offset >= int(total) {
		return &model.ProductReviewList{
			Summary: *summary,
			Items:   []*model.ProductReview{},
		}, total, nil
	}

	var reviews []*model.ProductReview
	if normalized.page == 1 {
		reviews, err = s.loadFirstReviewPage(ctx, productID, normalized.limit)
	} else {
		reviews, err = s.loadReviewsFromStore(ctx, productID, normalized.offset, normalized.limit)
	}
	if err != nil {
		return nil, 0, err
	}

	return &model.ProductReviewList{
		Summary: *summary,
		Items:   reviews,
	}, total, nil
}

func (s *ProductReviewService) GetReviewByProductAndUser(
	ctx context.Context,
	productID string,
	userID string,
) (_ *model.ProductReview, err error) {
	startedAt := time.Now()
	ctx, span := s.tracer.Start(ctx, "ProductReviewService.GetReviewByProductAndUser",
		trace.WithAttributes(
			attribute.String("product_id", productID),
			attribute.String("user_id", userID),
		))
	defer span.End()
	defer s.observeOperation("get_my_review", startedAt, err)

	if _, err = s.productLookup.GetByID(ctx, productID); err != nil {
		return nil, err
	}

	review, err := s.repo.GetReviewByProductAndUser(ctx, productID, userID)
	if err != nil {
		return nil, err
	}

	return review, nil
}

func (s *ProductReviewService) CreateReview(
	ctx context.Context,
	productID string,
	userID string,
	userEmail string,
	req dto.CreateProductReviewRequest,
) (_ *model.ProductReview, err error) {
	startedAt := time.Now()
	ctx, span := s.tracer.Start(ctx, "ProductReviewService.CreateReview",
		trace.WithAttributes(
			attribute.String("product_id", productID),
			attribute.String("user_id", userID),
		))
	defer span.End()
	defer s.observeOperation("create_review", startedAt, err)

	if _, err = s.productLookup.GetByID(ctx, productID); err != nil {
		return nil, err
	}

	review := s.factory.New(productID, userID, userEmail, req)

	if err = s.runInTx(ctx, func(repo ProductReviewRepository) error {
		return s.createReviewWithRepository(ctx, repo, review)
	}); err != nil {
		if errors.Is(err, ErrProductReviewAlreadyExists) {
			appobs.IncEvent(productReviewMetricsService, "review_conflict", appobs.OutcomeBusinessError)
		}
		return nil, err
	}

	s.notifyBestEffort(ctx, ProductReviewEvent{
		Type:      ProductReviewCreated,
		ProductID: productID,
		Review:    cloneProductReview(review),
	})

	return review, nil
}

func (s *ProductReviewService) UpdateReview(
	ctx context.Context,
	productID string,
	userID string,
	req dto.UpdateProductReviewRequest,
) (_ *model.ProductReview, err error) {
	startedAt := time.Now()
	ctx, span := s.tracer.Start(ctx, "ProductReviewService.UpdateReview",
		trace.WithAttributes(
			attribute.String("product_id", productID),
			attribute.String("user_id", userID),
		))
	defer span.End()
	defer s.observeOperation("update_review", startedAt, err)

	if _, err = s.productLookup.GetByID(ctx, productID); err != nil {
		return nil, err
	}

	var (
		previousReview *model.ProductReview
		updatedReview  *model.ProductReview
	)

	if err = s.runInTx(ctx, func(repo ProductReviewRepository) error {
		loadedReview, loadErr := s.loadReviewForMutation(ctx, repo, productID, userID)
		if loadErr != nil {
			return loadErr
		}

		previousReview = cloneProductReview(loadedReview)
		updatedReview = s.factory.Update(loadedReview, req)
		if err := repo.UpdateReview(ctx, updatedReview); err != nil {
			return err
		}

		delta := model.NewProductReviewUpdateDelta(previousReview.Rating, updatedReview.Rating, updatedReview.UpdatedAt)
		return repo.ApplyReviewSummaryDelta(ctx, productID, delta)
	}); err != nil {
		return nil, err
	}

	s.notifyBestEffort(ctx, ProductReviewEvent{
		Type:           ProductReviewUpdated,
		ProductID:      productID,
		Review:         cloneProductReview(updatedReview),
		PreviousReview: cloneProductReview(previousReview),
	})

	return updatedReview, nil
}

func (s *ProductReviewService) DeleteReview(ctx context.Context, productID string, userID string) (err error) {
	startedAt := time.Now()
	ctx, span := s.tracer.Start(ctx, "ProductReviewService.DeleteReview",
		trace.WithAttributes(
			attribute.String("product_id", productID),
			attribute.String("user_id", userID),
		))
	defer span.End()
	defer s.observeOperation("delete_review", startedAt, err)

	if _, err = s.productLookup.GetByID(ctx, productID); err != nil {
		return err
	}

	var deletedReview *model.ProductReview
	if err = s.runInTx(ctx, func(repo ProductReviewRepository) error {
		deleted, deleteErr := repo.DeleteReviewByProductAndUser(ctx, productID, userID)
		if deleteErr != nil {
			return deleteErr
		}

		deletedReview = cloneProductReview(deleted)
		return repo.ApplyReviewSummaryDelta(ctx, productID, model.NewProductReviewDeleteDelta(deleted.Rating, time.Now()))
	}); err != nil {
		return err
	}

	s.notifyBestEffort(ctx, ProductReviewEvent{
		Type:      ProductReviewDeleted,
		ProductID: productID,
		Review:    cloneProductReview(deletedReview),
	})

	return nil
}

func (s *ProductReviewService) createReviewWithRepository(
	ctx context.Context,
	repo ProductReviewRepository,
	review *model.ProductReview,
) error {
	if err := repo.CreateReview(ctx, review); err != nil {
		return err
	}

	return repo.ApplyReviewSummaryDelta(ctx, review.ProductID, model.NewProductReviewCreateDelta(review.Rating, review.UpdatedAt))
}

func (s *ProductReviewService) loadReviewForMutation(
	ctx context.Context,
	repo ProductReviewRepository,
	productID string,
	userID string,
) (*model.ProductReview, error) {
	if s.txManager != nil {
		return repo.GetReviewByProductAndUserForUpdate(ctx, productID, userID)
	}

	return repo.GetReviewByProductAndUser(ctx, productID, userID)
}

func (s *ProductReviewService) runInTx(ctx context.Context, fn func(ProductReviewRepository) error) error {
	if s.txManager == nil {
		return fn(s.repo)
	}

	return s.txManager.RunInTx(ctx, func(repos ProductReviewTxRepositories) error {
		return fn(repos.Reviews)
	})
}

func (s *ProductReviewService) loadReviewSummary(
	ctx context.Context,
	productID string,
) (*model.ProductReviewSummary, error) {
	ctx, span := s.tracer.Start(ctx, "ProductReviewService.loadReviewSummary",
		trace.WithAttributes(attribute.String("product_id", productID)))
	defer span.End()

	if s.cache != nil {
		summary, hit, err := s.cache.GetSummary(ctx, productID)
		if err != nil {
			s.warnCacheFailure(ctx, "failed to get product review summary from cache", productID, err)
			appobs.IncEvent(productReviewMetricsService, "review_summary_cache_fallback", appobs.OutcomeSystemError)
		} else if hit {
			span.SetAttributes(attribute.Bool("cache_hit", true))
			appobs.IncEvent(productReviewMetricsService, "review_summary_cache_hit", appobs.OutcomeSuccess)
			return summary, nil
		} else {
			appobs.IncEvent(productReviewMetricsService, "review_summary_cache_miss", appobs.OutcomeSuccess)
		}
	}

	summary, err := s.repo.GetReviewSummary(ctx, productID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		if err := s.cache.SetSummary(ctx, productID, summary); err != nil {
			s.warnCacheFailure(ctx, "failed to set product review summary cache", productID, err)
		}
	}

	return summary, nil
}

func (s *ProductReviewService) loadFirstReviewPage(
	ctx context.Context,
	productID string,
	limit int,
) ([]*model.ProductReview, error) {
	ctx, span := s.tracer.Start(ctx, "ProductReviewService.loadFirstReviewPage",
		trace.WithAttributes(
			attribute.String("product_id", productID),
			attribute.Int("limit", limit),
		))
	defer span.End()

	if s.cache != nil {
		reviews, hit, err := s.cache.GetFirstPage(ctx, productID, limit)
		if err != nil {
			s.warnCacheFailure(ctx, "failed to get product review first page from cache", productID, err)
			appobs.IncEvent(productReviewMetricsService, "review_list_cache_fallback", appobs.OutcomeSystemError)
		} else if hit {
			span.SetAttributes(attribute.Bool("cache_hit", true))
			appobs.IncEvent(productReviewMetricsService, "review_list_cache_hit", appobs.OutcomeSuccess)
			return reviews, nil
		} else {
			appobs.IncEvent(productReviewMetricsService, "review_list_cache_miss", appobs.OutcomeSuccess)
		}
	}

	reviews, err := s.loadReviewsFromStore(ctx, productID, 0, limit)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		if err := s.cache.SetFirstPage(ctx, productID, limit, reviews); err != nil {
			s.warnCacheFailure(ctx, "failed to set product review first page cache", productID, err)
		}
	}

	return reviews, nil
}

func (s *ProductReviewService) loadReviewsFromStore(
	ctx context.Context,
	productID string,
	offset int,
	limit int,
) ([]*model.ProductReview, error) {
	ctx, span := s.tracer.Start(ctx, "ProductReviewService.loadReviewsFromStore",
		trace.WithAttributes(
			attribute.String("product_id", productID),
			attribute.Int("offset", offset),
			attribute.Int("limit", limit),
		))
	defer span.End()

	return s.repo.ListReviewsByProduct(ctx, productID, offset, limit)
}

func (s *ProductReviewService) notifyBestEffort(ctx context.Context, event ProductReviewEvent) {
	if s.observer == nil {
		return
	}

	if err := s.observer.Handle(ctx, event); err != nil {
		appobs.LoggerWithContext(s.log, ctx,
			zap.String("product_id", event.ProductID),
			zap.String("event_type", string(event.Type)),
		).Warn("product review observer failed", zap.Error(err))
	}
}

func (s *ProductReviewService) warnCacheFailure(ctx context.Context, message string, productID string, err error) {
	appobs.LoggerWithContext(s.log, ctx, zap.String("product_id", productID)).
		Warn(message, zap.Error(err))
}

func (s *ProductReviewService) observeOperation(operation string, startedAt time.Time, err error) {
	appobs.ObserveOperation(
		productReviewMetricsService,
		operation,
		appobs.OutcomeFromError(err, ErrProductNotFound, ErrProductReviewNotFound, ErrProductReviewAlreadyExists),
		time.Since(startedAt),
	)
}

type normalizedProductReviewListQuery struct {
	page   int
	limit  int
	offset int
}

func normalizeProductReviewListQuery(query dto.ListProductReviewsQuery) normalizedProductReviewListQuery {
	page := query.Page
	if page < 1 {
		page = 1
	}

	limit := query.Limit
	if limit < 1 || limit > 50 {
		limit = 10
	}

	return normalizedProductReviewListQuery{
		page:   page,
		limit:  limit,
		offset: (page - 1) * limit,
	}
}
