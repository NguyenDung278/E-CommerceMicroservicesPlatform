package service

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"

	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

type validatedOrderRequest struct {
	shippingMethod  string
	shippingAddress *model.ShippingAddress
}

type productQuoteCache struct {
	products map[string]*pb.Product
}

// PreviewOrder calculates an order quote without persisting anything.
//
// Inputs:
//   - ctx propagates cancellation to downstream product and coupon lookups.
//   - req contains the requested items, shipping method, and optional coupon.
//
// Returns:
//   - an API preview that mirrors the totals CreateOrder would persist.
//   - an error when validation, product lookup, stock checks, or coupon checks fail.
//
// Edge cases:
//   - empty carts, invalid shipping data, and expired coupons fail fast.
//
// Side effects:
//   - none; this method is read-only.
//
// Performance:
//   - O(n) over line items plus one downstream product lookup per unique product
//     id within the request thanks to a request-scoped cache.
func (s *OrderService) PreviewOrder(ctx context.Context, req dto.CreateOrderRequest) (*model.OrderPreview, error) {
	quote, err := s.quoteOrder(ctx, req)
	if err != nil {
		return nil, err
	}

	return quote.ToPreview(), nil
}

// quoteOrder resolves item pricing, validates shipping, and applies coupons to
// produce the canonical totals used by both preview and create flows.
//
// Inputs:
//   - ctx carries cancellation for remote catalog and repository calls.
//   - req contains the raw order request payload from the API boundary.
//
// Returns:
//   - a fully calculated quote including subtotal, shipping fee, and total.
//   - an error when any input or dependency check fails.
//
// Edge cases:
//   - duplicate product ids reuse cached catalog data but keep per-line
//     quantities so existing behavior stays intact.
//
// Side effects:
//   - reads product and coupon data only.
//
// Performance:
//   - O(n) over items with O(u) remote product lookups, where u is the number of
//     unique product ids in the request.
func (s *OrderService) quoteOrder(ctx context.Context, req dto.CreateOrderRequest) (*pricedOrderQuote, error) {
	validated, err := validateOrderRequest(req)
	if err != nil {
		return nil, err
	}

	quote := &pricedOrderQuote{
		Items:           make([]pricedOrderItem, 0, len(req.Items)),
		ShippingMethod:  validated.shippingMethod,
		ShippingAddress: validated.shippingAddress,
	}
	cache := newProductQuoteCache(len(req.Items))

	var subtotal float64
	for _, item := range req.Items {
		quotedItem, err := s.quoteOrderItem(ctx, item, cache)
		if err != nil {
			return nil, err
		}

		quote.Items = append(quote.Items, quotedItem)
		subtotal += quotedItem.Price * float64(quotedItem.Quantity)
	}

	quote.SubtotalPrice = roundCurrency(subtotal)
	quote.ShippingFee = calculateShippingFee(validated.shippingMethod, quote.SubtotalPrice)
	quote.TotalPrice = roundCurrency(quote.SubtotalPrice + quote.ShippingFee)

	if strings.TrimSpace(req.CouponCode) == "" {
		return quote, nil
	}

	coupon, err := s.validateCoupon(ctx, req.CouponCode, quote.SubtotalPrice)
	if err != nil {
		return nil, err
	}

	applyCouponToQuote(quote, coupon)

	return quote, nil
}

// validateOrderRequest normalizes shipping inputs and rejects impossible orders
// before any downstream work starts.
//
// Inputs:
//   - req is the raw API payload.
//
// Returns:
//   - normalized shipping metadata reused by the pricing and persistence flows.
//   - an error when the cart is empty or delivery information is incomplete.
//
// Edge cases:
//   - pickup orders intentionally allow nil shipping addresses.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1) plus trimming costs on the shipping fields.
func validateOrderRequest(req dto.CreateOrderRequest) (validatedOrderRequest, error) {
	if len(req.Items) == 0 {
		return validatedOrderRequest{}, ErrEmptyOrder
	}

	shippingMethod, err := normalizeShippingMethod(req.ShippingMethod)
	if err != nil {
		return validatedOrderRequest{}, err
	}

	shippingAddress := normalizeShippingAddress(req.ShippingAddress)
	if shippingMethod != string(model.ShippingMethodPickup) && shippingAddress == nil {
		return validatedOrderRequest{}, ErrShippingAddressRequired
	}

	return validatedOrderRequest{
		shippingMethod:  shippingMethod,
		shippingAddress: shippingAddress,
	}, nil
}

