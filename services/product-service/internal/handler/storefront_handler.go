package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
)

// StorefrontHandler exposes public category/editorial data for storefront UIs.
type StorefrontHandler struct {
	storefrontService *service.StorefrontService
}

func NewStorefrontHandler(storefrontService *service.StorefrontService) *StorefrontHandler {
	return &StorefrontHandler{storefrontService: storefrontService}
}

// RegisterRoutes registers storefront category/editorial routes.
func (h *StorefrontHandler) RegisterRoutes(e *echo.Echo) {
	public := e.Group("/api/v1/storefront")
	public.GET("/home", h.GetHome)
	public.GET("/categories", h.ListCategories)
	public.GET("/categories/:identifier", h.GetCategoryPage)
}

func (h *StorefrontHandler) GetHome(c echo.Context) error {
	limit, err := parseStorefrontHomeLimit(c.QueryParam("limit"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "validation error", "invalid limit")
	}

	homeData, err := h.storefrontService.GetHome(c.Request().Context(), limit)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	if homeData == nil {
		homeData = &model.StorefrontHome{}
	}
	if homeData.CategoryPages == nil {
		homeData.CategoryPages = []*model.StorefrontCategoryPage{}
	}

	return response.Success(c, http.StatusOK, "storefront home retrieved", homeData)
}

func (h *StorefrontHandler) ListCategories(c echo.Context) error {
	categories, err := h.storefrontService.ListCategories(c.Request().Context())
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	if categories == nil {
		categories = []*model.StorefrontCategory{}
	}

	return response.Success(c, http.StatusOK, "storefront categories retrieved", categories)
}

func (h *StorefrontHandler) GetCategoryPage(c echo.Context) error {
	pageData, err := h.storefrontService.GetCategoryPage(c.Request().Context(), c.Param("identifier"))
	if err != nil {
		if errors.Is(err, service.ErrStorefrontCategoryNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "storefront category not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	if pageData.Sections == nil {
		pageData.Sections = []*model.StorefrontEditorialSection{}
	}
	if pageData.FeaturedProducts == nil {
		pageData.FeaturedProducts = []*model.StorefrontFeaturedProduct{}
	}

	return response.Success(c, http.StatusOK, "storefront category retrieved", pageData)
}

func parseStorefrontHomeLimit(raw string) (int, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return 0, nil
	}

	limit, err := strconv.Atoi(trimmed)
	if err != nil || limit < 1 {
		return 0, errors.New("invalid limit")
	}

	return limit, nil
}
