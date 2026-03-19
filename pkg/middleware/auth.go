// Package middleware provides reusable Echo middleware for all microservices.
//
// WHY SHARED MIDDLEWARE: Every service that accepts authenticated requests
// needs to validate JWT tokens the same way. Sharing this logic prevents
// subtle inconsistencies (one service accepts expired tokens, another doesn't).
package middleware

import (
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

const (
	RoleAdmin = "admin"
	RoleUser  = "user"
)

// JWTClaims represents the custom claims embedded in JWT tokens.
// We include UserID and Role so downstream handlers don't need
// to hit the User Service on every request.
type JWTClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// JWTAuth returns an Echo middleware that validates JWT tokens.
//
// FLOW:
//  1. Extract token from Authorization header ("Bearer <token>")
//  2. Parse and validate the token signature + expiration
//  3. Attach claims to the Echo context for downstream handlers
//
// SECURITY NOTES:
//   - Always use HS256 or RS256 — never "none" algorithm
//   - The secret must be at least 32 bytes for HS256
//   - Tokens are validated for both signature AND expiration
func JWTAuth(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Extract the Authorization header.
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "missing authorization header",
				})
			}

			// Expect "Bearer <token>" format.
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "invalid authorization header format",
				})
			}

			tokenString := parts[1]

			// Parse and validate the token.
			claims := &JWTClaims{}
			token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
				// SECURITY: Verify the signing method to prevent algorithm confusion attacks.
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, echo.NewHTTPError(http.StatusUnauthorized, "unexpected signing method")
				}
				return []byte(secret), nil
			})

			if err != nil || !token.Valid {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "invalid or expired token",
				})
			}

			// Attach claims to context so handlers can access user info.
			// Usage in handlers: claims := c.Get("user").(*middleware.JWTClaims)
			c.Set("user", claims)

			return next(c)
		}
	}
}

// GetUserClaims is a helper to extract JWT claims from the Echo context.
// Returns nil if no claims are found (e.g., unauthenticated route).
func GetUserClaims(c echo.Context) *JWTClaims {
	if claims, ok := c.Get("user").(*JWTClaims); ok {
		return claims
	}
	return nil
}

// RequireRole authorizes requests based on the role embedded in JWT claims.
func RequireRole(roles ...string) echo.MiddlewareFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[strings.ToLower(role)] = struct{}{}
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims := GetUserClaims(c)
			if claims == nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "missing user claims",
				})
			}

			if _, ok := allowed[strings.ToLower(claims.Role)]; !ok {
				return c.JSON(http.StatusForbidden, map[string]string{
					"error": "insufficient permissions",
				})
			}

			return next(c)
		}
	}
}
