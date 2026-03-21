package handler

import (
	"net/http"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// UserHandler handles user service requests
type UserHandler struct {
	proxy *proxy.ServiceProxy
}

// NewUserHandler creates a new user handler
func NewUserHandler(p *proxy.ServiceProxy) *UserHandler {
	return &UserHandler{
		proxy: p,
	}
}

// RegisterRoutes registers user service routes.
// The gateway mirrors the backend route contract so requests can be forwarded
// without rewriting path segments.
func (h *UserHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	auth := e.Group("/api/v1/auth")
	auth.POST("/register", h.forwardRequest)
	auth.POST("/login", h.forwardRequest)
	auth.POST("/refresh", h.forwardRequest)
	auth.POST("/verify-email", h.forwardRequest)
	auth.POST("/forgot-password", h.forwardRequest)
	auth.POST("/reset-password", h.forwardRequest)

	users := e.Group("/api/v1/users")
	users.Use(appmw.JWTAuth(jwtSecret))
	users.GET("/profile", h.forwardRequest)
	users.PUT("/profile", h.forwardRequest)
	users.PUT("/password", h.forwardRequest)
	users.POST("/verify-email/resend", h.forwardRequest)

	adminUsers := e.Group("/api/v1/admin/users")
	adminUsers.Use(appmw.JWTAuth(jwtSecret))
	adminUsers.Use(appmw.RequireRole(appmw.RoleAdmin))
	adminUsers.GET("", h.forwardRequest)
	adminUsers.PUT("/:id/role", h.forwardRequest)
}

// forwardRequest proxies the request to the user service
func (h *UserHandler) forwardRequest(c echo.Context) error {
	req := c.Request()
	resp, err := h.proxy.Do(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to proxy request to user service",
		})
	}

	if err := h.proxy.ForwardResponse(c.Response(), resp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to forward response from user service",
		})
	}

	return nil
}
