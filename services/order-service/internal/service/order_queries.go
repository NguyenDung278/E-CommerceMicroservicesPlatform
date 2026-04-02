package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

// GetOrder returns one order for its owning user.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - orderID identifies the order to load.
//   - userID is used for ownership enforcement.
//
// Returns:
//   - the requested order when it exists and belongs to the user.
//   - ErrOrderNotFound for missing or unauthorized access.
//
// Edge cases:
//   - unauthorized access intentionally returns the same not-found error to
//     avoid leaking order existence.
//
// Side effects:
//   - none.
//
// Performance:
//   - dominated by one repository read.
func (s *OrderService) GetOrder(ctx context.Context, orderID, userID string) (*model.Order, error) {
	order, err := s.loadOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.UserID != userID {
		return nil, ErrOrderNotFound
	}
	return order, nil
}

// GetOrderForAdmin returns one order without owner filtering for operator flows.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - orderID identifies the order to load.
//
// Returns:
//   - the order when it exists.
//   - ErrOrderNotFound when the order does not exist.
//
// Edge cases:
//   - authorization is expected to happen in the handler or middleware layer.
//
// Side effects:
//   - none.
//
// Performance:
//   - dominated by one repository read.
func (s *OrderService) GetOrderForAdmin(ctx context.Context, orderID string) (*model.Order, error) {
	return s.loadOrderByID(ctx, orderID)
}

// GetUserOrders lists all orders owned by the given user.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - userID identifies the owner.
//
// Returns:
//   - the user's orders ordered by repository policy.
//   - any repository error.
//
// Edge cases:
//   - users with no orders receive an empty slice.
//
// Side effects:
//   - none.
//
// Performance:
//   - dominated by one repository query.
func (s *OrderService) GetUserOrders(ctx context.Context, userID string) ([]*model.Order, error) {
	return s.repo.GetByUserID(ctx, userID)
}

// GetUserOrderSummary returns the user's orders together with grouped payment
// history.
//
// Inputs:
//   - ctx carries cancellation to repository and downstream payment calls.
//   - userID identifies the order owner.
//   - authHeader forwards the caller's payment-service authorization.
//
// Returns:
//   - a summary containing orders and payments keyed by order id.
//   - an error when either source fails.
//
// Edge cases:
//   - empty order lists short-circuit without calling payment-service.
//   - missing payment client configuration returns a system error because the
//     endpoint promises payment data.
//
// Side effects:
//   - reads from both order storage and payment-service.
//
// Performance:
//   - O(o+p) over loaded orders and payments with map-based grouping.
func (s *OrderService) GetUserOrderSummary(ctx context.Context, userID, authHeader string) (*model.UserOrderSummary, error) {
	startedAt := time.Now()
	outcome := appobs.OutcomeSuccess
	requestLog := appobs.LoggerWithContext(s.log, ctx, zap.String("user_id", userID))
	defer func() {
		appobs.ObserveOperation("order-service", "get_user_order_summary", outcome, time.Since(startedAt))
	}()

	orders, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("failed to load user orders for summary", zap.Error(err))
		return nil, err
	}

	summary := &model.UserOrderSummary{
		Orders:          orders,
		PaymentsByOrder: make(map[string][]model.PaymentSummary, len(orders)),
	}
	if len(orders) == 0 {
		return summary, nil
	}
	if s.paymentClient == nil {
		outcome = appobs.OutcomeSystemError
		return nil, fmt.Errorf("payment client is not configured")
	}

	payments, err := s.paymentClient.ListPaymentHistory(ctx, authHeader)
	if err != nil {
		outcome = appobs.OutcomeSystemError
		requestLog.Error("failed to load payment history for order summary", zap.Error(err))
		return nil, err
	}

	summary.PaymentsByOrder = groupPaymentHistoryByOrder(buildOrderIDSet(orders), payments)
	return summary, nil
}

// ListAdminOrders returns the paginated order list used by administrative
// screens.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - filters contains pagination and filter settings.
//
// Returns:
//   - the matching orders.
//   - the total row count for pagination.
//   - any repository error.
//
// Edge cases:
//   - pagination semantics follow the repository implementation.
//
// Side effects:
//   - none.
//
// Performance:
//   - dominated by repository count and list queries.
func (s *OrderService) ListAdminOrders(ctx context.Context, filters model.OrderFilters) ([]*model.Order, int64, error) {
	return s.repo.ListAll(ctx, filters)
}

