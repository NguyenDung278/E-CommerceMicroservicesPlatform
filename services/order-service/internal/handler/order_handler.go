package handler

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/service"
)

type OrderHandler struct {
	orderService *service.OrderService
}

func NewOrderHandler(orderService *service.OrderService) *OrderHandler {
	return &OrderHandler{orderService: orderService}
}

func (h *OrderHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	catalog := e.Group("/api/v1/catalog")
	catalog.GET("/popularity", h.ListPopularProducts)

	orders := e.Group("/api/v1/orders")
	orders.Use(middleware.JWTAuth(jwtSecret))
	orders.POST("/preview", h.PreviewOrder)
	orders.POST("", h.CreateOrder)
	orders.GET("", h.GetUserOrders)
	orders.GET("/:id/events", h.GetOrderTimeline)
	orders.GET("/:id", h.GetOrder)
	orders.PUT("/:id/cancel", h.CancelOrder)

	legacyAdmin := orders.Group("/admin")
	legacyAdmin.Use(middleware.RequireRole(middleware.RoleAdmin, middleware.RoleStaff))
	legacyAdmin.GET("/report", h.GetAdminReport)

	adminOrders := e.Group("/api/v1/admin/orders")
	adminOrders.Use(middleware.JWTAuth(jwtSecret))
	adminOrders.Use(middleware.RequireRole(middleware.RoleAdmin, middleware.RoleStaff))
	adminOrders.GET("/report", h.GetAdminReport)
	adminOrders.GET("", h.ListAdminOrders)
	adminOrders.GET("/:id/events", h.GetAdminOrderTimeline)
	adminOrders.GET("/:id", h.GetAdminOrder)
	adminOrders.PUT("/:id/cancel", h.CancelOrderAsAdmin)
	adminOrders.PUT("/:id/status", h.UpdateOrderStatus)

	adminCoupons := e.Group("/api/v1/admin/coupons")
	adminCoupons.Use(middleware.JWTAuth(jwtSecret))
	adminCoupons.Use(middleware.RequireRole(middleware.RoleAdmin, middleware.RoleStaff))
	adminCoupons.POST("", h.CreateCoupon)
	adminCoupons.GET("", h.ListCoupons)
}

// CreateOrder handles POST /api/v1/orders
//
// Mục đích: Tiếp nhận HTTP request để tạo đơn hàng mới.
// Input: JSON body `dto.CreateOrderRequest` chứa danh sách các Items cần mua.
// Output:
//   - 201 Created nếu tạo đơn thành công.
//   - 400 Bad Request nếu JSON lỗi hoặc số lượng âm.
//   - 404 Not Found nếu Product ID trong giỏ không tồn tại.
func (h *OrderHandler) CreateOrder(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	var req dto.CreateOrderRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	order, err := h.orderService.CreateOrder(c.Request().Context(), claims.UserID, claims.Email, req)
	if err != nil {
		return writePricingError(c, err, "failed to create order")
	}
	return response.Success(c, http.StatusCreated, "order created", order)
}

func (h *OrderHandler) PreviewOrder(c echo.Context) error {
	var req dto.CreateOrderRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	preview, err := h.orderService.PreviewOrder(c.Request().Context(), req)
	if err != nil {
		return writePricingError(c, err, "failed to preview order")
	}

	return response.Success(c, http.StatusOK, "order preview retrieved", preview)
}

