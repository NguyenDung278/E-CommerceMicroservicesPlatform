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

// RegisterRoutes registers user service routes
func (h *UserHandler) RegisterRoutes(g *echo.Group, jwtSecret string) {
	// Public endpoints
	g.POST("/register", h.forwardRequest)
	g.POST("/login", h.forwardRequest)

	// Protected endpoints (require valid JWT)
	protected := g.Group("")
	protected.Use(appmw.JWTAuth(jwtSecret))
	
	protected.GET("/profile", h.forwardRequest)
	protected.PUT("/profile", h.forwardRequest)
	protected.GET("/:id", h.forwardRequest)
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
