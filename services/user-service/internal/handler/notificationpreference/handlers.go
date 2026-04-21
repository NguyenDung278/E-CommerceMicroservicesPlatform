package notificationpreferencehandler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

func (h *NotificationPreferenceHandler) List(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
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
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
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
