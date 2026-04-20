package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

type NotificationPreferenceHandler struct {
	preferenceService *service.NotificationPreferenceService
}

func NewNotificationPreferenceHandler(
	preferenceService *service.NotificationPreferenceService,
) *NotificationPreferenceHandler {
	return &NotificationPreferenceHandler{preferenceService: preferenceService}
}

func (h *NotificationPreferenceHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	preferences := e.Group("/api/v1/users/notification-preferences")
	preferences.Use(middleware.JWTAuth(jwtSecret))
	preferences.GET("", h.List)
	preferences.PUT("", h.Update)
}

func (h *NotificationPreferenceHandler) List(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	preferences, err := h.preferenceService.ListPreferences(c.Request().Context(), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to load notification preferences")
	}
	if preferences == nil {
		preferences = []*model.NotificationPreference{}
	}

	return response.Success(c, http.StatusOK, "notification preferences retrieved", preferences)
}

func (h *NotificationPreferenceHandler) Update(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	var req dto.UpdateNotificationPreferencesRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	preferences, err := h.preferenceService.UpdatePreferences(c.Request().Context(), claims.UserID, req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidNotificationPreferenceTopic) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "notification preference topic is invalid")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to update notification preferences")
	}

	return response.Success(c, http.StatusOK, "notification preferences updated", preferences)
}
