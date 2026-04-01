package handler

import (
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
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
	public.GET("/batch", h.ListByIDs)
	public.GET("/:id", h.GetByID)
	public.GET("/:id/reviews", h.ListReviews)

	// Admin-only routes.
	admin := e.Group("/api/v1/products")
	admin.Use(middleware.JWTAuth(jwtSecret))
	admin.Use(middleware.RequireRole(middleware.RoleAdmin, middleware.RoleStaff))
	admin.POST("", h.Create)
	admin.POST("/uploads", h.UploadImages)
	admin.PUT("/:id", h.Update)
	admin.DELETE("/:id", h.Delete)

	// Authenticated user review routes.
	reviews := e.Group("/api/v1/products/:id/reviews")
	reviews.Use(middleware.JWTAuth(jwtSecret))
	reviews.GET("/me", h.GetMyReview)
	reviews.POST("", h.CreateReview)
	reviews.PUT("/me", h.UpdateMyReview)
	reviews.DELETE("/me", h.DeleteMyReview)
}

// Create handles POST /api/v1/products
//
// Mục đích: Endpoint dành riêng cho Role Admin để đăng tải sản phẩm mới lên Catalog.
// Input: JSON body `dto.CreateProductRequest` chứa Name, Price, Stock, ImageURL...
// Output: 201 Created (Kèm theo data sản phẩm vừa tạo) hoặc 400 Bad Request.
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

func (h *ProductHandler) ListByIDs(c echo.Context) error {
	ids := parseRequestedProductIDs(c.QueryParams()["ids"])
	if len(ids) == 0 {
		return response.Error(c, http.StatusBadRequest, "validation failed", "at least one product id is required")
	}

	products, err := h.productService.ListByIDs(c.Request().Context(), ids)
	if err != nil {
		if errors.Is(err, service.ErrTooManyProductIDs) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "too many product ids")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	if products == nil {
		products = []*model.Product{}
	}

	return response.Success(c, http.StatusOK, "products retrieved", products)
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
//
// Mục đích: API chính để hiển thị danh sách sản phẩm trên trang chủ hoặc trang tìm kiếm.
// Input: Các query parameter như `page`, `limit`, `category`, `search` để phân trang và bọ lọc.
// Output: Trả về HTTP 200 kèm danh sách Products và Meta data phân trang (`total` items).
func (h *ProductHandler) List(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	minPrice, _ := strconv.ParseFloat(c.QueryParam("min_price"), 64)
	maxPrice, _ := strconv.ParseFloat(c.QueryParam("max_price"), 64)

	if minPrice < 0 || math.IsNaN(minPrice) {
		minPrice = 0
	}
	if maxPrice < 0 || math.IsNaN(maxPrice) {
		maxPrice = 0
	}

	query := dto.ListProductsQuery{
		Limit:    limit,
		Cursor:   c.QueryParam("cursor"),
		Category: c.QueryParam("category"),
		Brand:    c.QueryParam("brand"),
		Tag:      c.QueryParam("tag"),
		Status:   c.QueryParam("status"),
		Search:   c.QueryParam("search"),
		MinPrice: minPrice,
		MaxPrice: maxPrice,
		Size:     c.QueryParam("size"),
		Color:    c.QueryParam("color"),
		Sort:     c.QueryParam("sort"),
	}

	products, pageInfo, err := h.productService.List(c.Request().Context(), query)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCursor) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "invalid cursor")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	if products == nil {
		products = []*model.Product{}
	}

	if query.Limit < 1 {
		query.Limit = 20
	}
	hasNext := pageInfo != nil && pageInfo.HasNext

	return response.SuccessWithMeta(c, http.StatusOK, "products retrieved", products, &response.Meta{
		Limit:      query.Limit,
		NextCursor: pageInfo.NextCursor,
		HasNext:    &hasNext,
	})
}

func parseRequestedProductIDs(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}

	ids := make([]string, 0, len(values))
	for _, value := range values {
		for _, rawID := range strings.Split(value, ",") {
			clean := strings.TrimSpace(rawID)
			if clean == "" {
				continue
			}
			ids = append(ids, clean)
		}
	}

	return ids
}
