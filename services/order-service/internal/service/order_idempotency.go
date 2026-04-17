package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

const maxOrderIdempotencyKeyLength = 128

func normalizeOrderIdempotencyKey(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}
	if len(trimmed) > maxOrderIdempotencyKeyLength {
		return "", ErrInvalidIdempotencyKey
	}

	return trimmed, nil
}

func hashCreateOrderRequest(req dto.CreateOrderRequest) string {
	method := strings.ToLower(strings.TrimSpace(req.ShippingMethod))
	if normalizedMethod, err := normalizeShippingMethod(req.ShippingMethod); err == nil {
		method = normalizedMethod
	}

	address := normalizeShippingAddress(req.ShippingAddress)
	addressParts := []string{"", ""}
	if address != nil {
		addressParts[0] = strings.TrimSpace(address.RecipientName)
		addressParts[1] = strings.TrimSpace(address.Phone)
	}

	items := make([]string, 0, len(req.Items))
	for _, item := range req.Items {
		items = append(items, fmt.Sprintf("%s:%d", strings.TrimSpace(item.ProductID), item.Quantity))
	}
	sort.Strings(items)

	sum := sha256.Sum256([]byte(strings.Join([]string{
		strings.Join(items, ","),
		normalizeCouponCode(req.CouponCode),
		method,
		addressParts[0],
		addressParts[1],
	}, "|")))

	return hex.EncodeToString(sum[:])
}

func (s *OrderService) findIdempotentOrder(
	ctx context.Context,
	userID string,
	idempotencyKey string,
	requestHash string,
) (*model.Order, error) {
	if idempotencyKey == "" {
		return nil, nil
	}

	record, err := s.repo.GetIdempotencyKey(ctx, userID, idempotencyKey)
	if err != nil {
		return nil, err
	}
	if record == nil {
		return nil, nil
	}
	if record.RequestHash != requestHash {
		return nil, ErrIdempotencyKeyConflict
	}

	order, err := s.loadOrderByID(ctx, record.OrderID)
	if err != nil {
		return nil, err
	}

	return order, nil
}

func isOrderUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
