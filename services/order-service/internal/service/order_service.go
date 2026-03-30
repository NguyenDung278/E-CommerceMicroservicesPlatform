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

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/repository"
)

var (
	ErrOrderNotFound           = errors.New("order not found")
	ErrEmptyOrder              = errors.New("order must contain at least one item")
	ErrProductNotFound         = errors.New("product not found")
	ErrProductUnavailable      = errors.New("product is unavailable")
	ErrInsufficientStock       = errors.New("insufficient stock")
	ErrOrderNotCancellable     = errors.New("only pending orders can be cancelled")
	ErrAdminCancelNotAllowed   = errors.New("only pending or paid orders can be cancelled manually")
	ErrInvalidOrderStatus      = errors.New("invalid order status")
	ErrCouponAlreadyExists     = errors.New("coupon code already exists")
	ErrCouponNotFound          = repository.ErrCouponNotFound
	ErrCouponInactive          = repository.ErrCouponInactive
	ErrCouponExpired           = repository.ErrCouponExpired
	ErrCouponMinimumNotMet     = repository.ErrCouponMinimumNotMet
	ErrCouponUsageLimit        = repository.ErrCouponUsageLimitReached
	ErrInvalidShippingMethod   = errors.New("invalid shipping method")
	ErrShippingAddressRequired = errors.New("shipping address is required")
)

// OrderEvent is published to RabbitMQ when an order is created.
// Other services (Payment, Notification) consume these events.
type OrderEvent struct {
	OrderID    string  `json:"order_id"`
	UserID     string  `json:"user_id"`
	UserEmail  string  `json:"user_email"`
	TotalPrice float64 `json:"total_price"`
	Status     string  `json:"status"`
	RequestID  string  `json:"request_id,omitempty"`
}

type OrderService struct {
	repo          repository.OrderRepository
	amqpCh        *amqp.Channel
	log           *zap.Logger
	productClient productCatalog
}

type productCatalog interface {
	GetProduct(ctx context.Context, productID string) (*pb.Product, error)
	RestoreStock(ctx context.Context, productID string, quantity int) error
}

type pricedOrderItem struct {
	ProductID string
	Name      string
	Price     float64
	Quantity  int
}

type pricedOrderQuote struct {
	Items             []pricedOrderItem
	SubtotalPrice     float64
	DiscountAmount    float64
	CouponCode        string
	CouponDescription string
	ShippingMethod    string
	ShippingFee       float64
	TotalPrice        float64
}

func (q *pricedOrderQuote) ToPreview() *model.OrderPreview {
	return &model.OrderPreview{
		SubtotalPrice:     q.SubtotalPrice,
		DiscountAmount:    q.DiscountAmount,
		CouponCode:        q.CouponCode,
		CouponDescription: q.CouponDescription,
		ShippingMethod:    q.ShippingMethod,
		ShippingFee:       q.ShippingFee,
		TotalPrice:        q.TotalPrice,
	}
}

func NewOrderService(repo repository.OrderRepository, amqpCh *amqp.Channel, log *zap.Logger, productClient productCatalog) *OrderService {
	return &OrderService{
		repo:          repo,
		amqpCh:        amqpCh,
		log:           log,
		productClient: productClient,
	}
}

