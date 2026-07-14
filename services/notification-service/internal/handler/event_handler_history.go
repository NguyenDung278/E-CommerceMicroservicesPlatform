// Builder cho notification history item (inbox hien thi cho user) va
// retry audit item (an khoi user, phuc vu van hanh).

package handler

import (
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/inbox"
)

func buildHistoryItem(
	messageID string,
	routingKey string,
	createdAt time.Time,
	topic string,
	deliveryStatus string,
	userID string,
	title string,
	message string,
	actionHref string,
	actionLabel string,
	orderID string,
	paymentID string,
	returnID string,
) *inbox.HistoryItem {
	return &inbox.HistoryItem{
		ID:             strings.TrimSpace(messageID),
		UserID:         strings.TrimSpace(userID),
		Topic:          strings.TrimSpace(topic),
		RoutingKey:     strings.TrimSpace(routingKey),
		DeliveryStatus: strings.TrimSpace(deliveryStatus),
		VisibleToUser:  true,
		Title:          strings.TrimSpace(title),
		Message:        strings.TrimSpace(message),
		ActionHref:     strings.TrimSpace(actionHref),
		ActionLabel:    strings.TrimSpace(actionLabel),
		OrderID:        strings.TrimSpace(orderID),
		PaymentID:      strings.TrimSpace(paymentID),
		ReturnID:       strings.TrimSpace(returnID),
		CreatedAt:      createdAt.UTC(),
	}
}

func buildRetryAuditItem(
	messageID string,
	routingKey string,
	createdAt time.Time,
	attemptCount int,
	deliveryStatus string,
	lastError string,
	nextRetryAt *time.Time,
) *inbox.HistoryItem {
	return &inbox.HistoryItem{
		ID:             strings.TrimSpace(messageID) + ":" + strings.TrimSpace(deliveryStatus),
		UserID:         "",
		Topic:          "delivery_audit",
		RoutingKey:     strings.TrimSpace(routingKey),
		DeliveryStatus: strings.TrimSpace(deliveryStatus),
		VisibleToUser:  false,
		AttemptCount:   attemptCount,
		LastError:      strings.TrimSpace(lastError),
		NextRetryAt:    nextRetryAt,
		Title:          "Notification delivery audit",
		Message:        "Notification worker recorded a retry or failure transition.",
		CreatedAt:      createdAt.UTC(),
	}
}

func deliveryStatus(delivered bool) string {
	if delivered {
		return "delivered"
	}
	return "suppressed"
}
