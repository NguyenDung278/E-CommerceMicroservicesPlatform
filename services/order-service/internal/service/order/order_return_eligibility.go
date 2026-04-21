package service

import (
	"context"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

func (s *OrderService) GetReturnEligibility(
	ctx context.Context,
	orderID, actorID, actorRole string,
) (*model.ReturnEligibilitySnapshot, error) {
	order, err := s.loadOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if !isOperatorRole(actorRole) && order.UserID != actorID {
		return nil, ErrOrderNotFound
	}

	existingReturns, err := s.repo.ListReturnsByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	orderEvents, err := s.repo.GetEventsByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	return buildReturnEligibilitySnapshot(order, existingReturns, orderEvents, time.Now()), nil
}

func buildReturnEligibilitySnapshot(
	order *model.Order,
	existingReturns []*model.ReturnRequest,
	orderEvents []*model.OrderEvent,
	now time.Time,
) *model.ReturnEligibilitySnapshot {
	if order == nil {
		return nil
	}

	windowStartedAt := resolveReturnWindowStart(order, orderEvents)
	windowExpiresAt := (*time.Time)(nil)
	windowExpired := false
	if windowStartedAt != nil {
		value := windowStartedAt.AddDate(0, 0, model.DefaultReturnWindowDays)
		windowExpiresAt = &value
		windowExpired = now.After(value)
	}

	orderEligible := isReturnableOrderStatus(order.Status) && !windowExpired
	orderReason := ""
	switch {
	case !isReturnableOrderStatus(order.Status):
		orderReason = "order_not_delivered"
	case windowExpired:
		orderReason = "return_window_expired"
	}

	alreadyReturned := aggregateReturnedQuantities(existingReturns)
	items := make([]model.ReturnEligibilityItem, 0, len(order.Items))
	hasEligibleItems := false
	for _, item := range order.Items {
		alreadyRequested := alreadyReturned[item.ID]
		remainingQuantity := item.Quantity - alreadyRequested
		itemEligible := orderEligible && remainingQuantity > 0
		itemReason := orderReason
		if itemReason == "" && remainingQuantity <= 0 {
			itemReason = "already_fully_requested"
		}
		if itemEligible {
			hasEligibleItems = true
		}

		items = append(items, model.ReturnEligibilityItem{
			OrderItemID:              item.ID,
			ProductID:                item.ProductID,
			ProductName:              item.Name,
			OrderedQuantity:          item.Quantity,
			AlreadyRequestedQuantity: alreadyRequested,
			RemainingQuantity:        max(remainingQuantity, 0),
			Eligible:                 itemEligible,
			Reason:                   itemReason,
		})
	}

	if orderReason == "" && !hasEligibleItems {
		orderReason = "all_items_already_requested"
	}

	return &model.ReturnEligibilitySnapshot{
		OrderID:               order.ID,
		OrderStatus:           order.Status,
		Eligible:              hasEligibleItems,
		Reason:                orderReason,
		ReturnWindowDays:      model.DefaultReturnWindowDays,
		ReturnWindowStartedAt: windowStartedAt,
		ReturnWindowExpiresAt: windowExpiresAt,
		Items:                 items,
	}
}

func resolveReturnWindowStart(
	order *model.Order,
	events []*model.OrderEvent,
) *time.Time {
	for _, event := range events {
		if event == nil {
			continue
		}
		if event.Status == model.OrderStatusDelivered {
			value := event.CreatedAt
			return &value
		}
	}

	if order != nil && order.Status == model.OrderStatusDelivered {
		value := order.UpdatedAt
		if value.IsZero() {
			value = order.CreatedAt
		}
		if !value.IsZero() {
			return &value
		}
	}

	return nil
}
