package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

// localOrigins are the supported local browser entrypoints: frontend
// Docker/Vite, preview builds, and the nginx edge.
var localOrigins = []string{
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
}

// FrontendCORS keeps CORS tight: local dev origins plus the origins passed in
// (typically frontend.base_url from config, so production domains are allowed
// without editing code). Empty and duplicate entries are dropped.
func FrontendCORS(extraOrigins ...string) echo.MiddlewareFunc {
	origins := make([]string, 0, len(localOrigins)+len(extraOrigins))
	seen := make(map[string]struct{}, len(localOrigins)+len(extraOrigins))
	for _, origin := range append(append([]string{}, localOrigins...), extraOrigins...) {
		origin = strings.TrimRight(strings.TrimSpace(origin), "/")
		if origin == "" {
			continue
		}
		if _, dup := seen[origin]; dup {
			continue
		}
		seen[origin] = struct{}{}
		origins = append(origins, origin)
	}

	return echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins: origins,
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
