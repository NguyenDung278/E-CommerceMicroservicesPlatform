// Payload event tu order/payment service va handler cho tung routing key:
// dung preference cua user quyet dinh gui hay suppress, build history item
// va soan noi dung email tieng Viet khong dau.

package handler

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/inbox"
)

// OrderEvent represents an order event from the Order Service.
type OrderEvent struct {
	EventID    string  `json:"event_id,omitempty"`
	OrderID    string  `json:"order_id"`
	UserID     string  `json:"user_id"`
	UserEmail  string  `json:"user_email"`
	TotalPrice float64 `json:"total_price"`
	Status     string  `json:"status"`
	RequestID  string  `json:"request_id,omitempty"`
}

// PaymentEvent represents a payment event from the Payment Service.
type PaymentEvent struct {
	EventID   string  `json:"event_id,omitempty"`
	PaymentID string  `json:"payment_id"`
	OrderID   string  `json:"order_id"`
	UserID    string  `json:"user_id"`
	UserEmail string  `json:"user_email"`
	Amount    float64 `json:"amount"`
	Status    string  `json:"status"`
	RequestID string  `json:"request_id,omitempty"`
}

type ReturnEvent struct {
	EventID      string  `json:"event_id,omitempty"`
	ReturnID     string  `json:"return_id"`
	OrderID      string  `json:"order_id"`
	UserID       string  `json:"user_id"`
	UserEmail    string  `json:"user_email"`
	Status       string  `json:"status"`
	Reason       string  `json:"reason,omitempty"`
	RefundAmount float64 `json:"refund_amount,omitempty"`
	RequestID    string  `json:"request_id,omitempty"`
}

func (h *EventHandler) handleOrderCreated(
	ctx context.Context,
	messageID string,
	routingKey string,
	createdAt time.Time,
	event OrderEvent,
) (*inbox.HistoryItem, error) {
	deliver, err := h.shouldDeliverTopic(ctx, event.UserID, notificationTopicOrderUpdates)
	if err != nil {
		return nil, err
	}
	item := buildHistoryItem(messageID, routingKey, createdAt, notificationTopicOrderUpdates, deliveryStatus(deliver),
		event.UserID, fmt.Sprintf("Don hang %s da duoc tao", event.OrderID),
		fmt.Sprintf("Tong thanh toan %.2f. Trang thai hien tai: %s.", event.TotalPrice, event.Status),
		"/orders/"+event.OrderID, "Mo chi tiet don hang",
		event.OrderID, "", "",
	)
	if !deliver {
		return item, nil
	}

	h.log.Info("notification: order confirmation",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("status", event.Status),
	)
	if err := h.sendEmail(event.UserEmail, "Xac nhan don hang", fmt.Sprintf(
		"Chao ban,\n\nDon hang %s da duoc tao thanh cong.\nTong thanh toan: %.2f\nTrang thai: %s\n\nCam on ban da mua hang tai ND Shop.",
		event.OrderID,
		event.TotalPrice,
		event.Status,
	)); err != nil {
		return nil, err
	}
	return item, nil
}

func (h *EventHandler) handlePaymentCompleted(
	ctx context.Context,
	messageID string,
	routingKey string,
	createdAt time.Time,
	event PaymentEvent,
) (*inbox.HistoryItem, error) {
	deliver, err := h.shouldDeliverTopic(ctx, event.UserID, notificationTopicPaymentUpdates)
	if err != nil {
		return nil, err
	}
	item := buildHistoryItem(messageID, routingKey, createdAt, notificationTopicPaymentUpdates, deliveryStatus(deliver),
		event.UserID, fmt.Sprintf("Thanh toan %s thanh cong", event.PaymentID),
		fmt.Sprintf("Don hang %s da thanh toan thanh cong %.2f.", event.OrderID, event.Amount),
		"/payments", "Mo lich su thanh toan",
		event.OrderID, event.PaymentID, "",
	)
	if !deliver {
		return item, nil
	}

	h.log.Info("notification: payment completed",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("payment_id", event.PaymentID),
	)
	if err := h.sendEmail(event.UserEmail, "Bien lai thanh toan", fmt.Sprintf(
		"Chao ban,\n\nThanh toan %s cho don hang %s da thanh cong.\nSo tien: %.2f\n\nCam on ban da mua hang tai ND Shop.",
		event.PaymentID,
		event.OrderID,
		event.Amount,
	)); err != nil {
		return nil, err
	}
	return item, nil
}

