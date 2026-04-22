package notificationpreferencehandler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service/engagement"
)

type NotificationPreferenceHandler struct {
	preferenceService *engagement.NotificationPreferenceService
}

func NewNotificationPreferenceHandler(
	preferenceService *engagement.NotificationPreferenceService,
) *NotificationPreferenceHandler {
	return &NotificationPreferenceHandler{preferenceService: preferenceService}
}

func (h *NotificationPreferenceHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	preferences := e.Group("/api/v1/users/notification-preferences")
	preferences.Use(middleware.JWTAuth(jwtSecret))
	preferences.GET("", h.List)
	preferences.PUT("", h.Update)
}

func requireUserClaims(c echo.Context) (*middleware.JWTClaims, error) {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return nil, response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	return claims, nil
}
