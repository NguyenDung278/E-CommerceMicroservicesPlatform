package service

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

func (s *OrderService) CreateReturn(ctx context.Context, orderID, userID, userEmail string, req dto.CreateReturnRequest) (*model.ReturnRequest, error) {
	order, err := s.loadOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.UserID != userID {
		return nil, ErrOrderNotFound
	}
	if !isReturnableOrderStatus(order.Status) {
		return nil, ErrReturnNotAllowed
	}

	existingReturns, err := s.repo.ListReturnsByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	returnID := uuid.New().String()
	items, err := buildReturnItems(returnID, order, existingReturns, req.Items, now)
	if err != nil {
		return nil, err
	}

	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		return nil, ErrReturnReasonRequired
	}

	returnRequest := &model.ReturnRequest{
		ID:        returnID,
		OrderID:   order.ID,
		UserID:    userID,
		UserEmail: strings.TrimSpace(userEmail),
		Status:    model.ReturnStatusRequested,
		Reason:    reason,
		Items:     items,
		Events: []model.ReturnEvent{
			{
				ID:        uuid.New().String(),
				ReturnID:  returnID,
				Status:    model.ReturnStatusRequested,
				ActorID:   userID,
				ActorRole: "user",
				Message:   "return requested",
				CreatedAt: now,
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	outbox, err := buildReturnOutboxMessage(ctx, returnRequest, returnRequest.Status, 0)
	if err != nil {
		return nil, err
	}

	if err := s.repo.CreateReturn(ctx, returnRequest, outbox); err != nil {
		return nil, err
	}

	return returnRequest, nil
}

func (s *OrderService) GetReturn(ctx context.Context, returnID, actorID, actorRole string) (*model.ReturnRequest, error) {
	returnRequest, err := s.loadReturnByID(ctx, returnID)
	if err != nil {
		return nil, err
	}
	if !isOperatorRole(actorRole) && returnRequest.UserID != actorID {
		return nil, ErrReturnNotFound
	}

	return returnRequest, nil
}

func (s *OrderService) ListReturnsByOrder(ctx context.Context, orderID, actorID, actorRole string) ([]*model.ReturnRequest, error) {
	order, err := s.loadOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if !isOperatorRole(actorRole) && order.UserID != actorID {
		return nil, ErrOrderNotFound
	}

	return s.repo.ListReturnsByOrderID(ctx, orderID)
}

// ListUserReturns returns the paginated returns list scoped to one user.
func (s *OrderService) ListUserReturns(ctx context.Context, userID string, filters model.ReturnFilters) ([]*model.ReturnRequest, int64, error) {
	if filters.Page <= 0 {
		filters.Page = 1
	}
	if filters.Limit <= 0 {
		filters.Limit = 10
	}
	if filters.Limit > 30 {
		filters.Limit = 30
	}
	filters.UserID = strings.TrimSpace(userID)

	return s.repo.ListReturns(ctx, filters)
}

// ListAdminReturns returns the paginated returns list without user scoping for
// operator dashboards.
func (s *OrderService) ListAdminReturns(ctx context.Context, filters model.ReturnFilters) ([]*model.ReturnRequest, int64, error) {
	if filters.Page <= 0 {
		filters.Page = 1
	}
	if filters.Limit <= 0 {
		filters.Limit = 10
	}
	if filters.Limit > 50 {
		filters.Limit = 50
	}

	return s.repo.ListReturns(ctx, filters)
}

// GetReturnQueueHealth loads the current refund_pending queue health snapshot
// for admin monitoring surfaces.
func (s *OrderService) GetReturnQueueHealth(ctx context.Context) (*model.ReturnQueueHealth, error) {
	health, err := s.repo.GetReturnQueueHealth(ctx)
	if err != nil {
		return nil, err
	}
	recordReturnRefundQueueHealth(health, time.Now())
	return health, nil
}

func (s *OrderService) UpdateReturnStatus(ctx context.Context, returnID string, status model.ReturnStatus, actorID, actorRole, message string) error {
	if !isValidReturnStatus(status) {
		return ErrInvalidReturnStatus
	}

	returnRequest, err := s.loadReturnByID(ctx, returnID)
	if err != nil {
		return err
	}
	if returnRequest.Status == status {
		return nil
	}
	if !canTransitionReturnStatus(returnRequest.Status, status) {
		return ErrReturnStatusTransition
	}

	if strings.TrimSpace(message) == "" {
		message = "return status updated"
	}

	updatedReturn := *returnRequest
	updatedReturn.Status = status
	updatedReturn.UpdatedAt = time.Now()
	outbox, err := buildReturnOutboxMessage(ctx, &updatedReturn, status, updatedReturn.RefundAmount)
	if err != nil {
		return err
	}

	return s.repo.UpdateReturnStatus(ctx, returnID, status, actorID, actorRole, message, outbox)
}

// RequestReturnRefund schedules an asynchronous refund for an approved or
// received return. The external refund call is deferred to the background
// worker so this API only needs one local transaction to persist the new state.
func (s *OrderService) RequestReturnRefund(ctx context.Context, returnID, actorID, actorRole, message string) error {
	returnRequest, err := s.loadReturnByID(ctx, returnID)
	if err != nil {
		return err
	}
	if returnRequest.Status == model.ReturnStatusRefunded {
		return nil
	}
	if returnRequest.Status == model.ReturnStatusRefundPending && returnRequest.RefundProcessingStarted != nil {
		return ErrReturnRefundPending
	}
	if !canQueueReturnRefund(returnRequest.Status) {
		return ErrReturnStatusTransition
	}

	scheduledReturn, err := s.prepareReturnRefund(ctx, returnRequest)
	if err != nil {
		return err
	}
	if strings.TrimSpace(message) == "" {
		if returnRequest.Status == model.ReturnStatusRefundPending {
			message = "refund retry queued"
		} else {
			message = "refund queued for asynchronous processing"
		}
	}

	outbox, err := buildReturnOutboxMessage(
		ctx,
		scheduledReturn,
		model.ReturnStatusRefundPending,
		scheduledReturn.RefundAmount,
	)
	if err != nil {
		return err
	}

	return s.repo.ScheduleReturnRefund(ctx, scheduledReturn, actorID, actorRole, message, outbox)
}

func buildReturnItems(
	returnID string,
	order *model.Order,
	existingReturns []*model.ReturnRequest,
	reqItems []dto.ReturnItemRequest,
	now time.Time,
) ([]model.ReturnItem, error) {
	if len(reqItems) == 0 {
		return nil, ErrReturnItemsRequired
	}

	orderItemsByID := make(map[string]model.OrderItem, len(order.Items))
	for _, item := range order.Items {
		orderItemsByID[item.ID] = item
	}
	alreadyReturned := aggregateReturnedQuantities(existingReturns)

	items := make([]model.ReturnItem, 0, len(reqItems))
	seen := make(map[string]struct{}, len(reqItems))
	for _, reqItem := range reqItems {
		orderItemID := strings.TrimSpace(reqItem.OrderItemID)
		if orderItemID == "" {
			return nil, ErrReturnOrderItemNotFound
		}
		if _, exists := seen[orderItemID]; exists {
			return nil, ErrDuplicateReturnItem
		}
		seen[orderItemID] = struct{}{}

		orderItem, ok := orderItemsByID[orderItemID]
		if !ok {
			return nil, ErrReturnOrderItemNotFound
		}
		availableQuantity := orderItem.Quantity - alreadyReturned[orderItemID]
		if reqItem.Quantity <= 0 || reqItem.Quantity > availableQuantity {
			return nil, ErrReturnQuantityExceeded
		}

		items = append(items, model.ReturnItem{
			ID:          uuid.New().String(),
			ReturnID:    returnID,
			OrderItemID: orderItem.ID,
			ProductID:   orderItem.ProductID,
			Quantity:    reqItem.Quantity,
			Reason:      strings.TrimSpace(reqItem.Reason),
			CreatedAt:   now,
			UpdatedAt:   now,
		})
	}

	return items, nil
}

func (s *OrderService) loadReturnByID(ctx context.Context, returnID string) (*model.ReturnRequest, error) {
	returnRequest, err := s.repo.GetReturnByID(ctx, returnID)
	if err != nil {
		return nil, err
	}
	if returnRequest == nil {
		return nil, ErrReturnNotFound
	}

	return returnRequest, nil
}

func isReturnableOrderStatus(status model.OrderStatus) bool {
	return status == model.OrderStatusDelivered
}

func isValidReturnStatus(status model.ReturnStatus) bool {
	switch status {
	case model.ReturnStatusRequested,
		model.ReturnStatusApproved,
		model.ReturnStatusRejected,
		model.ReturnStatusReceived,
		model.ReturnStatusRefundPending,
		model.ReturnStatusRefunded,
		model.ReturnStatusCancelled:
		return true
	default:
		return false
	}
}

func canTransitionReturnStatus(current, next model.ReturnStatus) bool {
	switch current {
	case model.ReturnStatusRequested:
		return next == model.ReturnStatusApproved || next == model.ReturnStatusRejected || next == model.ReturnStatusCancelled
	case model.ReturnStatusApproved:
		return next == model.ReturnStatusReceived || next == model.ReturnStatusCancelled
	case model.ReturnStatusReceived:
		return false
	default:
		return false
	}
}

func canQueueReturnRefund(status model.ReturnStatus) bool {
	return status == model.ReturnStatusApproved ||
		status == model.ReturnStatusReceived ||
		status == model.ReturnStatusRefundPending
}

func aggregateReturnedQuantities(existingReturns []*model.ReturnRequest) map[string]int {
	quantities := make(map[string]int)
	for _, returnRequest := range existingReturns {
		if returnRequest == nil || isIgnoredReturnStatus(returnRequest.Status) {
			continue
		}
		for _, item := range returnRequest.Items {
			quantities[item.OrderItemID] += item.Quantity
		}
	}

	return quantities
}

func isIgnoredReturnStatus(status model.ReturnStatus) bool {
	return status == model.ReturnStatusRejected || status == model.ReturnStatusCancelled
}

func calculateReturnRefundAmount(returnRequest *model.ReturnRequest, order *model.Order) (float64, error) {
	if returnRequest == nil || order == nil {
		return 0, ErrReturnRefundAmount
	}

	orderItemsByID := make(map[string]model.OrderItem, len(order.Items))
	for _, item := range order.Items {
		orderItemsByID[item.ID] = item
	}

	subtotal := 0.0
	for _, returnItem := range returnRequest.Items {
		orderItem, ok := orderItemsByID[returnItem.OrderItemID]
		if !ok {
			return 0, ErrReturnOrderItemNotFound
		}
		subtotal += orderItem.Price * float64(returnItem.Quantity)
	}
	subtotal = roundCurrency(subtotal)
	if subtotal <= 0 {
		return 0, ErrReturnRefundAmount
	}

	discountShare := 0.0
	if order.SubtotalPrice > 0 && order.DiscountAmount > 0 {
		discountShare = roundCurrency(order.DiscountAmount * (subtotal / order.SubtotalPrice))
	}

	refundAmount := roundCurrency(math.Max(subtotal-discountShare, 0))
	if refundAmount <= 0 {
		return 0, ErrReturnRefundAmount
	}

	return refundAmount, nil
}

func (s *OrderService) prepareReturnRefund(ctx context.Context, returnRequest *model.ReturnRequest) (*model.ReturnRequest, error) {
	if s.paymentClient == nil {
		return nil, fmt.Errorf("payment client is not configured")
	}

	updatedReturn := *returnRequest
	now := time.Now()
	if updatedReturn.RefundRequestedAt == nil {
		updatedReturn.RefundRequestedAt = &now
	}
	if updatedReturn.RefundIdempotencyKey == "" {
		updatedReturn.RefundIdempotencyKey = buildReturnRefundIdempotencyKey(updatedReturn.ID)
	}
	if updatedReturn.RefundAmount <= 0 || updatedReturn.RefundChargePaymentID == "" {
		order, err := s.loadOrderByID(ctx, updatedReturn.OrderID)
		if err != nil {
			return nil, err
		}

		refundAmount, err := calculateReturnRefundAmount(&updatedReturn, order)
		if err != nil {
			return nil, err
		}

		payments, err := s.paymentClient.ListPaymentsByOrder(ctx, updatedReturn.OrderID)
		if err != nil {
			return nil, err
		}

		refundablePaymentID, err := findRefundableChargePayment(payments, refundAmount)
		if err != nil {
			return nil, err
		}
		updatedReturn.RefundAmount = refundAmount
		updatedReturn.RefundChargePaymentID = refundablePaymentID
	}

	retryAt := now
	updatedReturn.Status = model.ReturnStatusRefundPending
	updatedReturn.RefundLastError = ""
	updatedReturn.RefundPaymentID = ""
	updatedReturn.RefundCompletedAt = nil
	updatedReturn.RefundNextRetryAt = &retryAt
	updatedReturn.RefundProcessingStarted = nil
	updatedReturn.UpdatedAt = now
	return &updatedReturn, nil
}

func buildReturnRefundIdempotencyKey(returnID string) string {
	return "return-refund:" + strings.TrimSpace(returnID)
}

func findRefundableChargePayment(payments []model.PaymentSummary, amount float64) (string, error) {
	refundedByCharge := make(map[string]float64)
	for _, payment := range payments {
		if payment.TransactionType == "refund" && strings.TrimSpace(payment.ReferencePaymentID) != "" && strings.EqualFold(payment.Status, "refunded") {
			refundedByCharge[payment.ReferencePaymentID] = roundCurrency(refundedByCharge[payment.ReferencePaymentID] + payment.Amount)
		}
	}

	for _, payment := range payments {
		if payment.TransactionType != "charge" || !strings.EqualFold(payment.Status, "completed") {
			continue
		}
		refundable := roundCurrency(math.Max(payment.Amount-refundedByCharge[payment.ID], 0))
		if refundable >= amount {
			return payment.ID, nil
		}
	}

	return "", ErrReturnRefundUnavailable
}