func (h *EventHandler) handlePaymentFailed(
	ctx context.Context,
	messageID string,
	routingKey string,
	createdAt time.Time,
	event PaymentEvent,
) (*inbox.HistoryItem, error) {
	deliver, err := h.shouldDeliverTopic(ctx, event.UserID, notificationTopicPaymentUpdates)
	if err != nil {
		return nil, err
	}
	item := buildHistoryItem(messageID, routingKey, createdAt, notificationTopicPaymentUpdates, deliveryStatus(deliver),
		event.UserID, fmt.Sprintf("Thanh toan %s that bai", event.PaymentID),
		fmt.Sprintf("Don hang %s co giao dich that bai %.2f.", event.OrderID, event.Amount),
		"/payments", "Xem lich su thanh toan",
		event.OrderID, event.PaymentID, "",
	)
	if !deliver {
		return item, nil
	}

	h.log.Warn("notification: payment failed",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("payment_id", event.PaymentID),
	)
	if err := h.sendEmail(event.UserEmail, "Thanh toan that bai", fmt.Sprintf(
		"Chao ban,\n\nThanh toan %s cho don hang %s da that bai.\nSo tien: %.2f\nVui long thu lai hoac chon phuong thuc thanh toan khac.",
		event.PaymentID,
		event.OrderID,
		event.Amount,
	)); err != nil {
		return nil, err
	}
	return item, nil
}

func (h *EventHandler) handlePaymentRefunded(
	ctx context.Context,
	messageID string,
	routingKey string,
	createdAt time.Time,
	event PaymentEvent,
) (*inbox.HistoryItem, error) {
	deliver, err := h.shouldDeliverTopic(ctx, event.UserID, notificationTopicPaymentUpdates)
	if err != nil {
		return nil, err
	}
	item := buildHistoryItem(messageID, routingKey, createdAt, notificationTopicPaymentUpdates, deliveryStatus(deliver),
		event.UserID, fmt.Sprintf("Khoan tien %s da duoc hoan", event.PaymentID),
		fmt.Sprintf("Don hang %s da hoan tien %.2f.", event.OrderID, event.Amount),
		"/payments", "Mo lich su thanh toan",
		event.OrderID, event.PaymentID, "",
	)
	if !deliver {
		return item, nil
	}

	h.log.Info("notification: payment refunded",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("payment_id", event.PaymentID),
	)
	if err := h.sendEmail(event.UserEmail, "Hoan tien thanh cong", fmt.Sprintf(
		"Chao ban,\n\nKhoan hoan tien %s cho don hang %s da duoc xu ly thanh cong.\nSo tien hoan: %.2f\n\nNeu ban can ho tro them, vui long lien he chung toi.",
		event.PaymentID,
		event.OrderID,
		event.Amount,
	)); err != nil {
		return nil, err
	}
	return item, nil
}

func (h *EventHandler) handleOrderCancelled(
	ctx context.Context,
	messageID string,
	routingKey string,
	createdAt time.Time,
	event OrderEvent,
) (*inbox.HistoryItem, error) {
	deliver, err := h.shouldDeliverTopic(ctx, event.UserID, notificationTopicOrderUpdates)
	if err != nil {
		return nil, err
	}
	item := buildHistoryItem(messageID, routingKey, createdAt, notificationTopicOrderUpdates, deliveryStatus(deliver),
		event.UserID, fmt.Sprintf("Don hang %s da bi huy", event.OrderID),
		fmt.Sprintf("Tong gia tri don hang: %.2f. Trang thai hien tai: %s.", event.TotalPrice, event.Status),
		"/orders/"+event.OrderID, "Mo chi tiet don hang",
		event.OrderID, "", "",
	)
	if !deliver {
		return item, nil
	}

	h.log.Info("notification: order cancelled",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("status", event.Status),
	)
	if err := h.sendEmail(event.UserEmail, "Don hang da bi huy", fmt.Sprintf(
		"Chao ban,\n\nDon hang %s da duoc huy thanh cong.\nSo tien: %.2f\n\nNeu ban can ho tro, vui long lien he chung toi.",
		event.OrderID,
		event.TotalPrice,
	)); err != nil {
		return nil, err
	}
	return item, nil
}

func (h *EventHandler) handleReturnEvent(
	ctx context.Context,
	messageID string,
	routingKey string,
	createdAt time.Time,
	event ReturnEvent,
) (*inbox.HistoryItem, error) {
	deliver, err := h.shouldDeliverTopic(ctx, event.UserID, notificationTopicReturnUpdates)
	if err != nil {
		return nil, err
	}
	subject, body := returnEmailContent(event)
	item := buildHistoryItem(messageID, routingKey, createdAt, notificationTopicReturnUpdates, deliveryStatus(deliver),
		event.UserID, subject,
		buildReturnNarrative(event),
		"/returns/"+event.ReturnID, "Mo yeu cau tra hang",
		event.OrderID, "", event.ReturnID,
	)
	if !deliver {
		return item, nil
	}

	h.log.Info("notification: return updated",
		zap.String("user_id", event.UserID),
		zap.String("order_id", event.OrderID),
		zap.String("return_id", event.ReturnID),
		zap.String("status", event.Status),
	)

	if err := h.sendEmail(event.UserEmail, subject, body); err != nil {
		return nil, err
	}
	return item, nil
}

