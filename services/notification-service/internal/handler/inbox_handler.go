package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/inbox"
	"github.com/labstack/echo/v4"
)

type NotificationInboxHandler struct {
	store inbox.HistoryStore
}

type markInboxReadRequest struct {
	MarkAll bool `json:"mark_all"`
}

type markInboxReadResult struct {
	UpdatedCount int `json:"updated_count"`
}

func NewNotificationInboxHandler(store inbox.HistoryStore) *NotificationInboxHandler {
	return &NotificationInboxHandler{store: store}
}

func (h *NotificationInboxHandler) List(c echo.Context) error {
	claims := appmw.GetUserClaims(c)
	if claims == nil || strings.TrimSpace(claims.UserID) == "" {
		return response.Error(c, http.StatusUnauthorized, "error", "missing user claims")
	}
	if h == nil || h.store == nil {
		return response.Error(c, http.StatusServiceUnavailable, "error", "notification inbox is unavailable")
	}

	limit := 20
	if rawLimit := strings.TrimSpace(c.QueryParam("limit")); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil {
			return response.Error(c, http.StatusBadRequest, "error", "invalid limit")
		}
		limit = parsedLimit
	}

	items, err := h.store.ListByUser(c.Request().Context(), claims.UserID, limit)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to list notification inbox")
	}

	return response.Success(c, http.StatusOK, "notification inbox retrieved", items)
}

func (h *NotificationInboxHandler) MarkRead(c echo.Context) error {
	claims := appmw.GetUserClaims(c)
	if claims == nil || strings.TrimSpace(claims.UserID) == "" {
		return response.Error(c, http.StatusUnauthorized, "error", "missing user claims")
	}
	if h == nil || h.store == nil {
		return response.Error(c, http.StatusServiceUnavailable, "error", "notification inbox is unavailable")
	}

	var request markInboxReadRequest
	if err := c.Bind(&request); err != nil {
		return response.Error(c, http.StatusBadRequest, "error", "invalid request body")
	}
	if !request.MarkAll {
		return response.Error(c, http.StatusBadRequest, "error", "mark_all must be true")
	}

	updatedCount, err := h.store.MarkAllRead(c.Request().Context(), claims.UserID, time.Now().UTC())
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to update notification inbox")
	}

	return response.Success(c, http.StatusOK, "notification inbox updated", markInboxReadResult{
		UpdatedCount: updatedCount,
	})
}

func (h *NotificationInboxHandler) Audit(c echo.Context) error {
	if h == nil || h.store == nil {
		return response.Error(c, http.StatusServiceUnavailable, "error", "notification audit is unavailable")
	}

	limit := 20
	if rawLimit := strings.TrimSpace(c.QueryParam("limit")); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil {
			return response.Error(c, http.StatusBadRequest, "error", "invalid limit")
		}
		limit = parsedLimit
	}

	items, err := h.store.ListRecent(c.Request().Context(), limit)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to list notification audit")
	}

	return response.Success(c, http.StatusOK, "notification audit retrieved", items)
}
