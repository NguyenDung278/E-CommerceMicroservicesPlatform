package handler

import (
	"net/http"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestUserHandlerRegisterRoutesParity(t *testing.T) {
	e := echo.New()
	handler := &UserHandler{forward: testForwardHandler()}

	handler.RegisterRoutes(e, "test-secret")

	assertRoutesPresent(t, e,
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/register"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/register/email/send-otp"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/register/email/verify-otp"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/register/email/resend-otp"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/register/phone/send-otp"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/register/phone/verify-otp"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/register/phone/resend-otp"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/login"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/refresh"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/verify-email"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/forgot-password"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/reset-password"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/auth/oauth/google/start"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/auth/oauth/google/callback"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/oauth/exchange"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/users/profile"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/users/profile"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/users/avatar"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/users/profile/phone-verification"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/users/profile/phone-verification/send-otp"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/users/profile/phone-verification/verify-otp"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/users/profile/phone-verification/resend-otp"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/users/verify-email/status"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/users/verify-email/send-otp"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/users/verify-email/verify-otp"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/users/verify-email/resend-otp"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/users/password"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/users/verify-email/resend"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/users/addresses"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/users/addresses"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/users/addresses/:id"},
		routeExpectation{method: http.MethodDelete, path: "/api/v1/users/addresses/:id"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/users/addresses/:id/default"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/users/notification-preferences"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/users/notification-preferences"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/users/wishlist"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/users/wishlist/alerts"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/users/wishlist"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/users/wishlist/sync"},
		routeExpectation{method: http.MethodDelete, path: "/api/v1/users/wishlist/:productId"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/admin/users"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/admin/users/:id/role"},
	)

	assertRoutesAbsent(t, e,
		routeExpectation{method: http.MethodGet, path: "/api/v1/auth/register"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/auth/oauth/google/start"},
		routeExpectation{method: http.MethodDelete, path: "/api/v1/users/profile"},
	)
}

func TestCartHandlerRegisterRoutesParity(t *testing.T) {
	e := echo.New()
	handler := &CartHandler{forward: testForwardHandler()}

	handler.RegisterRoutes(e, "test-secret")

	assertRoutesPresent(t, e,
		routeExpectation{method: http.MethodGet, path: "/api/v1/cart"},
		routeExpectation{method: http.MethodDelete, path: "/api/v1/cart"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/cart/merge"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/cart/items"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/cart/items/:productId"},
		routeExpectation{method: http.MethodDelete, path: "/api/v1/cart/items/:productId"},
	)

	assertRoutesAbsent(t, e,
		routeExpectation{method: http.MethodPatch, path: "/api/v1/cart/items/:productId"},
	)
}

func TestOrderHandlerRegisterRoutesParity(t *testing.T) {
	e := echo.New()
	handler := &OrderHandler{forward: testForwardHandler()}

	handler.RegisterRoutes(e, "test-secret")

	assertRoutesPresent(t, e,
		routeExpectation{method: http.MethodGet, path: "/api/v1/coupons/public"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/orders/preview"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/orders"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/orders/summary"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/orders"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/orders/:id/events"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/orders/:id/tracking"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/orders/:id/return-eligibility"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/orders/:id"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/orders/:id/cancel"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/admin/orders/:id/tracking"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/admin/orders/:id/tracking"},
	)

	assertRoutesAbsent(t, e,
		routeExpectation{method: http.MethodPost, path: "/api/v1/orders/:id/cancel"},
		routeExpectation{method: http.MethodDelete, path: "/api/v1/orders/:id"},
	)
}

func TestPaymentHandlerRegisterRoutesParity(t *testing.T) {
	e := echo.New()
	handler := &PaymentHandler{forward: testForwardHandler()}

	handler.RegisterRoutes(e, "test-secret")

	assertRoutesPresent(t, e,
		routeExpectation{method: http.MethodPost, path: "/api/v1/payments"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/payments/history"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/payments/:id"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/payments/order/:orderId"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/payments/order/:orderId/history"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/admin/payments/history"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/payments/webhooks/momo"},
	)

	assertRoutesAbsent(t, e,
		routeExpectation{method: http.MethodGet, path: "/api/v1/payments/:id/verify"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/payments/order/:orderId/history"},
	)
}

func TestNotificationHandlerRegisterRoutesParity(t *testing.T) {
	e := echo.New()
	handler := &NotificationHandler{forward: testForwardHandler()}

	handler.RegisterRoutes(e, "test-secret")

	assertRoutesPresent(t, e,
		routeExpectation{method: http.MethodGet, path: "/api/v1/notifications/inbox"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/notifications/inbox/read"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/notifications/audit"},
	)

	assertRoutesAbsent(t, e,
		routeExpectation{method: http.MethodPost, path: "/api/v1/notifications/inbox"},
		routeExpectation{method: http.MethodDelete, path: "/api/v1/notifications/inbox/read"},
	)
}

func TestProductHandlerRegisterRoutesParity(t *testing.T) {
	e := echo.New()
	handler := &ProductHandler{forward: testForwardHandler()}

	handler.RegisterRoutes(e, "test-secret")

	assertRoutesPresent(t, e,
		routeExpectation{method: http.MethodGet, path: "/api/v1/products"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/products/batch"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/products/search/assist"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/products/analytics/search/events"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/products/:id"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/products/:id/reviews"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/products/analytics/search"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/products"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/products/uploads"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/products/:id"},
		routeExpectation{method: http.MethodDelete, path: "/api/v1/products/:id"},
	)

	assertRoutesAbsent(t, e,
		routeExpectation{method: http.MethodPost, path: "/api/v1/products/search/assist"},
		routeExpectation{method: http.MethodDelete, path: "/api/v1/products/uploads"},
	)
}

func TestStorefrontHandlerRegisterRoutesParity(t *testing.T) {
	e := echo.New()
	handler := &StorefrontHandler{forward: testForwardHandler()}

	handler.RegisterRoutes(e)

	assertRoutesPresent(t, e,
		routeExpectation{method: http.MethodGet, path: "/api/v1/storefront/home"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/storefront/categories"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/storefront/categories/:identifier"},
	)

	assertRoutesAbsent(t, e,
		routeExpectation{method: http.MethodPost, path: "/api/v1/storefront/home"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/storefront/categories"},
		routeExpectation{method: http.MethodDelete, path: "/api/v1/storefront/categories/:identifier"},
	)
}

type routeExpectation struct {
	method string
	path   string
}

func testForwardHandler() echo.HandlerFunc {
	return func(c echo.Context) error {
		return c.NoContent(http.StatusNoContent)
	}
}

func assertRoutesPresent(t *testing.T, e *echo.Echo, expectations ...routeExpectation) {
	t.Helper()

	routes := e.Routes()
	for _, expectation := range expectations {
		if !hasRoute(routes, expectation.method, expectation.path) {
			t.Fatalf("expected %s %s to be registered", expectation.method, expectation.path)
		}
	}
}

func assertRoutesAbsent(t *testing.T, e *echo.Echo, expectations ...routeExpectation) {
	t.Helper()

	routes := e.Routes()
	for _, expectation := range expectations {
		if hasRoute(routes, expectation.method, expectation.path) {
			t.Fatalf("did not expect %s %s to be registered", expectation.method, expectation.path)
		}
	}
}

func hasRoute(routes []*echo.Route, method, path string) bool {
	for _, route := range routes {
		if route.Method == method && route.Path == path {
			return true
		}
	}

	return false
}
