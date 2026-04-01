package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

func FrontendCORS() echo.MiddlewareFunc {
	return echomw.CORSWithConfig(echomw.CORSConfig{
		// Keep CORS tight around the supported local browser entrypoints:
		// frontend Docker/Vite, client Next.js standalone/dev, and the nginx edge.
		AllowOrigins: []string{
			"http://localhost",
			"http://127.0.0.1",
			"http://localhost:80",
			"http://127.0.0.1:80",
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://localhost:4173",
			"http://127.0.0.1:4173",
			"http://localhost:5173",
			"http://127.0.0.1:5173",
			"http://localhost:5174",
			"http://127.0.0.1:5174",
		},
		AllowMethods: []string{
			http.MethodGet,
			http.MethodHead,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowHeaders: []string{
			echo.HeaderOrigin,
			echo.HeaderAccept,
			echo.HeaderAuthorization,
			echo.HeaderContentType,
		},
	})
}