// quoteOrderItem resolves one line item against the product catalog and applies
// stock validation.
//
// Inputs:
//   - ctx propagates cancellation to the product catalog.
//   - item is one requested order line.
//   - cache stores product lookups for the current quote only.
//
// Returns:
//   - a priced line item ready to be copied into the order aggregate.
//   - an error when the product is missing, unavailable, or lacks stock.
//
// Edge cases:
//   - gRPC not-found and invalid-argument responses are translated into domain
//     errors so handlers can return stable API responses.
//
// Side effects:
//   - performs a remote product lookup on the first access for a product id.
//
// Performance:
//   - O(1) local work after the product is cached; otherwise dominated by one
//     remote gRPC call.
func (s *OrderService) quoteOrderItem(ctx context.Context, item dto.OrderItemRequest, cache *productQuoteCache) (pricedOrderItem, error) {
	product, err := cache.getOrLoad(ctx, item.ProductID, s.productClient.GetProduct)
	if err != nil {
		switch grpcstatus.Code(err) {
		case codes.NotFound:
			return pricedOrderItem{}, fmt.Errorf("%w: %s", ErrProductNotFound, item.ProductID)
		case codes.InvalidArgument:
			return pricedOrderItem{}, fmt.Errorf("%w: %s", ErrProductUnavailable, item.ProductID)
		default:
			return pricedOrderItem{}, fmt.Errorf("failed to fetch product %s: %w", item.ProductID, err)
		}
	}

	if product.StockQuantity < int32(item.Quantity) {
		return pricedOrderItem{}, fmt.Errorf(
			"%w: product %s only has %d item(s)",
			ErrInsufficientStock,
			product.Name,
			product.StockQuantity,
		)
	}

	return pricedOrderItem{
		ProductID: item.ProductID,
		Name:      product.Name,
		Price:     float64(product.Price),
		Quantity:  item.Quantity,
	}, nil
}

// newProductQuoteCache allocates the per-request cache used by quoteOrder.
//
// Inputs:
//   - capacity is a best-effort estimate based on request line items.
//
// Returns:
//   - an empty cache keyed by product id.
//
// Edge cases:
//   - non-positive capacity still produces a valid cache.
//
// Side effects:
//   - allocates one map.
//
// Performance:
//   - O(1); pre-sizing reduces map growth for larger carts.
func newProductQuoteCache(capacity int) *productQuoteCache {
	if capacity < 1 {
		capacity = 1
	}

	return &productQuoteCache{
		products: make(map[string]*pb.Product, capacity),
	}
}

// getOrLoad returns a cached product or fetches it from the catalog once.
//
// Inputs:
//   - ctx is forwarded to the loader.
//   - productID identifies the catalog item.
//   - loader performs the actual remote lookup when the cache misses.
//
// Returns:
//   - the resolved product.
//   - any loader error on cache miss.
//
// Edge cases:
//   - failed lookups are not cached because quoteOrder aborts immediately.
//
// Side effects:
//   - stores successful lookups in the cache map.
//
// Performance:
//   - O(1) average-case map access plus at most one remote call per unique id.
func (c *productQuoteCache) getOrLoad(
	ctx context.Context,
	productID string,
	loader func(context.Context, string) (*pb.Product, error),
) (*pb.Product, error) {
	if product, ok := c.products[productID]; ok {
		return product, nil
	}

	product, err := loader(ctx, productID)
	if err != nil {
		return nil, err
	}

	c.products[productID] = product
	return product, nil
}

// normalizeShippingMethod coerces API input into the supported shipping enum.
//
// Inputs:
//   - value is the raw shipping method string from the request.
//
// Returns:
//   - a normalized lowercase method, defaulting to standard delivery.
//   - ErrInvalidShippingMethod for unsupported values.
//
// Edge cases:
//   - blank values default to standard so older clients remain compatible.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1) excluding string trimming.
func normalizeShippingMethod(value string) (string, error) {
	method := strings.ToLower(strings.TrimSpace(value))
	if method == "" {
		return string(model.ShippingMethodStandard), nil
	}

	switch model.ShippingMethod(method) {
	case model.ShippingMethodStandard, model.ShippingMethodExpress, model.ShippingMethodPickup:
		return method, nil
	default:
		return "", ErrInvalidShippingMethod
	}
}

// normalizeShippingAddress trims the delivery address and rejects incomplete
// payloads.
//
// Inputs:
//   - address is the request DTO, which may be nil.
//
// Returns:
//   - a normalized domain shipping address.
//   - nil when required delivery fields are missing.
//
// Edge cases:
//   - the ward field remains optional to match current API behavior.
//
// Side effects:
//   - allocates one normalized address object when input is present.
//
// Performance:
//   - O(1) excluding string trimming.
func normalizeShippingAddress(address *dto.ShippingAddressRequest) *model.ShippingAddress {
	if address == nil {
		return nil
	}

	normalized := &model.ShippingAddress{
		RecipientName: strings.TrimSpace(address.RecipientName),
		Phone:         strings.TrimSpace(address.Phone),
		Street:        strings.TrimSpace(address.Street),
		Ward:          strings.TrimSpace(address.Ward),
		District:      strings.TrimSpace(address.District),
		City:          strings.TrimSpace(address.City),
	}

	if normalized.RecipientName == "" || normalized.Phone == "" || normalized.Street == "" || normalized.District == "" || normalized.City == "" {
		return nil
	}

	return normalized
}

