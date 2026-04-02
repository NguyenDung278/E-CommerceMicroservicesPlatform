package handler

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
)

type requestForwarder interface {
	Do(ctx context.Context, req *http.Request) (*http.Response, error)
	ForwardResponse(w http.ResponseWriter, resp *http.Response) error
}

// forwardWithProxy builds a shared Echo handler that forwards requests to a
// downstream service proxy.
//
// Inputs:
//   - serviceName is used in gateway error responses for operator clarity.
//   - p is the proxy implementation responsible for forwarding and copying responses.
//
// Returns:
//   - an Echo handler function that forwards the current request.
//
// Edge cases:
//   - nil proxies are not expected; callers should wire a concrete proxy during startup.
//
// Side effects:
//   - performs a downstream HTTP request through the proxy.
//
// Performance:
//   - O(1) gateway work aside from the delegated proxy network I/O; sharing this helper removes duplicated request/response forwarding code across handlers.
func forwardWithProxy(serviceName string, p requestForwarder) echo.HandlerFunc {
	return func(c echo.Context) error {
		resp, err := p.Do(c.Request().Context(), c.Request())
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to proxy request to " + serviceName,
			})
		}

		if err := p.ForwardResponse(c.Response(), resp); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to forward response from " + serviceName,
			})
		}

		return nil
	}
}
