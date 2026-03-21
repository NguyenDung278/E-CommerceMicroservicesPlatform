package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
)

// ProductHandler handles HTTP requests for product operations.
type ProductHandler struct {
	productService *service.ProductService
}

func NewProductHandler(productService *service.ProductService) *ProductHandler {
	return &ProductHandler{productService: productService}
}

// RegisterRoutes registers product routes.
//
// ROUTE DESIGN:
//   - GET    /api/v1/products       — Public (anyone can browse)
//   - GET    /api/v1/products/:id   — Public
//   - POST   /api/v1/products       — Protected (admin only)
//   - PUT    /api/v1/products/:id   — Protected (admin only)
//   - DELETE /api/v1/products/:id   — Protected (admin only)
func (h *ProductHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	// Public routes.
	public := e.Group("/api/v1/products")
	public.GET("", h.List)
	public.GET("/:id", h.GetByID)

	// Admin-only routes.
	admin := e.Group("/api/v1/products")
	admin.Use(middleware.JWTAuth(jwtSecret))
	admin.Use(middleware.RequireRole(middleware.RoleAdmin))
	admin.POST("", h.Create)
	admin.PUT("/:id", h.Update)
	admin.DELETE("/:id", h.Delete)
}

func (h *ProductHandler) Create(c echo.Context) error {
	var req dto.CreateProductRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	product, err := h.productService.Create(c.Request().Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidStatus) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "status must be draft, active or inactive")
		}
		return response.Error(c, http.StatusInternalServerError, "creation failed", "internal server error")
	}
	return response.Success(c, http.StatusCreated, "product created", product)
}

func (h *ProductHandler) GetByID(c echo.Context) error {
	id := c.Param("id")
	product, err := h.productService.GetByID(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrProductNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "product not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "product retrieved", product)
}

func (h *ProductHandler) Update(c echo.Context) error {
	id := c.Param("id")
	var req dto.UpdateProductRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	product, err := h.productService.Update(c.Request().Context(), id, req)
	if err != nil {
		if errors.Is(err, service.ErrProductNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "product not found")
		}
		if errors.Is(err, service.ErrInvalidStatus) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "status must be draft, active or inactive")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "product updated", product)
}

func (h *ProductHandler) Delete(c echo.Context) error {
	id := c.Param("id")
	if err := h.productService.Delete(c.Request().Context(), id); err != nil {
		if errors.Is(err, service.ErrProductNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "product not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "product deleted", nil)
}

// List handles GET /api/v1/products?page=1&limit=20&category=electronics&search=laptop
func (h *ProductHandler) List(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))

	query := dto.ListProductsQuery{
		Page:     page,
		Limit:    limit,
		Category: c.QueryParam("category"),
		Brand:    c.QueryParam("brand"),
		Tag:      c.QueryParam("tag"),
		Status:   c.QueryParam("status"),
		Search:   c.QueryParam("search"),
	}

	products, total, err := h.productService.List(c.Request().Context(), query)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 {
		query.Limit = 20
	}

	return response.SuccessWithMeta(c, http.StatusOK, "products retrieved", products, &response.Meta{
		Page:  query.Page,
		Limit: query.Limit,
		Total: total,
	})
}
