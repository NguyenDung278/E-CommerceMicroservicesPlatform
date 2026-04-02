package service

import (
	"context"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

const (
	refreshTokenTTL = 7 * 24 * time.Hour
	hours           = time.Hour
)

// RefreshToken validates a refresh token, reloads the user, and returns a fresh
// token pair.
//
// Inputs:
//   - ctx carries cancellation to the user lookup.
//   - refreshTokenString is the raw refresh token from the client.
//
// Returns:
//   - a fresh authentication response when the refresh token is valid.
//   - ErrInvalidToken or ErrUserNotFound when validation fails.
//
// Edge cases:
//   - tokens signed with unexpected algorithms are rejected.
//
// Side effects:
//   - none beyond token parsing and signing.
//
// Performance:
//   - dominated by JWT parsing, one repository lookup, and token signing.
func (s *UserService) RefreshToken(ctx context.Context, refreshTokenString string) (*dto.AuthResponse, error) {
	claims := &middleware.JWTClaims{}
	token, err := jwt.ParseWithClaims(refreshTokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(s.jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	user, err := s.loadUserByID(ctx, s.repo, claims.UserID)
	if err != nil {
		return nil, err
	}

	return s.buildAuthResponse(user)
}

// generateTokenPair signs the access and refresh tokens for an authenticated user.
//
// Inputs:
//   - user is the authenticated user record.
//
// Returns:
//   - the access token.
//   - the refresh token.
//   - any token-signing error.
//
// Edge cases:
//   - callers must supply a non-nil user.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1) application work plus JWT signing; the current timestamp is computed once to avoid repeated syscalls.
func (s *UserService) generateTokenPair(user *model.User) (string, string, error) {
	now := currentTime()

	accessClaims := middleware.JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(s.jwtExpiry) * hours)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	at := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err := at.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", "", err
	}

	refreshClaims := middleware.JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(refreshTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	rt := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err := rt.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}
