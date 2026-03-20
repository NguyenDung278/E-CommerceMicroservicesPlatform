package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/repository"
)

// PaymentEvent is published to RabbitMQ after payment processing.
type PaymentEvent struct {
	PaymentID string  `json:"payment_id"`
	OrderID   string  `json:"order_id"`
	UserID    string  `json:"user_id"`
	Amount    float64 `json:"amount"`
	Status    string  `json:"status"`
}

type PaymentService struct {
	repo        repository.PaymentRepository
	orderClient *client.OrderClient
	amqpCh      *amqp.Channel
	log         *zap.Logger
}

func NewPaymentService(repo repository.PaymentRepository, orderClient *client.OrderClient, amqpCh *amqp.Channel, log *zap.Logger) *PaymentService {
	return &PaymentService{repo: repo, orderClient: orderClient, amqpCh: amqpCh, log: log}
}

// ProcessPayment simulates payment processing.
//
// IN PRODUCTION: This would integrate with a payment gateway (Stripe, PayPal).
// The flow would be:
//  1. Create a payment intent with the gateway
//  2. Store payment record as "pending"
//  3. Receive webhook callback from gateway with result
//  4. Update status to "completed" or "failed"
//
// FOR THIS DEMO: We simulate instant success and publish an event.
func (s *PaymentService) ProcessPayment(ctx context.Context, userID, authHeader string, req dto.ProcessPaymentRequest) (*model.Payment, error) {
	// Check for duplicate payment.
	existing, err := s.repo.GetByOrderID(ctx, req.OrderID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrDuplicatePayment
	}

	order, err := s.orderClient.GetOrder(ctx, authHeader, req.OrderID)
	if err != nil {
		if errors.Is(err, client.ErrOrderNotFound) {
			return nil, ErrOrderNotFound
		}
		return nil, err
	}
	if order.UserID != userID {
		return nil, ErrOrderNotFound
	}

	now := time.Now()
	payment := &model.Payment{
		ID:            uuid.New().String(),
		OrderID:       req.OrderID,
		UserID:        userID,
		Amount:        order.TotalPrice,
		Status:        model.PaymentStatusCompleted, // Simulated success
		PaymentMethod: req.PaymentMethod,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := s.repo.Create(ctx, payment); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicatePayment
		}
		return nil, err
	}

	// Publish payment event.
	s.publishPaymentEvent(payment)

	return payment, nil
}

func (s *PaymentService) GetPayment(ctx context.Context, paymentID, userID string) (*model.Payment, error) {
	payment, err := s.repo.GetByIDForUser(ctx, paymentID, userID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, ErrPaymentNotFound
	}
	return payment, nil
}

func (s *PaymentService) GetPaymentByOrder(ctx context.Context, orderID, userID string) (*model.Payment, error) {
	payment, err := s.repo.GetByOrderIDForUser(ctx, orderID, userID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, ErrPaymentNotFound
	}
	return payment, nil
}

func (s *PaymentService) publishPaymentEvent(payment *model.Payment) {
	if s.amqpCh == nil {
		return
	}

	event := PaymentEvent{
		PaymentID: payment.ID,
		OrderID:   payment.OrderID,
		UserID:    payment.UserID,
		Amount:    payment.Amount,
		Status:    string(payment.Status),
	}

	body, err := json.Marshal(event)
	if err != nil {
		s.log.Error("failed to marshal payment event", zap.Error(err))
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	routingKey := "payment.completed"
	if payment.Status == model.PaymentStatusFailed {
		routingKey = "payment.failed"
	}

	for attempt := 0; attempt < 3; attempt++ {
		err = s.amqpCh.PublishWithContext(ctx,
			"events",   // exchange
			routingKey, // routing key
			false, false,
			amqp.Publishing{
				ContentType: "application/json",
				Body:        body,
				Timestamp:   time.Now(),
			},
		)
		if err == nil {
			s.log.Info("published payment event",
				zap.String("payment_id", payment.ID),
				zap.String("routing_key", routingKey),
			)
			return
		}

		time.Sleep(time.Duration(attempt+1) * 150 * time.Millisecond)
	}

	s.log.Error("failed to publish payment event", zap.Error(err))
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
