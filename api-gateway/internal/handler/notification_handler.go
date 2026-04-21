package handler

import (
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo/v4"
)

type NotificationHandler struct {
	forward echo.HandlerFunc
}

func NewNotificationHandler(p *proxy.ServiceProxy) *NotificationHandler {
	return &NotificationHandler{
		forward: forwardWithProxy("notification service", p),
	}
}

func (h *NotificationHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	notifications := e.Group("/api/v1/notifications")
	notifications.Use(appmw.JWTAuth(jwtSecret))
	notifications.GET("/inbox", h.forward)
	notifications.PUT("/inbox/read", h.forward)
	notifications.Use(appmw.RequireRole(appmw.RoleAdmin, appmw.RoleStaff))
	notifications.GET("/audit", h.forward)
}
