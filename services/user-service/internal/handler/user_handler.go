package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

// UserHandler handles HTTP requests for user operations.
type UserHandler struct {
	userService *service.UserService
}

// NewUserHandler creates a new user handler.
func NewUserHandler(userService *service.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

// RegisterRoutes registers all user-related routes on the Echo instance.
//
// ROUTE DESIGN:
//   - POST /api/v1/auth/register — Public (no auth required)
//   - POST /api/v1/auth/login    — Public
//   - GET  /api/v1/users/profile — Protected (requires valid JWT)
//   - PUT  /api/v1/users/profile — Protected
func (h *UserHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	// Public routes — no authentication required.
	auth := e.Group("/api/v1/auth")
	auth.POST("/register", h.Register)
	auth.POST("/login", h.Login)

	// Protected routes — require valid JWT token.
	users := e.Group("/api/v1/users")
	users.Use(middleware.JWTAuth(jwtSecret))
	users.GET("/profile", h.GetProfile)
	users.PUT("/profile", h.UpdateProfile)
}

// Register handles POST /api/v1/auth/register
func (h *UserHandler) Register(c echo.Context) error {
	var req dto.RegisterRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.Register(c.Request().Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrEmailAlreadyExists) {
			return response.Error(c, http.StatusConflict, "registration failed", "email already exists")
		}
		if errors.Is(err, service.ErrPhoneAlreadyExists) {
			return response.Error(c, http.StatusConflict, "registration failed", "phone already exists")
		}
		return response.Error(c, http.StatusInternalServerError, "registration failed", "internal server error")
	}

	return response.Success(c, http.StatusCreated, "user registered successfully", result)
}

// Login handles POST /api/v1/auth/login
func (h *UserHandler) Login(c echo.Context) error {
	var req dto.LoginRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}
	if strings.TrimSpace(req.Identifier) == "" && strings.TrimSpace(req.Email) == "" {
		return response.Error(c, http.StatusBadRequest, "validation failed", "identifier is required")
	}

	result, err := h.userService.Login(c.Request().Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			return response.Error(c, http.StatusUnauthorized, "login failed", "invalid email/phone or password")
		}
		return response.Error(c, http.StatusInternalServerError, "login failed", "internal server error")
	}

	return response.Success(c, http.StatusOK, "login successful", result)
}

// GetProfile handles GET /api/v1/users/profile
func (h *UserHandler) GetProfile(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	user, err := h.userService.GetProfile(c.Request().Context(), claims.UserID)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "user not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	return response.Success(c, http.StatusOK, "profile retrieved", user)
}

// UpdateProfile handles PUT /api/v1/users/profile
func (h *UserHandler) UpdateProfile(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	var req dto.UpdateProfileRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	user, err := h.userService.UpdateProfile(c.Request().Context(), claims.UserID, req)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "user not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	return response.Success(c, http.StatusOK, "profile updated", user)
}