// GetOrderTimeline returns the recorded audit trail for an order when the actor
// is allowed to view it.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - orderID identifies the order.
//   - actorID and actorRole describe the caller for access control.
//
// Returns:
//   - the list of order events for that order.
//   - ErrOrderNotFound when the actor must not see the order.
//
// Edge cases:
//   - admin and staff roles bypass ownership checks.
//
// Side effects:
//   - none.
//
// Performance:
//   - two repository reads: one for the order and one for its timeline.
func (s *OrderService) GetOrderTimeline(ctx context.Context, orderID, actorID, actorRole string) ([]*model.OrderEvent, error) {
	order, err := s.loadOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if !isOperatorRole(actorRole) && order.UserID != actorID {
		return nil, ErrOrderNotFound
	}
	return s.repo.GetEventsByOrderID(ctx, orderID)
}

// GetAdminReport returns aggregate order metrics for the requested reporting
// window.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - windowDays selects the trailing reporting window.
//
// Returns:
//   - an aggregate report for the requested or normalized window.
//   - any repository error.
//
// Edge cases:
//   - invalid windows are normalized to 30 days to keep the endpoint usable.
//
// Side effects:
//   - none.
//
// Performance:
//   - dominated by one repository aggregate query.
func (s *OrderService) GetAdminReport(ctx context.Context, windowDays int) (*model.AdminReport, error) {
	if windowDays <= 0 || windowDays > 365 {
		windowDays = 30
	}

	now := time.Now()
	from := now.AddDate(0, 0, -windowDays)

	return s.repo.GetAdminReport(ctx, from, now, windowDays)
}

// ListPopularProducts returns the best-selling products over the repository's
// default reporting horizon.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - limit bounds the number of returned products.
//
// Returns:
//   - the popularity list.
//   - any repository error.
//
// Edge cases:
//   - repository-specific limit normalization still applies.
//
// Side effects:
//   - none.
//
// Performance:
//   - dominated by one repository aggregate query.
func (s *OrderService) ListPopularProducts(ctx context.Context, limit int) ([]model.ProductPopularity, error) {
	return s.repo.ListPopularProducts(ctx, limit)
}

// loadOrderByID centralizes not-found handling for order reads.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - orderID identifies the order.
//
// Returns:
//   - the loaded order.
//   - ErrOrderNotFound when the repository has no matching record.
//
// Edge cases:
//   - repository nil results are translated into the domain error.
//
// Side effects:
//   - none.
//
// Performance:
//   - dominated by one repository read.
func (s *OrderService) loadOrderByID(ctx context.Context, orderID string) (*model.Order, error) {
	order, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, ErrOrderNotFound
	}
	return order, nil
}

// buildOrderIDSet constructs the membership set used to filter payment history
// down to the orders currently in scope.
//
// Inputs:
//   - orders is the user's current order list.
//
// Returns:
//   - a set keyed by order id.
//
// Edge cases:
//   - duplicate order ids simply overwrite the same set entry.
//
// Side effects:
//   - allocates one map sized to the number of orders.
//
// Performance:
//   - O(o) over the order slice.
func buildOrderIDSet(orders []*model.Order) map[string]struct{} {
	orderIDs := make(map[string]struct{}, len(orders))
	for _, order := range orders {
		orderIDs[order.ID] = struct{}{}
	}
	return orderIDs
}

// groupPaymentHistoryByOrder filters and groups payment summaries by order id.
//
// Inputs:
//   - orderIDs is the allowed membership set.
//   - payments is the raw payment history returned by payment-service.
//
// Returns:
//   - a map of order id to the related payment summaries.
//
// Edge cases:
//   - unrelated payment records are skipped silently.
//
// Side effects:
//   - allocates slices only for matching orders.
//
// Performance:
//   - O(p) over the payment slice with average O(1) membership checks.
func groupPaymentHistoryByOrder(orderIDs map[string]struct{}, payments []model.PaymentSummary) map[string][]model.PaymentSummary {
	grouped := make(map[string][]model.PaymentSummary, len(orderIDs))
	for _, payment := range payments {
		if _, exists := orderIDs[payment.OrderID]; !exists {
			continue
		}

		grouped[payment.OrderID] = append(grouped[payment.OrderID], payment)
	}
	return grouped
}

// isOperatorRole classifies roles that can view or mutate orders across users.
//
// Inputs:
//   - role is the raw actor role string.
//
// Returns:
//   - true when the role belongs to an operator.
//
// Edge cases:
//   - comparison is case-insensitive and whitespace-tolerant.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the role length due to trimming and lowercasing.
func isOperatorRole(role string) bool {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "admin", "staff":
		return true
	default:
		return false
	}
}
