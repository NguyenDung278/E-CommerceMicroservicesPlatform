package repository

import (
	"database/sql"
	"strings"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanOrder(scanner rowScanner) (*model.Order, error) {
	order := &model.Order{}
	var couponCode sql.NullString
	var shippingRecipientName sql.NullString
	var shippingPhone sql.NullString
	var shippingLocation sql.NullString
	var reservationExpiresAt sql.NullTime
	var reservationAllocatedAt sql.NullTime
	err := scanner.Scan(
		&order.ID,
		&order.UserID,
		&order.Status,
		&order.SubtotalPrice,
		&order.DiscountAmount,
		&couponCode,
		&order.ShippingMethod,
		&order.ShippingFee,
		&shippingRecipientName,
		&shippingPhone,
		&shippingLocation,
		&reservationExpiresAt,
		&reservationAllocatedAt,
		&order.TotalPrice,
		&order.CreatedAt,
		&order.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if couponCode.Valid {
		order.CouponCode = couponCode.String
	}
	if shippingRecipientName.Valid || shippingPhone.Valid || shippingLocation.Valid {
		order.ShippingAddress = &model.ShippingAddress{
			RecipientName: shippingRecipientName.String,
			Phone:         shippingPhone.String,
			Location:      shippingLocation.String,
		}
	}
	if reservationExpiresAt.Valid {
		order.ReservationExpiresAt = &reservationExpiresAt.Time
	}
	if reservationAllocatedAt.Valid {
		order.ReservationAllocatedAt = &reservationAllocatedAt.Time
	}
	return order, nil
}

func scanOrderIdempotencyRecord(scanner rowScanner) (*model.OrderIdempotencyRecord, error) {
	record := &model.OrderIdempotencyRecord{}
	if err := scanner.Scan(
		&record.UserID,
		&record.IdempotencyKey,
		&record.RequestHash,
		&record.OrderID,
		&record.ReservationExpiresAt,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return nil, err
	}

	return record, nil
}

func shippingAddressColumns(address *model.ShippingAddress) (any, any, any) {
	if address == nil {
		return nil, nil, nil
	}

	return nullIfEmpty(address.RecipientName),
		nullIfEmpty(address.Phone),
		nullIfEmpty(address.Location)
}

func scanCoupon(scanner rowScanner) (*model.Coupon, error) {
	coupon := &model.Coupon{}
	var expiresAt sql.NullTime
	err := scanner.Scan(
		&coupon.ID,
		&coupon.Code,
		&coupon.Description,
		&coupon.DiscountType,
		&coupon.DiscountValue,
		&coupon.MinOrderAmount,
		&coupon.UsageLimit,
		&coupon.UsedCount,
		&coupon.Active,
		&expiresAt,
		&coupon.CreatedAt,
		&coupon.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if expiresAt.Valid {
		value := expiresAt.Time
		coupon.ExpiresAt = &value
	}
	return coupon, nil
}

func scanReturn(scanner rowScanner) (*model.ReturnRequest, error) {
	returnRequest := &model.ReturnRequest{}
	var refundChargePaymentID sql.NullString
	var refundPaymentID sql.NullString
	var refundIdempotencyKey sql.NullString
	var refundLastError sql.NullString
	var refundRequestedAt sql.NullTime
	var refundCompletedAt sql.NullTime
	var refundNextRetryAt sql.NullTime
	var refundProcessingStarted sql.NullTime
	if err := scanner.Scan(
		&returnRequest.ID,
		&returnRequest.OrderID,
		&returnRequest.UserID,
		&returnRequest.UserEmail,
		&returnRequest.Status,
		&returnRequest.Reason,
		&returnRequest.RefundAmount,
		&refundChargePaymentID,
		&refundPaymentID,
		&refundIdempotencyKey,
		&refundLastError,
		&returnRequest.RefundAttemptCount,
		&refundRequestedAt,
		&refundCompletedAt,
		&refundNextRetryAt,
		&refundProcessingStarted,
		&returnRequest.CreatedAt,
		&returnRequest.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if refundChargePaymentID.Valid {
		returnRequest.RefundChargePaymentID = refundChargePaymentID.String
	}
	if refundPaymentID.Valid {
		returnRequest.RefundPaymentID = refundPaymentID.String
	}
	if refundIdempotencyKey.Valid {
		returnRequest.RefundIdempotencyKey = refundIdempotencyKey.String
	}
	if refundLastError.Valid {
		returnRequest.RefundLastError = refundLastError.String
	}
	if refundRequestedAt.Valid {
		value := refundRequestedAt.Time
		returnRequest.RefundRequestedAt = &value
	}
	if refundCompletedAt.Valid {
		value := refundCompletedAt.Time
		returnRequest.RefundCompletedAt = &value
	}
	if refundNextRetryAt.Valid {
		value := refundNextRetryAt.Time
		returnRequest.RefundNextRetryAt = &value
	}
	if refundProcessingStarted.Valid {
		value := refundProcessingStarted.Time
		returnRequest.RefundProcessingStarted = &value
	}

	return returnRequest, nil
}

func scanReturnItem(scanner rowScanner) (model.ReturnItem, error) {
	item := model.ReturnItem{}
	err := scanner.Scan(
		&item.ID,
		&item.ReturnID,
		&item.OrderItemID,
		&item.ProductID,
		&item.Quantity,
		&item.Reason,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	return item, err
}

func scanReturnEvidence(scanner rowScanner) (model.ReturnEvidence, error) {
	evidence := model.ReturnEvidence{}
	var uploadedBy sql.NullString
	var uploadedByRole sql.NullString
	err := scanner.Scan(
		&evidence.ID,
		&evidence.ReturnID,
		&evidence.FileName,
		&evidence.ContentType,
		&evidence.SizeBytes,
		&evidence.StorageKey,
		&evidence.URL,
		&uploadedBy,
		&uploadedByRole,
		&evidence.CreatedAt,
	)
	if err != nil {
		return model.ReturnEvidence{}, err
	}
	if uploadedBy.Valid {
		evidence.UploadedBy = uploadedBy.String
	}
	if uploadedByRole.Valid {
		evidence.UploadedByRole = uploadedByRole.String
	}

	return evidence, nil
}

func scanReturnEvent(scanner rowScanner) (model.ReturnEvent, error) {
	event := model.ReturnEvent{}
	var actorID sql.NullString
	var actorRole sql.NullString

	err := scanner.Scan(
		&event.ID,
		&event.ReturnID,
		&event.Status,
		&actorID,
		&actorRole,
		&event.Message,
		&event.CreatedAt,
	)
	if err != nil {
		return model.ReturnEvent{}, err
	}
	if actorID.Valid {
		event.ActorID = actorID.String
	}
	if actorRole.Valid {
		event.ActorRole = actorRole.String
	}

	return event, nil
}

func scanOutboxMessage(scanner rowScanner) (*model.OutboxMessage, error) {
	message := &model.OutboxMessage{}
	var requestID sql.NullString
	var publishedAt sql.NullTime

	if err := scanner.Scan(
		&message.ID,
		&message.AggregateType,
		&message.AggregateID,
		&message.EventType,
		&message.RoutingKey,
		&message.Payload,
		&requestID,
		&message.Attempts,
		&message.LastError,
		&message.AvailableAt,
		&publishedAt,
		&message.CreatedAt,
		&message.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if requestID.Valid {
		message.RequestID = requestID.String
	}
	if publishedAt.Valid {
		value := publishedAt.Time
		message.PublishedAt = &value
	}

	return message, nil
}

func nullIfEmpty(value string) interface{} {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}
