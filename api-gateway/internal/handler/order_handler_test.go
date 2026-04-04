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
		routeExpectation{method: http.MethodPost, path: "/api/v1/cart/items"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/cart/items/:productId"},
		routeExpectation{method: http.MethodDelete, path: "/api/v1/cart/items/:productId"},
	)

	assertRoutesAbsent(t, e,
		routeExpectation{method: http.MethodPost, path: "/api/v1/cart/merge"},
		routeExpectation{method: http.MethodPatch, path: "/api/v1/cart/items/:productId"},
	)
}

func TestOrderHandlerRegisterRoutesParity(t *testing.T) {
	e := echo.New()
	handler := &OrderHandler{forward: testForwardHandler()}

	handler.RegisterRoutes(e, "test-secret")

	assertRoutesPresent(t, e,
		routeExpectation{method: http.MethodPost, path: "/api/v1/orders/preview"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/orders"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/orders/summary"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/orders"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/orders/:id/events"},
		routeExpectation{method: http.MethodGet, path: "/api/v1/orders/:id"},
		routeExpectation{method: http.MethodPut, path: "/api/v1/orders/:id/cancel"},
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
		routeExpectation{method: http.MethodPost, path: "/api/v1/payments/webhooks/momo"},
	)

	assertRoutesAbsent(t, e,
		routeExpectation{method: http.MethodGet, path: "/api/v1/payments/:id/verify"},
		routeExpectation{method: http.MethodPost, path: "/api/v1/payments/order/:orderId/history"},
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