func (h *OrderHandler) GetOrder(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	id := c.Param("id")

	order, err := h.orderService.GetOrder(c.Request().Context(), id, claims.UserID)
	if err != nil {
		if errors.Is(err, service.ErrOrderNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "order not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "order retrieved", order)
}

func (h *OrderHandler) GetUserOrders(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	orders, err := h.orderService.GetUserOrders(c.Request().Context(), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "orders retrieved", orders)
}

// CancelOrder handles PUT /api/v1/orders/:id/cancel
//
// Mục đích: Hủy bỏ một đơn hàng đang ở trạng thái Pending.
// Luồng xử lý: Yêu cầu quyền sở hữu của Order. Gọi sang Service để đổi trạng thái, khôi phục tồn kho và phát sự kiện.
func (h *OrderHandler) CancelOrder(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	id := c.Param("id")

	err := h.orderService.CancelOrder(c.Request().Context(), id, claims.UserID)
	if err != nil {
		if errors.Is(err, service.ErrOrderNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "order not found")
		}
		if errors.Is(err, service.ErrOrderNotCancellable) {
			return response.Error(c, http.StatusBadRequest, "not cancellable", "only pending orders can be cancelled")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to cancel order")
	}

	return response.Success(c, http.StatusOK, "order cancelled", nil)
}

func (h *OrderHandler) GetOrderTimeline(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	events, err := h.orderService.GetOrderTimeline(c.Request().Context(), c.Param("id"), claims.UserID, claims.Role)
	if err != nil {
		if errors.Is(err, service.ErrOrderNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "order not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "order timeline retrieved", events)
}

func (h *OrderHandler) ListAdminOrders(c echo.Context) error {
	page, limit := parsePageAndLimit(c)
	filters := model.OrderFilters{
		UserID: strings.TrimSpace(c.QueryParam("user_id")),
		Status: model.OrderStatus(strings.TrimSpace(c.QueryParam("status"))),
		Page:   page,
		Limit:  limit,
	}

	from, err := parseTimeQuery(c.QueryParam("from"), false)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", "invalid from date")
	}
	to, err := parseTimeQuery(c.QueryParam("to"), true)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", "invalid to date")
	}
	filters.From = from
	filters.To = to

	orders, total, err := h.orderService.ListAdminOrders(c.Request().Context(), filters)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to list orders")
	}

	return response.SuccessWithMeta(c, http.StatusOK, "orders retrieved", orders, &response.Meta{
		Page:  page,
		Limit: limit,
		Total: total,
	})
}

func (h *OrderHandler) GetAdminOrder(c echo.Context) error {
	order, err := h.orderService.GetOrderForAdmin(c.Request().Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, service.ErrOrderNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "order not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "order retrieved", order)
}

func (h *OrderHandler) GetAdminOrderTimeline(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	events, err := h.orderService.GetOrderTimeline(c.Request().Context(), c.Param("id"), claims.UserID, claims.Role)
	if err != nil {
		if errors.Is(err, service.ErrOrderNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "order not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "order timeline retrieved", events)
}

func (h *OrderHandler) UpdateOrderStatus(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	var req dto.UpdateOrderStatusRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	err := h.orderService.UpdateStatus(
		c.Request().Context(),
		c.Param("id"),
		model.OrderStatus(req.Status),
		claims.UserID,
		claims.Role,
		req.Message,
	)
	if err != nil {
		if errors.Is(err, service.ErrOrderNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "order not found")
		}
		if errors.Is(err, service.ErrInvalidOrderStatus) {
			return response.Error(c, http.StatusBadRequest, "validation failed", err.Error())
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to update order status")
	}

	order, err := h.orderService.GetOrderForAdmin(c.Request().Context(), c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to load updated order")
	}
	return response.Success(c, http.StatusOK, "order status updated", order)
}

func (h *OrderHandler) CreateCoupon(c echo.Context) error {
	var req dto.CreateCouponRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	coupon, err := h.orderService.CreateCoupon(c.Request().Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrCouponAlreadyExists) {
			return response.Error(c, http.StatusConflict, "duplicate", err.Error())
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to create coupon")
	}
	return response.Success(c, http.StatusCreated, "coupon created", coupon)
}

func (h *OrderHandler) ListCoupons(c echo.Context) error {
	coupons, err := h.orderService.ListCoupons(c.Request().Context())
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to list coupons")
	}
	return response.Success(c, http.StatusOK, "coupons retrieved", coupons)
}

func (h *OrderHandler) CancelOrderAsAdmin(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	var req dto.AdminCancelOrderRequest
	if err := c.Bind(&req); err != nil && !errors.Is(err, io.EOF) && err != echo.ErrUnsupportedMediaType {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	err := h.orderService.CancelOrderAsAdmin(
		c.Request().Context(),
		c.Param("id"),
		claims.UserID,
		claims.Role,
		req.Message,
	)
	if err != nil {
		if errors.Is(err, service.ErrOrderNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "order not found")
		}
		if errors.Is(err, service.ErrAdminCancelNotAllowed) {
			return response.Error(c, http.StatusBadRequest, "not cancellable", "only pending or paid orders can be cancelled manually")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to cancel order")
	}

	order, err := h.orderService.GetOrderForAdmin(c.Request().Context(), c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to load updated order")
	}
	return response.Success(c, http.StatusOK, "order cancelled", order)
}

func (h *OrderHandler) GetAdminReport(c echo.Context) error {
	days, _ := strconv.Atoi(c.QueryParam("days"))

	report, err := h.orderService.GetAdminReport(c.Request().Context(), days)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to build admin report")
	}

	return response.Success(c, http.StatusOK, "admin report retrieved", report)
}

func (h *OrderHandler) ListPopularProducts(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	items, err := h.orderService.ListPopularProducts(c.Request().Context(), limit)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to load product popularity")
	}

	return response.Success(c, http.StatusOK, "product popularity retrieved", items)
}

func parsePageAndLimit(c echo.Context) (int, int) {
	page := 1
	limit := 20

	if raw := strings.TrimSpace(c.QueryParam("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if raw := strings.TrimSpace(c.QueryParam("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	return page, limit
}

func writePricingError(c echo.Context, err error, fallbackMessage string) error {
	if errors.Is(err, service.ErrEmptyOrder) {
		return response.Error(c, http.StatusBadRequest, "validation failed", err.Error())
	}
	if errors.Is(err, service.ErrInvalidShippingMethod) || errors.Is(err, service.ErrShippingAddressRequired) {
		return response.Error(c, http.StatusBadRequest, "validation failed", err.Error())
	}
	if errors.Is(err, service.ErrProductNotFound) {
		return response.Error(c, http.StatusNotFound, "product not found", err.Error())
	}
	if errors.Is(err, service.ErrProductUnavailable) {
		return response.Error(c, http.StatusBadRequest, "invalid product", err.Error())
	}
	if errors.Is(err, service.ErrInsufficientStock) {
		return response.Error(c, http.StatusConflict, "insufficient stock", err.Error())
	}
	if errors.Is(err, service.ErrCouponNotFound) {
		return response.Error(c, http.StatusNotFound, "coupon not found", err.Error())
	}
	if errors.Is(err, service.ErrCouponInactive) ||
		errors.Is(err, service.ErrCouponExpired) ||
		errors.Is(err, service.ErrCouponMinimumNotMet) {
		return response.Error(c, http.StatusBadRequest, "coupon invalid", err.Error())
	}
	if errors.Is(err, service.ErrCouponUsageLimit) {
		return response.Error(c, http.StatusConflict, "coupon unavailable", err.Error())
	}

	return response.Error(c, http.StatusInternalServerError, "error", fallbackMessage)
}

func parseTimeQuery(value string, inclusiveEnd bool) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}

	for _, layout := range []string{time.RFC3339, "2006-01-02"} {
		parsed, err := time.Parse(layout, value)
		if err != nil {
			continue
		}
		if layout == "2006-01-02" && inclusiveEnd {
			parsed = parsed.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
		}
		utc := parsed.UTC()
		return &utc, nil
	}

	return nil, errors.New("invalid time")
}
