package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/grpc_client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/repository"
)

var (
	ErrOrderNotFound       = errors.New("order not found")
	ErrEmptyOrder          = errors.New("order must contain at least one item")
	ErrProductNotFound     = errors.New("product not found")
	ErrProductUnavailable  = errors.New("product is unavailable")
	ErrInsufficientStock   = errors.New("insufficient stock")
	ErrOrderNotCancellable = errors.New("only pending orders can be cancelled")
	ErrInvalidOrderStatus  = errors.New("invalid order status")
	ErrCouponAlreadyExists = errors.New("coupon code already exists")
	ErrCouponNotFound      = repository.ErrCouponNotFound
	ErrCouponInactive      = repository.ErrCouponInactive
	ErrCouponExpired       = repository.ErrCouponExpired
	ErrCouponMinimumNotMet = repository.ErrCouponMinimumNotMet
	ErrCouponUsageLimit    = repository.ErrCouponUsageLimitReached
)

// OrderEvent is published to RabbitMQ when an order is created.
// Other services (Payment, Notification) consume these events.
type OrderEvent struct {
	OrderID    string  `json:"order_id"`
	UserID     string  `json:"user_id"`
	UserEmail  string  `json:"user_email"`
	TotalPrice float64 `json:"total_price"`
	Status     string  `json:"status"`
}

type OrderService struct {
	repo          repository.OrderRepository
	amqpCh        *amqp.Channel
	log           *zap.Logger
	productClient *grpc_client.ProductClient
}

func NewOrderService(repo repository.OrderRepository, amqpCh *amqp.Channel, log *zap.Logger, productClient *grpc_client.ProductClient) *OrderService {
	return &OrderService{
		repo:          repo,
		amqpCh:        amqpCh,
		log:           log,
		productClient: productClient,
	}
}

func (s *OrderService) CreateOrder(ctx context.Context, userID, userEmail string, req dto.CreateOrderRequest) (*model.Order, error) {
	if len(req.Items) == 0 {
		return nil, ErrEmptyOrder
	}

	now := time.Now()
	order := &model.Order{
		ID:        uuid.New().String(),
		UserID:    userID,
		Status:    model.OrderStatusPending,
		CreatedAt: now,
		UpdatedAt: now,
	}

	var subtotal float64
	for _, item := range req.Items {
		product, err := s.productClient.GetProduct(ctx, item.ProductID)
		if err != nil {
			switch grpcstatus.Code(err) {
			case codes.NotFound:
				return nil, fmt.Errorf("%w: %s", ErrProductNotFound, item.ProductID)
			case codes.InvalidArgument:
				return nil, fmt.Errorf("%w: %s", ErrProductUnavailable, item.ProductID)
			default:
				return nil, fmt.Errorf("failed to fetch product %s: %w", item.ProductID, err)
			}
		}

		if product.StockQuantity < int32(item.Quantity) {
			return nil, fmt.Errorf("%w: product %s only has %d item(s)",
				ErrInsufficientStock, product.Name, product.StockQuantity)
		}

		orderItem := model.OrderItem{
			ID:        uuid.New().String(),
			OrderID:   order.ID,
			ProductID: item.ProductID,
			Name:      product.Name,
			Price:     float64(product.Price),
			Quantity:  item.Quantity,
		}
		order.Items = append(order.Items, orderItem)
		subtotal += float64(product.Price) * float64(item.Quantity)
	}

	order.SubtotalPrice = roundCurrency(subtotal)
	order.TotalPrice = order.SubtotalPrice

	if req.CouponCode != "" {
		coupon, err := s.repo.GetCouponByCode(ctx, normalizeCouponCode(req.CouponCode))
		if err != nil {
			return nil, err
		}
		if coupon == nil {
			return nil, ErrCouponNotFound
		}
		if !coupon.Active {
			return nil, ErrCouponInactive
		}
		if coupon.ExpiresAt != nil && time.Now().After(*coupon.ExpiresAt) {
			return nil, ErrCouponExpired
		}
		if coupon.MinOrderAmount > order.SubtotalPrice {
			return nil, ErrCouponMinimumNotMet
		}
		if coupon.UsageLimit > 0 && coupon.UsedCount >= coupon.UsageLimit {
			return nil, ErrCouponUsageLimit
		}

		order.CouponCode = coupon.Code
		order.DiscountAmount = roundCurrency(calculateDiscount(coupon, order.SubtotalPrice))
		order.TotalPrice = roundCurrency(order.SubtotalPrice - order.DiscountAmount)
	}

	if err := s.repo.Create(ctx, order); err != nil {
		if errors.Is(err, repository.ErrCouponNotFound) ||
			errors.Is(err, repository.ErrCouponInactive) ||
			errors.Is(err, repository.ErrCouponExpired) ||
			errors.Is(err, repository.ErrCouponMinimumNotMet) ||
			errors.Is(err, repository.ErrCouponUsageLimitReached) {
			return nil, err
		}
		return nil, err
	}

	s.publishOrderEvent(order, userEmail)

	return order, nil
}

