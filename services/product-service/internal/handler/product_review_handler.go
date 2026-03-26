package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
)

func (h *ProductHandler) ListReviews(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))

	query := dto.ListProductReviewsQuery{
		Page:  page,
		Limit: limit,
	}

	reviews, total, err := h.productService.ListReviews(c.Request().Context(), c.Param("id"), query)
	if err != nil {
		if errors.Is(err, service.ErrProductNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "product not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 || query.Limit > 50 {
		query.Limit = 10
	}

	return response.SuccessWithMeta(c, http.StatusOK, "product reviews retrieved", reviews, &response.Meta{
		Page:  query.Page,
		Limit: query.Limit,
		Total: total,
	})
}

func (h *ProductHandler) GetMyReview(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	review, err := h.productService.GetReviewByProductAndUser(c.Request().Context(), c.Param("id"), claims.UserID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrProductNotFound):
			return response.Error(c, http.StatusNotFound, "not found", "product not found")
		case errors.Is(err, service.ErrProductReviewNotFound):
			return response.Error(c, http.StatusNotFound, "not found", "product review not found")
		default:
			return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
		}
	}

	return response.Success(c, http.StatusOK, "product review retrieved", review)
}

func (h *ProductHandler) CreateReview(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	var req dto.CreateProductReviewRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	req.Comment = strings.TrimSpace(req.Comment)
	review, err := h.productService.CreateReview(c.Request().Context(), c.Param("id"), claims.UserID, claims.Email, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrProductNotFound):
			return response.Error(c, http.StatusNotFound, "not found", "product not found")
		case errors.Is(err, service.ErrProductReviewAlreadyExists):
			return response.Error(c, http.StatusConflict, "conflict", "product review already exists")
		default:
			return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
		}
	}

	return response.Success(c, http.StatusCreated, "product review created", review)
}

func (h *ProductHandler) UpdateMyReview(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	var req dto.UpdateProductReviewRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	req.Comment = strings.TrimSpace(req.Comment)
	review, err := h.productService.UpdateReview(c.Request().Context(), c.Param("id"), claims.UserID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrProductNotFound):
			return response.Error(c, http.StatusNotFound, "not found", "product not found")
		case errors.Is(err, service.ErrProductReviewNotFound):
			return response.Error(c, http.StatusNotFound, "not found", "product review not found")
		default:
			return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
		}
	}

	return response.Success(c, http.StatusOK, "product review updated", review)
}

func (h *ProductHandler) DeleteMyReview(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	err := h.productService.DeleteReview(c.Request().Context(), c.Param("id"), claims.UserID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrProductNotFound):
			return response.Error(c, http.StatusNotFound, "not found", "product not found")
		case errors.Is(err, service.ErrProductReviewNotFound):
			return response.Error(c, http.StatusNotFound, "not found", "product review not found")
		default:
			return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
		}
	}

	return response.Success(c, http.StatusOK, "product review deleted", nil)
}