// calculateShippingFee computes the delivery charge from the normalized method
// and subtotal.
//
// Inputs:
//   - method is the normalized shipping method.
//   - subtotal is the order subtotal before shipping and discounts.
//
// Returns:
//   - the shipping fee to add to the quote.
//
// Edge cases:
//   - standard delivery becomes free for orders at or above 100.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func calculateShippingFee(method string, subtotal float64) float64 {
	switch model.ShippingMethod(method) {
	case model.ShippingMethodPickup:
		return 0
	case model.ShippingMethodExpress:
		return 14.99
	default:
		if subtotal >= 100 {
			return 0
		}
		return 5.99
	}
}

// roundCurrency normalizes floating-point currency values to two decimal places.
//
// Inputs:
//   - value is the raw monetary amount.
//
// Returns:
//   - the rounded amount with two-decimal precision.
//
// Edge cases:
//   - standard IEEE floating-point caveats still apply.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func roundCurrency(value float64) float64 {
	return math.Round(value*100) / 100
}

// validateCoupon loads and validates one coupon against the current quote.
//
// Inputs:
//   - ctx propagates cancellation to the repository call.
//   - code is the raw coupon code from the request.
//   - subtotal is the pre-discount order subtotal.
//
// Returns:
//   - the coupon record when it can be applied.
//   - a domain error describing the first violated business rule.
//
// Edge cases:
//   - expired or exhausted coupons are rejected even if the code exists.
//
// Side effects:
//   - performs one repository lookup.
//
// Performance:
//   - O(1) application logic plus one repository call.
func (s *OrderService) validateCoupon(ctx context.Context, code string, subtotal float64) (*model.Coupon, error) {
	coupon, err := s.repo.GetCouponByCode(ctx, normalizeCouponCode(code))
	if err != nil {
		return nil, err
	}
	if coupon == nil {
		return nil, ErrCouponNotFound
	}
	if !coupon.Active {
		return nil, ErrCouponInactive
	}
	if coupon.ExpiresAt != nil && time.Now().After(*coupon.ExpiresAt) {
		return nil, ErrCouponExpired
	}
	if coupon.MinOrderAmount > subtotal {
		return nil, ErrCouponMinimumNotMet
	}
	if coupon.UsageLimit > 0 && coupon.UsedCount >= coupon.UsageLimit {
		return nil, ErrCouponUsageLimit
	}

	return coupon, nil
}

// normalizeCouponCode standardizes coupon codes before persistence and lookup.
//
// Inputs:
//   - code is the raw coupon string.
//
// Returns:
//   - a trimmed uppercase coupon code.
//
// Edge cases:
//   - blank inputs stay blank.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the coupon length due to trimming and uppercasing.
func normalizeCouponCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

// calculateDiscount computes the discount amount that a coupon contributes for a
// given subtotal.
//
// Inputs:
//   - coupon defines the discount strategy and amount.
//   - subtotal is the pre-discount order value.
//
// Returns:
//   - the discount amount capped at the subtotal.
//
// Edge cases:
//   - unsupported discount types fall back to zero to avoid panics.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func calculateDiscount(coupon *model.Coupon, subtotal float64) float64 {
	switch coupon.DiscountType {
	case model.CouponDiscountTypePercentage:
		return math.Min(subtotal, subtotal*(coupon.DiscountValue/100))
	case model.CouponDiscountTypeFixed:
		return math.Min(subtotal, coupon.DiscountValue)
	default:
		return 0
	}
}

// applyCouponToQuote mutates a quote with coupon metadata and recalculated
// totals.
//
// Inputs:
//   - quote is the in-progress order quote to mutate.
//   - coupon is the validated coupon record.
//
// Returns:
//   - none; callers observe the updated quote in place.
//
// Edge cases:
//   - discount values are rounded and capped by calculateDiscount.
//
// Side effects:
//   - mutates quote fields.
//
// Performance:
//   - O(1).
func applyCouponToQuote(quote *pricedOrderQuote, coupon *model.Coupon) {
	quote.CouponCode = coupon.Code
	quote.CouponDescription = strings.TrimSpace(coupon.Description)
	quote.DiscountAmount = roundCurrency(calculateDiscount(coupon, quote.SubtotalPrice))
	quote.TotalPrice = roundCurrency(quote.SubtotalPrice - quote.DiscountAmount + quote.ShippingFee)
}