func (s *OrderService) GetOrder(ctx context.Context, orderID, userID string) (*model.Order, error) {
	order, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, ErrOrderNotFound
	}
	if order.UserID != userID {
		return nil, ErrOrderNotFound
	}
	return order, nil
}

func (s *OrderService) GetOrderForAdmin(ctx context.Context, orderID string) (*model.Order, error) {
	order, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, ErrOrderNotFound
	}
	return order, nil
}

func (s *OrderService) GetUserOrders(ctx context.Context, userID string) ([]*model.Order, error) {
	return s.repo.GetByUserID(ctx, userID)
}

func (s *OrderService) ListAdminOrders(ctx context.Context, filters model.OrderFilters) ([]*model.Order, int64, error) {
	return s.repo.ListAll(ctx, filters)
}

func (s *OrderService) GetOrderTimeline(ctx context.Context, orderID, actorID, actorRole string) ([]*model.OrderEvent, error) {
	order, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, ErrOrderNotFound
	}
	if !strings.EqualFold(actorRole, "admin") && order.UserID != actorID {
		return nil, ErrOrderNotFound
	}
	return s.repo.GetEventsByOrderID(ctx, orderID)
}

func (s *OrderService) UpdateStatus(ctx context.Context, orderID string, status model.OrderStatus, actorID, actorRole, message string) error {
	if !isValidOrderStatus(status) {
		return ErrInvalidOrderStatus
	}

	order, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return err
	}
	if order == nil {
		return ErrOrderNotFound
	}
	if order.Status == status {
		return nil
	}

	return s.repo.UpdateStatus(ctx, orderID, status, actorID, actorRole, message)
}

// CancelOrder cancels a pending order and restores stock for all items.
//
// BUSINESS RULE: Only orders in "pending" status can be cancelled by the user.
// Paid, shipped, or delivered orders require admin intervention.
//
// FLOW:
//  1. Validate order exists and belongs to user
//  2. Check status is "pending"
//  3. Update status to "cancelled"
//  4. Restore stock for each item via product-service gRPC
//  5. Publish "order.cancelled" event
func (s *OrderService) CancelOrder(ctx context.Context, orderID, userID string) error {
	order, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return err
	}
	if order == nil || order.UserID != userID {
		return ErrOrderNotFound
	}

	// Only pending orders can be cancelled by the user.
	if order.Status != model.OrderStatusPending {
		return ErrOrderNotCancellable
	}

	// Update status to cancelled.
	if err := s.repo.UpdateStatus(ctx, orderID, model.OrderStatusCancelled, userID, "user", "Order cancelled by user"); err != nil {
		return err
	}

	// Restore stock for each item.
	for _, item := range order.Items {
		if err := s.productClient.RestoreStock(ctx, item.ProductID, item.Quantity); err != nil {
			// Log the error but don't fail the cancellation — stock restore is best-effort.
			// An out-of-band reconciliation job can fix discrepancies.
			s.log.Error("failed to restore stock for product",
				zap.String("product_id", item.ProductID),
				zap.Int("quantity", item.Quantity),
				zap.Error(err),
			)
		}
	}

	// Publish cancellation event.
	s.publishCancelEvent(order)

	return nil
}

