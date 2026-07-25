package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

var (
	ErrCouponNotFound          = errors.New("coupon not found")
	ErrCouponInactive          = errors.New("coupon inactive")
	ErrCouponExpired           = errors.New("coupon expired")
	ErrCouponUsageLimitReached = errors.New("coupon usage limit reached")
	ErrCouponMinimumNotMet     = errors.New("order does not meet coupon minimum amount")
	ErrInvalidOrderCursor      = errors.New("invalid order cursor")
)

type OrderRepository interface {
	Create(ctx context.Context, order *model.Order, outbox *model.OutboxMessage) error
	CreateWithIdempotency(ctx context.Context, order *model.Order, outbox *model.OutboxMessage, record *model.OrderIdempotencyRecord) error
	GetByID(ctx context.Context, id string) (*model.Order, error)
	GetByUserID(ctx context.Context, userID string) ([]*model.Order, error)
	GetIdempotencyKey(ctx context.Context, userID, idempotencyKey string) (*model.OrderIdempotencyRecord, error)
	CreateReturn(ctx context.Context, returnRequest *model.ReturnRequest, outbox *model.OutboxMessage) error
	GetReturnByID(ctx context.Context, id string) (*model.ReturnRequest, error)
	ListReturnsByOrderID(ctx context.Context, orderID string) ([]*model.ReturnRequest, error)
	ListReturns(ctx context.Context, filters model.ReturnFilters) ([]*model.ReturnRequest, int64, error)
	AddReturnEvidence(ctx context.Context, returnID string, status model.ReturnStatus, evidence []model.ReturnEvidence, actorID, actorRole, message string) error
	GetReturnQueueHealth(ctx context.Context) (*model.ReturnQueueHealth, error)
	UpdateReturnStatus(ctx context.Context, id string, status model.ReturnStatus, actorID, actorRole, message string, outbox *model.OutboxMessage) error
	ScheduleReturnRefund(ctx context.Context, returnRequest *model.ReturnRequest, actorID, actorRole, message string, outbox *model.OutboxMessage) error
	ClaimPendingReturnRefunds(ctx context.Context, limit int, leaseDuration time.Duration) ([]*model.ReturnRequest, error)
	CompleteReturnRefund(ctx context.Context, returnRequest *model.ReturnRequest, actorID, actorRole, message string, outbox *model.OutboxMessage) error
	MarkReturnRefundAttemptFailed(ctx context.Context, returnID, lastError string, nextRetryAt time.Time) error
	ListAll(ctx context.Context, filters model.OrderFilters) ([]*model.Order, int64, error)
	ListAllByCursor(ctx context.Context, filters model.OrderFilters) ([]*model.Order, string, bool, error)
	GetEventsByOrderID(ctx context.Context, orderID string) ([]*model.OrderEvent, error)
	GetShipmentTrackingByOrderID(ctx context.Context, orderID string) (*model.ShipmentTracking, error)
	UpsertShipmentTracking(ctx context.Context, tracking *model.ShipmentTracking) error
	UpdateStatus(ctx context.Context, id string, status model.OrderStatus, actorID, actorRole, message string, outbox *model.OutboxMessage) error
	CreateCoupon(ctx context.Context, coupon *model.Coupon) error
	ListCoupons(ctx context.Context) ([]*model.Coupon, error)
	GetCouponByCode(ctx context.Context, code string) (*model.Coupon, error)
	GetAdminReport(ctx context.Context, from time.Time, to time.Time, windowDays int) (*model.AdminReport, error)
	ListPopularProducts(ctx context.Context, limit int) ([]model.ProductPopularity, error)
	CreateAuditEntry(ctx context.Context, entry *model.AuditEntry) error
	ClaimPendingOutbox(ctx context.Context, limit int, leaseDuration time.Duration) ([]*model.OutboxMessage, error)
	MarkOutboxPublished(ctx context.Context, id string, publishedAt time.Time) error
	MarkOutboxFailed(ctx context.Context, id, lastError string, nextAvailableAt time.Time) error
	ExpirePendingReservation(
		ctx context.Context,
		orderID string,
		actorID, actorRole, message string,
		outbox *model.OutboxMessage,
	) (bool, error)
	ListExpiredPendingReservationOrderIDs(ctx context.Context, limit int) ([]string, error)
	ListCancelledOrdersPendingStockRelease(ctx context.Context, limit int) ([]string, error)
	MarkOrderStockReleased(ctx context.Context, orderID string) error
	ApplyInboxStatusTransition(
		ctx context.Context,
		inbox *model.InboxMessage,
		orderID string,
		expectedCurrent model.OrderStatus,
		nextStatus model.OrderStatus,
		actorID, actorRole, message string,
	) (*model.InboxTransitionResult, error)
}

type postgresOrderRepository struct {
	db *sql.DB
}

func NewOrderRepository(db *sql.DB) OrderRepository {
	return &postgresOrderRepository{db: db}
}
