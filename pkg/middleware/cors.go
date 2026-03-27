package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

func FrontendCORS() echo.MiddlewareFunc {
	return echomw.CORSWithConfig(echomw.CORSConfig{
		// Keep CORS tight around the primary local UI path (`frontend/`) and the
		// nginx edge entrypoint. The experimental Next.js client is intentionally
		// not part of the default runtime until it is promoted to the main path.
		AllowOrigins: []string{
			"http://localhost",
			"http://127.0.0.1",
			"http://localhost:80",
			"http://127.0.0.1:80",
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