// publishCancelEvent publishes an order.cancelled event to RabbitMQ.
func (s *OrderService) publishCancelEvent(order *model.Order) {
	if s.amqpCh == nil {
		s.log.Warn("RabbitMQ channel not available, skipping cancel event publish")
		return
	}

	event := OrderEvent{
		OrderID:    order.ID,
		UserID:     order.UserID,
		TotalPrice: order.TotalPrice,
		Status:     string(model.OrderStatusCancelled),
	}

	body, err := json.Marshal(event)
	if err != nil {
		s.log.Error("failed to marshal cancel event", zap.Error(err))
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for attempt := 0; attempt < 3; attempt++ {
		err = s.amqpCh.PublishWithContext(ctx,
			"events",          // exchange
			"order.cancelled", // routing key
			false, false,
			amqp.Publishing{
				ContentType: "application/json",
				Body:        body,
				Timestamp:   time.Now(),
			},
		)
		if err == nil {
			s.log.Info("published order cancel event",
				zap.String("order_id", order.ID),
				zap.String("routing_key", "order.cancelled"),
			)
			return
		}
		time.Sleep(time.Duration(attempt+1) * 150 * time.Millisecond)
	}

	s.log.Error("failed to publish order cancel event", zap.Error(err))
}

func (s *OrderService) CreateCoupon(ctx context.Context, req dto.CreateCouponRequest) (*model.Coupon, error) {
	now := time.Now()
	active := true
	if req.Active != nil {
		active = *req.Active
	}

	coupon := &model.Coupon{
		ID:             uuid.New().String(),
		Code:           normalizeCouponCode(req.Code),
		Description:    strings.TrimSpace(req.Description),
		DiscountType:   model.CouponDiscountType(req.DiscountType),
		DiscountValue:  roundCurrency(req.DiscountValue),
		MinOrderAmount: roundCurrency(req.MinOrderAmount),
		UsageLimit:     req.UsageLimit,
		UsedCount:      0,
		Active:         active,
		ExpiresAt:      req.ExpiresAt,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := s.repo.CreateCoupon(ctx, coupon); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrCouponAlreadyExists
		}
		return nil, err
	}

	return coupon, nil
}

func (s *OrderService) ListCoupons(ctx context.Context) ([]*model.Coupon, error) {
	return s.repo.ListCoupons(ctx)
}

func (s *OrderService) GetAdminReport(ctx context.Context, windowDays int) (*model.AdminReport, error) {
	if windowDays <= 0 || windowDays > 365 {
		windowDays = 30
	}

	now := time.Now()
	from := now.AddDate(0, 0, -windowDays)

	return s.repo.GetAdminReport(ctx, from, now, windowDays)
}

// publishOrderEvent publishes an order event to RabbitMQ.
func (s *OrderService) publishOrderEvent(order *model.Order, userEmail string) {
	if s.amqpCh == nil {
		s.log.Warn("RabbitMQ channel not available, skipping event publish")
		return
	}

	event := OrderEvent{
		OrderID:    order.ID,
		UserID:     order.UserID,
		UserEmail:  userEmail,
		TotalPrice: order.TotalPrice,
		Status:     string(order.Status),
	}

	body, err := json.Marshal(event)
	if err != nil {
		s.log.Error("failed to marshal order event", zap.Error(err))
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for attempt := 0; attempt < 3; attempt++ {
		err = s.amqpCh.PublishWithContext(ctx,
			"events",
			"order.created",
			false,
			false,
			amqp.Publishing{
				ContentType: "application/json",
				Body:        body,
				Timestamp:   time.Now(),
			},
		)
		if err == nil {
			s.log.Info("published order event",
				zap.String("order_id", order.ID),
				zap.String("routing_key", "order.created"),
			)
			return
		}

		time.Sleep(time.Duration(attempt+1) * 150 * time.Millisecond)
	}

	s.log.Error("failed to publish order event", zap.Error(err))
}

// SetupExchange declares the RabbitMQ exchange and queue for order events.
func SetupExchange(ch *amqp.Channel) error {
	err := ch.ExchangeDeclare(
		"events",
		"topic",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to declare exchange: %w", err)
	}
	return nil
}

func calculateDiscount(coupon *model.Coupon, subtotal float64) float64 {
	switch coupon.DiscountType {
	case model.CouponDiscountTypePercentage:
		return math.Min(subtotal, subtotal*(coupon.DiscountValue/100))
	case model.CouponDiscountTypeFixed:
		return math.Min(subtotal, coupon.DiscountValue)
	default:
		return 0
	}
}

func normalizeCouponCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func roundCurrency(value float64) float64 {
	return math.Round(value*100) / 100
}

func isValidOrderStatus(status model.OrderStatus) bool {
	switch status {
	case model.OrderStatusPending,
		model.OrderStatusPaid,
		model.OrderStatusShipped,
		model.OrderStatusDelivered,
		model.OrderStatusCancelled,
		model.OrderStatusRefunded:
		return true
	default:
		return false
	}
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