// CreateOrder orchestrates the process of turning a cart request into a real order.
//
// FLOW HOẠT ĐỘNG:
//  1. Tính giá quoteOrder: Lấy thông tin thật và giá từ product-service thông qua gRPC.
//  2. Kiểm tra tồn kho (StockQuantity).
//  3. Tạo struct Order (Domain Object) kết nối với UserID.
//  4. Persist xuống Database qua repo.Create (sử dụng DB Transaction).
//  5. Publish sự kiện "order.created" sang RabbitMQ cho Notification/Payment service.
func (s *OrderService) CreateOrder(ctx context.Context, userID, userEmail string, req dto.CreateOrderRequest) (*model.Order, error) {
	startedAt := time.Now()
	outcome := appobs.OutcomeSuccess
	requestLog := appobs.LoggerWithContext(s.log, ctx, zap.String("user_id", userID))
	defer func() {
		appobs.ObserveOperation("order-service", "create_order", outcome, time.Since(startedAt))
	}()

	quote, err := s.quoteOrder(ctx, req)
	if err != nil {
		outcome = appobs.OutcomeFromError(
			err,
			ErrEmptyOrder,
			ErrProductNotFound,
			ErrProductUnavailable,
			ErrInsufficientStock,
			ErrInvalidShippingMethod,
			ErrShippingAddressRequired,
			ErrCouponNotFound,
			ErrCouponInactive,
			ErrCouponExpired,
			ErrCouponMinimumNotMet,
			ErrCouponUsageLimit,
		)
		requestLog.Warn("create order failed during quote", zap.String("outcome", outcome), zap.Error(err))
		return nil, err
	}

	order := newOrderFromQuote(userID, req, quote, time.Now())

	if err := s.persistCreatedOrder(ctx, requestLog, order); err != nil {
		outcome = appobs.OutcomeFromError(
			err,
			ErrCouponNotFound,
			ErrCouponInactive,
			ErrCouponExpired,
			ErrCouponMinimumNotMet,
			ErrCouponUsageLimit,
		)
		return nil, err
	}

	requestLog.Info("order created",
		zap.String("order_id", order.ID),
		zap.Int("item_count", len(order.Items)),
		zap.Float64("subtotal_price", order.SubtotalPrice),
		zap.Float64("total_price", order.TotalPrice),
		zap.String("shipping_method", order.ShippingMethod),
	)

	s.publishOrderEvent(ctx, order, userEmail)

	return order, nil
}

func (s *OrderService) PreviewOrder(ctx context.Context, req dto.CreateOrderRequest) (*model.OrderPreview, error) {
	quote, err := s.quoteOrder(ctx, req)
	if err != nil {
		return nil, err
	}

	return quote.ToPreview(), nil
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
	if !isOperatorRole(actorRole) && order.UserID != actorID {
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

	if err := s.repo.UpdateStatus(ctx, orderID, status, actorID, actorRole, message); err != nil {
		appobs.RecordStateTransition("order-service", "order", string(order.Status), string(status), appobs.OutcomeSystemError)
		appobs.LoggerWithContext(s.log, ctx,
			zap.String("order_id", orderID),
			zap.String("actor_id", actorID),
			zap.String("actor_role", actorRole),
			zap.String("from_status", string(order.Status)),
			zap.String("to_status", string(status)),
		).Error("failed to update order status", zap.Error(err))
		return err
	}

	appobs.RecordStateTransition("order-service", "order", string(order.Status), string(status), appobs.OutcomeSuccess)
	appobs.LoggerWithContext(s.log, ctx,
		zap.String("order_id", orderID),
		zap.String("actor_id", actorID),
		zap.String("actor_role", actorRole),
		zap.String("from_status", string(order.Status)),
		zap.String("to_status", string(status)),
	).Info("order status updated")

	return nil
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

	return s.cancelOrderWithActor(ctx, order, userID, "user", "Order cancelled by user")
}

func (s *OrderService) CancelOrderAsAdmin(ctx context.Context, orderID, actorID, actorRole, message string) error {
	order, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return err
	}
	if order == nil {
		return ErrOrderNotFound
	}

	switch order.Status {
	case model.OrderStatusPending, model.OrderStatusPaid:
	default:
		return ErrAdminCancelNotAllowed
	}

	if strings.TrimSpace(message) == "" {
		message = "Order cancelled manually by staff"
	}

	return s.cancelOrderWithActor(ctx, order, actorID, actorRole, message)
}

