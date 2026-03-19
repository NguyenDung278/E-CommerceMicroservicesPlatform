package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
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
	ErrOrderNotFound      = errors.New("order not found")
	ErrEmptyOrder         = errors.New("order must contain at least one item")
	ErrProductNotFound    = errors.New("product not found")
	ErrProductUnavailable = errors.New("product is unavailable")
	ErrInsufficientStock  = errors.New("insufficient stock")
)

// OrderEvent is published to RabbitMQ when an order is created.
// Other services (Payment, Notification) consume these events.
type OrderEvent struct {
	OrderID    string  `json:"order_id"`
	UserID     string  `json:"user_id"`
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

// CreateOrder processes a checkout.
//
// FLOW:
//  1. Validate items
//  2. Calculate total price
//  3. Create order in DB (with transaction)
//  4. Publish "order.created" event to RabbitMQ
//
// WHY EVENT-DRIVEN: Publishing an event after order creation decouples the
// Order Service from Payment and Notification services. They can process
// the event independently and at their own pace.
func (s *OrderService) CreateOrder(ctx context.Context, userID string, req dto.CreateOrderRequest) (*model.Order, error) {
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

	// Build order items and calculate total.
	var totalPrice float64
	for _, item := range req.Items {
		// IN PRODUCTION: fetch product details via gRPC to ensure price and stock are authentic.
		// For this demo, we check the product exists and use the real price.
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
		totalPrice += float64(product.Price) * float64(item.Quantity)
	}
	order.TotalPrice = totalPrice

	// Persist the order.
	if err := s.repo.Create(ctx, order); err != nil {
		return nil, err
	}

	// Publish event asynchronously.
	// DESIGN: We don't fail the order if event publishing fails.
	// In production, use an outbox pattern for guaranteed delivery.
	go s.publishOrderEvent(order)

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
	// Security: ensure users can only view their own orders.
	if order.UserID != userID {
		return nil, ErrOrderNotFound
	}
	return order, nil
}

func (s *OrderService) GetUserOrders(ctx context.Context, userID string) ([]*model.Order, error) {
	return s.repo.GetByUserID(ctx, userID)
}

func (s *OrderService) UpdateStatus(ctx context.Context, orderID string, status model.OrderStatus) error {
	order, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return err
	}
	if order == nil {
		return ErrOrderNotFound
	}
	return s.repo.UpdateStatus(ctx, orderID, status)
}

// publishOrderEvent publishes an order event to RabbitMQ.
func (s *OrderService) publishOrderEvent(order *model.Order) {
	if s.amqpCh == nil {
		s.log.Warn("RabbitMQ channel not available, skipping event publish")
		return
	}

	event := OrderEvent{
		OrderID:    order.ID,
		UserID:     order.UserID,
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

	err = s.amqpCh.PublishWithContext(ctx,
		"events",        // exchange
		"order.created", // routing key
		false,           // mandatory
		false,           // immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
			Timestamp:   time.Now(),
		},
	)
	if err != nil {
		s.log.Error("failed to publish order event", zap.Error(err))
		return
	}

	s.log.Info("published order event",
		zap.String("order_id", order.ID),
		zap.String("routing_key", "order.created"),
	)
}

// SetupExchange declares the RabbitMQ exchange and queue for order events.
func SetupExchange(ch *amqp.Channel) error {
	// Declare a topic exchange — allows routing by event type.
	err := ch.ExchangeDeclare(
		"events", // name
		"topic",  // type
		true,     // durable
		false,    // auto-deleted
		false,    // internal
		false,    // no-wait
		nil,      // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare exchange: %w", err)
	}
	return nil
}
