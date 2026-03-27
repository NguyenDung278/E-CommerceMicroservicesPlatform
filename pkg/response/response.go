// Package response provides standardized API response formats.
//
// WHY: Consistent response structures across all microservices make
// the API predictable for frontend developers and simplify error handling.
// Every response follows the same JSON envelope:
//
//	{
//	  "success": true/false,
//	  "message": "human-readable message",
//	  "data":    { ... } | null,
//	  "error":   "error detail" | null,
//	  "meta":    { "page": 1, "limit": 20, "total": 100 } | null
//	}
package response

import (
	"github.com/labstack/echo/v4"
)

// Response is the standard API response envelope.
type Response struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

// Meta holds pagination metadata.
type Meta struct {
	Page       int    `json:"page,omitempty"`
	Limit      int    `json:"limit,omitempty"`
	Total      int64  `json:"total,omitempty"`
	NextCursor string `json:"next_cursor,omitempty"`
	HasNext    *bool  `json:"has_next,omitempty"`
}

// Success sends a successful JSON response.
func Success(c echo.Context, statusCode int, message string, data interface{}) error {
	return c.JSON(statusCode, Response{
		Success: true,
		Message: message,
		Data:    data,
	})
}

// SuccessWithMeta sends a successful response with pagination metadata.
func SuccessWithMeta(c echo.Context, statusCode int, message string, data interface{}, meta *Meta) error {
	return c.JSON(statusCode, Response{
		Success: true,
		Message: message,
		Data:    data,
		Meta:    meta,
	})
}

// Error sends an error JSON response.
func Error(c echo.Context, statusCode int, message string, err string) error {
	return c.JSON(statusCode, Response{
		Success: false,
		Message: message,
		Error:   err,
	})
}