// publishCancelEvent publishes an order.cancelled event to RabbitMQ.
func (s *OrderService) publishCancelEvent(ctx context.Context, order *model.Order) {
	if s.amqpCh == nil {
		s.log.Warn("RabbitMQ channel not available, skipping cancel event publish")
		return
	}
	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("order_id", order.ID),
		zap.String("routing_key", "order.cancelled"),
	)

	event := OrderEvent{
		OrderID:    order.ID,
		UserID:     order.UserID,
		TotalPrice: order.TotalPrice,
		Status:     string(model.OrderStatusCancelled),
		RequestID:  appobs.RequestIDFromContext(ctx),
	}

	body, err := json.Marshal(event)
	if err != nil {
		appobs.ObserveOperation("order-service", "publish_order_cancel_event", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("failed to marshal cancel event", zap.Error(err))
		return
	}

	publishCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	for attempt := 0; attempt < 3; attempt++ {
		err = s.amqpCh.PublishWithContext(publishCtx,
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
			appobs.ObserveOperation("order-service", "publish_order_cancel_event", appobs.OutcomeSuccess, time.Since(startedAt))
			requestLog.Info("published order cancel event")
			return
		}
		time.Sleep(time.Duration(attempt+1) * 150 * time.Millisecond)
	}

	appobs.ObserveOperation("order-service", "publish_order_cancel_event", appobs.OutcomeSystemError, time.Since(startedAt))
	requestLog.Error("failed to publish order cancel event", zap.Error(err))
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

func (s *OrderService) ListPopularProducts(ctx context.Context, limit int) ([]model.ProductPopularity, error) {
	return s.repo.ListPopularProducts(ctx, limit)
}

func (s *OrderService) quoteOrder(ctx context.Context, req dto.CreateOrderRequest) (*pricedOrderQuote, error) {
	shippingMethod, err := validateOrderRequest(req)
	if err != nil {
		return nil, err
	}

	quote := &pricedOrderQuote{
		Items:          make([]pricedOrderItem, 0, len(req.Items)),
		ShippingMethod: shippingMethod,
	}

	var subtotal float64
	for _, item := range req.Items {
		quotedItem, err := s.quoteOrderItem(ctx, item)
		if err != nil {
			return nil, err
		}

		quote.Items = append(quote.Items, quotedItem)
		subtotal += quotedItem.Price * float64(quotedItem.Quantity)
	}

	quote.SubtotalPrice = roundCurrency(subtotal)
	quote.ShippingFee = calculateShippingFee(shippingMethod, quote.SubtotalPrice)
	quote.TotalPrice = roundCurrency(quote.SubtotalPrice + quote.ShippingFee)

	if strings.TrimSpace(req.CouponCode) == "" {
		return quote, nil
	}

	coupon, err := s.validateCoupon(ctx, req.CouponCode, quote.SubtotalPrice)
	if err != nil {
		return nil, err
	}

	applyCouponToQuote(quote, coupon)

	return quote, nil
}

func (s *OrderService) validateCoupon(ctx context.Context, code string, subtotal float64) (*model.Coupon, error) {
	coupon, err := s.repo.GetCouponByCode(ctx, normalizeCouponCode(code))
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
	if coupon.MinOrderAmount > subtotal {
		return nil, ErrCouponMinimumNotMet
	}
	if coupon.UsageLimit > 0 && coupon.UsedCount >= coupon.UsageLimit {
		return nil, ErrCouponUsageLimit
	}

	return coupon, nil
}

// publishOrderEvent publishes an order event to RabbitMQ.
func (s *OrderService) publishOrderEvent(ctx context.Context, order *model.Order, userEmail string) {
	if s.amqpCh == nil {
		s.log.Warn("RabbitMQ channel not available, skipping event publish")
		return
	}
	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("order_id", order.ID),
		zap.String("routing_key", "order.created"),
	)

	event := OrderEvent{
		OrderID:    order.ID,
		UserID:     order.UserID,
		UserEmail:  userEmail,
		TotalPrice: order.TotalPrice,
		Status:     string(order.Status),
		RequestID:  appobs.RequestIDFromContext(ctx),
	}

	body, err := json.Marshal(event)
	if err != nil {
		appobs.ObserveOperation("order-service", "publish_order_created_event", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("failed to marshal order event", zap.Error(err))
		return
	}

	publishCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	for attempt := 0; attempt < 3; attempt++ {
		err = s.amqpCh.PublishWithContext(publishCtx,
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
			appobs.ObserveOperation("order-service", "publish_order_created_event", appobs.OutcomeSuccess, time.Since(startedAt))
			requestLog.Info("published order event")
			return
		}

		time.Sleep(time.Duration(attempt+1) * 150 * time.Millisecond)
	}

	appobs.ObserveOperation("order-service", "publish_order_created_event", appobs.OutcomeSystemError, time.Since(startedAt))
	requestLog.Error("failed to publish order event", zap.Error(err))
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

func normalizeShippingMethod(value string) (string, error) {
	method := strings.ToLower(strings.TrimSpace(value))
	if method == "" {
		return string(model.ShippingMethodStandard), nil
	}

	switch model.ShippingMethod(method) {
	case model.ShippingMethodStandard, model.ShippingMethodExpress, model.ShippingMethodPickup:
		return method, nil
	default:
		return "", ErrInvalidShippingMethod
	}
}

func normalizeShippingAddress(address *dto.ShippingAddressRequest) *model.ShippingAddress {
	if address == nil {
		return nil
	}

	normalized := &model.ShippingAddress{
		RecipientName: strings.TrimSpace(address.RecipientName),
		Phone:         strings.TrimSpace(address.Phone),
		Street:        strings.TrimSpace(address.Street),
		Ward:          strings.TrimSpace(address.Ward),
		District:      strings.TrimSpace(address.District),
		City:          strings.TrimSpace(address.City),
	}

	if normalized.RecipientName == "" || normalized.Phone == "" || normalized.Street == "" || normalized.District == "" || normalized.City == "" {
		return nil
	}

	return normalized
}

func calculateShippingFee(method string, subtotal float64) float64 {
	switch model.ShippingMethod(method) {
	case model.ShippingMethodPickup:
		return 0
	case model.ShippingMethodExpress:
		return 14.99
	default:
		if subtotal >= 100 {
			return 0
		}
		return 5.99
	}
}

func normalizeCouponCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func roundCurrency(value float64) float64 {
	return math.Round(value*100) / 100
}

func (s *OrderService) cancelOrderWithActor(ctx context.Context, order *model.Order, actorID, actorRole, message string) error {
	previousStatus := order.Status
	if err := s.markOrderCancelled(ctx, order, actorID, actorRole, message); err != nil {
		appobs.RecordStateTransition("order-service", "order", string(previousStatus), string(model.OrderStatusCancelled), appobs.OutcomeSystemError)
		return err
	}
	appobs.RecordStateTransition("order-service", "order", string(previousStatus), string(model.OrderStatusCancelled), appobs.OutcomeSuccess)
	appobs.LoggerWithContext(s.log, ctx,
		zap.String("order_id", order.ID),
		zap.String("actor_id", actorID),
		zap.String("actor_role", actorRole),
		zap.String("from_status", string(previousStatus)),
		zap.String("to_status", string(model.OrderStatusCancelled)),
	).Info("order cancelled")

	s.recordAuditEntry(ctx, &model.AuditEntry{
		ID:         uuid.New().String(),
		EntityType: "order",
		EntityID:   order.ID,
		Action:     "order.cancelled",
		ActorID:    actorID,
		ActorRole:  actorRole,
		Metadata: map[string]any{
			"previous_status": previousStatus,
			"current_status":  model.OrderStatusCancelled,
			"user_id":         order.UserID,
			"total_price":     order.TotalPrice,
			"message":         message,
		},
		CreatedAt: time.Now(),
	})

	s.restoreCancelledOrderStock(ctx, order)

	s.publishCancelEvent(ctx, order)
	return nil
}

func newOrderFromQuote(userID string, req dto.CreateOrderRequest, quote *pricedOrderQuote, now time.Time) *model.Order {
	orderID := uuid.New().String()

	return &model.Order{
		ID:              orderID,
		UserID:          userID,
		Status:          model.OrderStatusPending,
		Items:           buildOrderItems(orderID, quote.Items),
		CouponCode:      quote.CouponCode,
		SubtotalPrice:   quote.SubtotalPrice,
		DiscountAmount:  quote.DiscountAmount,
		ShippingMethod:  quote.ShippingMethod,
		ShippingFee:     quote.ShippingFee,
		ShippingAddress: normalizeShippingAddress(req.ShippingAddress),
		TotalPrice:      quote.TotalPrice,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
}

func buildOrderItems(orderID string, items []pricedOrderItem) []model.OrderItem {
	orderItems := make([]model.OrderItem, 0, len(items))
	for _, item := range items {
		orderItems = append(orderItems, model.OrderItem{
			ID:        uuid.New().String(),
			OrderID:   orderID,
			ProductID: item.ProductID,
			Name:      item.Name,
			Price:     item.Price,
			Quantity:  item.Quantity,
		})
	}

	return orderItems
}

func (s *OrderService) persistCreatedOrder(ctx context.Context, requestLog *zap.Logger, order *model.Order) error {
	if err := s.repo.Create(ctx, order); err != nil {
		logCreateOrderPersistenceError(requestLog, order, err)
		return err
	}

	return nil
}

func logCreateOrderPersistenceError(requestLog *zap.Logger, order *model.Order, err error) {
	if isCouponError(err) {
		requestLog.Warn("create order failed while persisting business state",
			zap.String("order_id", order.ID),
			zap.String("coupon_code", order.CouponCode),
			zap.Error(err),
		)
		return
	}

	requestLog.Error("create order failed while persisting order",
		zap.String("order_id", order.ID),
		zap.Error(err),
	)
}

func validateOrderRequest(req dto.CreateOrderRequest) (string, error) {
	if len(req.Items) == 0 {
		return "", ErrEmptyOrder
	}

	shippingMethod, err := normalizeShippingMethod(req.ShippingMethod)
	if err != nil {
		return "", err
	}
	if shippingMethod != string(model.ShippingMethodPickup) && normalizeShippingAddress(req.ShippingAddress) == nil {
		return "", ErrShippingAddressRequired
	}

	return shippingMethod, nil
}

// quoteOrderItem keeps product lookup and stock validation in one place so
// CreateOrder and PreviewOrder share exactly the same pricing rules.
func (s *OrderService) quoteOrderItem(ctx context.Context, item dto.OrderItemRequest) (pricedOrderItem, error) {
	product, err := s.productClient.GetProduct(ctx, item.ProductID)
	if err != nil {
		switch grpcstatus.Code(err) {
		case codes.NotFound:
			return pricedOrderItem{}, fmt.Errorf("%w: %s", ErrProductNotFound, item.ProductID)
		case codes.InvalidArgument:
			return pricedOrderItem{}, fmt.Errorf("%w: %s", ErrProductUnavailable, item.ProductID)
		default:
			return pricedOrderItem{}, fmt.Errorf("failed to fetch product %s: %w", item.ProductID, err)
		}
	}

	if product.StockQuantity < int32(item.Quantity) {
		return pricedOrderItem{}, fmt.Errorf(
			"%w: product %s only has %d item(s)",
			ErrInsufficientStock,
			product.Name,
			product.StockQuantity,
		)
	}

	return pricedOrderItem{
		ProductID: item.ProductID,
		Name:      product.Name,
		Price:     float64(product.Price),
		Quantity:  item.Quantity,
	}, nil
}

func applyCouponToQuote(quote *pricedOrderQuote, coupon *model.Coupon) {
	quote.CouponCode = coupon.Code
	quote.CouponDescription = strings.TrimSpace(coupon.Description)
	quote.DiscountAmount = roundCurrency(calculateDiscount(coupon, quote.SubtotalPrice))
	quote.TotalPrice = roundCurrency(quote.SubtotalPrice - quote.DiscountAmount + quote.ShippingFee)
}

func isCouponError(err error) bool {
	return errors.Is(err, repository.ErrCouponNotFound) ||
		errors.Is(err, repository.ErrCouponInactive) ||
		errors.Is(err, repository.ErrCouponExpired) ||
		errors.Is(err, repository.ErrCouponMinimumNotMet) ||
		errors.Is(err, repository.ErrCouponUsageLimitReached)
}

func (s *OrderService) markOrderCancelled(ctx context.Context, order *model.Order, actorID, actorRole, message string) error {
	return s.repo.UpdateStatus(ctx, order.ID, model.OrderStatusCancelled, actorID, actorRole, message)
}

func (s *OrderService) restoreCancelledOrderStock(ctx context.Context, order *model.Order) {
	for _, item := range order.Items {
		stockRestoreStartedAt := time.Now()
		if err := s.productClient.RestoreStock(ctx, item.ProductID, item.Quantity); err != nil {
			appobs.ObserveOperation("order-service", "restore_stock", appobs.OutcomeSystemError, time.Since(stockRestoreStartedAt))
			s.log.Error("failed to restore stock for product",
				zap.String("product_id", item.ProductID),
				zap.String("order_id", order.ID),
				zap.Int("quantity", item.Quantity),
				zap.String("user_id", order.UserID),
				zap.Error(err),
			)
			continue
		}
		appobs.ObserveOperation("order-service", "restore_stock", appobs.OutcomeSuccess, time.Since(stockRestoreStartedAt))
	}
}

func (s *OrderService) recordAuditEntry(ctx context.Context, entry *model.AuditEntry) {
	if entry == nil {
		return
	}

	if err := s.repo.CreateAuditEntry(ctx, entry); err != nil {
		s.log.Warn("failed to persist audit entry",
			zap.String("entity_type", entry.EntityType),
			zap.String("entity_id", entry.EntityID),
			zap.String("action", entry.Action),
			zap.Error(err),
		)
	}
}

func isOperatorRole(role string) bool {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "admin", "staff":
		return true
	default:
		return false
	}
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