func (h *EventHandler) shouldDeliverTopic(
	ctx context.Context,
	userID, topic string,
) (bool, error) {
	if h.preferences == nil {
		return true, nil
	}
	userID = strings.TrimSpace(userID)
	topic = strings.TrimSpace(topic)
	if userID == "" || topic == "" {
		return true, nil
	}

	preferences, err := h.preferences.PreferenceMap(ctx, userID)
	if err != nil {
		return false, newTransientDeliveryError(fmt.Errorf("failed to load notification preferences: %w", err))
	}
	enabled, ok := preferences[topic]
	if !ok {
		return true, nil
	}
	if !enabled {
		h.log.Info("notification skipped by user preference",
			zap.String("user_id", userID),
			zap.String("topic", topic),
		)
	}
	return enabled, nil
}

const (
	notificationTopicOrderUpdates   = "order_updates"
	notificationTopicPaymentUpdates = "payment_updates"
	notificationTopicReturnUpdates  = "return_updates"
)

func returnEmailContent(event ReturnEvent) (string, string) {
	switch strings.ToLower(strings.TrimSpace(event.Status)) {
	case "requested":
		return "Da tiep nhan yeu cau tra hang", fmt.Sprintf(
			"Chao ban,\n\nYeu cau tra hang %s cho don hang %s da duoc tiep nhan.\nLy do: %s\n\nChung toi se cap nhat som nhat khi yeu cau duoc xem xet.",
			event.ReturnID,
			event.OrderID,
			event.Reason,
		)
	case "approved":
		return "Yeu cau tra hang da duoc duyet", fmt.Sprintf(
			"Chao ban,\n\nYeu cau tra hang %s cho don hang %s da duoc duyet.\nLy do: %s\n\nVui long gui hang ve kho theo huong dan cua chung toi.",
			event.ReturnID,
			event.OrderID,
			event.Reason,
		)
	case "received":
		return "Kho da nhan hang tra ve", fmt.Sprintf(
			"Chao ban,\n\nChung toi da nhan hang tra ve cho yeu cau %s cua don hang %s.\nLy do: %s\n\nHe thong se tien hanh buoc hoan tien tiep theo.",
			event.ReturnID,
			event.OrderID,
			event.Reason,
		)
	case "refund_pending":
		return "Yeu cau hoan tien dang duoc xu ly", fmt.Sprintf(
			"Chao ban,\n\nYeu cau tra hang %s cho don hang %s da duoc dua vao hang doi hoan tien.\nSo tien hoan du kien: %.2f\n\nChung toi se gui tiep thong bao ngay khi khoan hoan tien hoan tat.",
			event.ReturnID,
			event.OrderID,
			event.RefundAmount,
		)
	case "rejected":
		return "Yeu cau tra hang bi tu choi", fmt.Sprintf(
			"Chao ban,\n\nYeu cau tra hang %s cho don hang %s khong duoc chap nhan.\nLy do: %s\n\nNeu ban can ho tro them, vui long lien he chung toi.",
			event.ReturnID,
			event.OrderID,
			event.Reason,
		)
	case "cancelled":
		return "Yeu cau tra hang da bi huy", fmt.Sprintf(
			"Chao ban,\n\nYeu cau tra hang %s cho don hang %s da duoc huy.\nLy do: %s",
			event.ReturnID,
			event.OrderID,
			event.Reason,
		)
	case "refunded":
		return "Tra hang da hoan tat", fmt.Sprintf(
			"Chao ban,\n\nYeu cau tra hang %s cho don hang %s da hoan tat.\nSo tien hoan du kien: %.2f\n\nCam on ban da cho chung toi co hoi ho tro.",
			event.ReturnID,
			event.OrderID,
			event.RefundAmount,
		)
	default:
		return "Cap nhat yeu cau tra hang", fmt.Sprintf(
			"Chao ban,\n\nYeu cau tra hang %s cho don hang %s da duoc cap nhat sang trang thai %s.",
			event.ReturnID,
			event.OrderID,
			event.Status,
		)
	}
}

func buildReturnNarrative(event ReturnEvent) string {
	base := fmt.Sprintf("Yeu cau tra hang %s cua don %s da chuyen sang trang thai %s.", event.ReturnID, event.OrderID, event.Status)
	if strings.TrimSpace(event.Reason) != "" {
		base += " Ly do: " + strings.TrimSpace(event.Reason) + "."
	}
	if event.RefundAmount > 0 {
		base += fmt.Sprintf(" So tien lien quan: %.2f.", event.RefundAmount)
	}
	return base
}
