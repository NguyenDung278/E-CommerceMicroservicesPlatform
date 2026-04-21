package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/repository"
)

// CreateCoupon normalizes and persists a coupon for future order pricing.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - req contains the coupon definition from an administrative API.
//
// Returns:
//   - the persisted coupon aggregate.
//   - ErrCouponAlreadyExists when the code is already taken.
//
// Edge cases:
//   - Active defaults to true when omitted to preserve current API behavior.
//
// Side effects:
//   - writes a coupon row to PostgreSQL.
//
// Performance:
//   - O(1) application logic plus one repository insert.
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

// ListCoupons returns the current coupon catalog for administrative listing
// screens.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//
// Returns:
//   - all coupons visible to the repository implementation.
//   - any repository error.
//
// Edge cases:
//   - empty coupon catalogs return an empty slice.
//
// Side effects:
//   - none.
//
// Performance:
//   - dominated by one repository query.
func (s *OrderService) ListCoupons(ctx context.Context) ([]*model.Coupon, error) {
	return s.repo.ListCoupons(ctx)
}

// isCouponError classifies repository coupon failures so CreateOrder can log
// business errors without promoting them to system-level noise.
//
// Inputs:
//   - err is the persistence error to classify.
//
// Returns:
//   - true when the error matches a known coupon business failure.
//
// Edge cases:
//   - wrapped errors are supported through errors.Is.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func isCouponError(err error) bool {
	return errors.Is(err, repository.ErrCouponNotFound) ||
		errors.Is(err, repository.ErrCouponInactive) ||
		errors.Is(err, repository.ErrCouponExpired) ||
		errors.Is(err, repository.ErrCouponMinimumNotMet) ||
		errors.Is(err, repository.ErrCouponUsageLimitReached)
}

// isUniqueViolation detects PostgreSQL unique-constraint failures for coupon
// creation.
//
// Inputs:
//   - err is the raw repository error.
//
// Returns:
//   - true when PostgreSQL reported SQLSTATE 23505.
//
// Edge cases:
//   - wrapped pq errors are supported through errors.As.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
