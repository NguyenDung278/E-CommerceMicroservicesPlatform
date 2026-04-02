package handler

import (
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// UserHandler handles user service requests
type UserHandler struct {
	forward echo.HandlerFunc
}

// NewUserHandler creates a new user handler
func NewUserHandler(p *proxy.ServiceProxy) *UserHandler {
	return &UserHandler{
		forward: forwardWithProxy("user service", p),
	}
}

// RegisterRoutes registers user service routes.
// The gateway mirrors the backend route contract so requests can be forwarded
// without rewriting path segments.
func (h *UserHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	auth := e.Group("/api/v1/auth")
	auth.POST("/register", h.forward)
	auth.POST("/login", h.forward)
	auth.POST("/refresh", h.forward)
	auth.POST("/verify-email", h.forward)
	auth.POST("/forgot-password", h.forward)
	auth.POST("/reset-password", h.forward)
	auth.GET("/oauth/google/start", h.forward)
	auth.GET("/oauth/google/callback", h.forward)
	auth.POST("/oauth/exchange", h.forward)

	users := e.Group("/api/v1/users")
	users.Use(appmw.JWTAuth(jwtSecret))
	users.GET("/profile", h.forward)
	users.PUT("/profile", h.forward)
	users.GET("/profile/phone-verification", h.forward)
	users.POST("/profile/phone-verification/send-otp", h.forward)
	users.POST("/profile/phone-verification/verify-otp", h.forward)
	users.POST("/profile/phone-verification/resend-otp", h.forward)
	users.PUT("/password", h.forward)
	users.POST("/verify-email/resend", h.forward)
	users.POST("/addresses", h.forward)
	users.GET("/addresses", h.forward)
	users.PUT("/addresses/:id", h.forward)
	users.DELETE("/addresses/:id", h.forward)
	users.PUT("/addresses/:id/default", h.forward)

	adminUsers := e.Group("/api/v1/admin/users")
	adminUsers.Use(appmw.JWTAuth(jwtSecret))
	adminUsers.Use(appmw.RequireRole(appmw.RoleAdmin))
	adminUsers.GET("", h.forward)
	adminUsers.PUT("/:id/role", h.forward)
}
