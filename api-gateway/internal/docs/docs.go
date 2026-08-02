// Package docs phục vụ contract OpenAPI của gateway kèm Swagger UI.
//
// WHY: api-gateway là entrypoint public duy nhất, nên nó cũng là nơi duy nhất
// mô tả được toàn bộ contract mà client gọi được. Spec nằm ở openapi.yaml và
// được nhúng thẳng vào binary — không cần mount file hay chạy thêm container.
//
// Package này cố tình không có business logic: nó chỉ trả file tĩnh, đúng với
// nguyên tắc "gateway là lớp mỏng, dễ đoán".
package docs

import (
	_ "embed"
	"net/http"

	"github.com/labstack/echo/v4"
)

// swaggerUIVersion ghim phiên bản asset Swagger UI lấy từ CDN.
//
// WHY GHIM: bản "latest" có thể đổi hành vi bất ngờ giữa hai lần deploy. Ghim
// phiên bản để trang docs render giống nhau ở mọi môi trường.
const swaggerUIVersion = "5.17.14"

// SpecPath và UIPath là đường dẫn public của spec và trang Swagger UI.
const (
	SpecPath = "/openapi.yaml"
	UIPath   = "/swagger"
)

//go:embed openapi.yaml
var specYAML []byte

// swaggerUIPage là trang HTML tối thiểu nạp Swagger UI và trỏ vào SpecPath.
//
// Asset lấy từ CDN nên trang này cần internet. Spec thì luôn phục vụ được
// offline vì đã nhúng trong binary — khi mất mạng vẫn `curl /openapi.yaml` được.
const swaggerUIPage = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>E-Commerce Platform — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@` + swaggerUIVersion + `/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@` + swaggerUIVersion + `/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: '` + SpecPath + `',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        tryItOutEnabled: true,
      });
    };
  </script>
</body>
</html>`

// Spec trả về nội dung spec đã nhúng.
//
// Dùng trong test để so khớp spec với route thật mà không phải đọc lại file.
func Spec() []byte {
	return specYAML
}

// RegisterRoutes gắn hai route tài liệu vào Echo.
//
// Inputs:
//   - e là Echo instance của gateway.
//
// Side effects:
//   - đăng ký GET SpecPath và GET UIPath.
//
// Edge cases:
//   - UIPath được đăng ký cả bản có và không có dấu "/" ở cuối để người dùng gõ
//     kiểu nào cũng ra trang docs; bản có "/" redirect về bản chuẩn để chỉ tồn
//     tại một URL duy nhất trong lịch sử trình duyệt.
func RegisterRoutes(e *echo.Echo) {
	e.GET(SpecPath, func(c echo.Context) error {
		return c.Blob(http.StatusOK, "application/yaml; charset=utf-8", specYAML)
	})

	e.GET(UIPath, func(c echo.Context) error {
		return c.HTML(http.StatusOK, swaggerUIPage)
	})

	e.GET(UIPath+"/", func(c echo.Context) error {
		return c.Redirect(http.StatusMovedPermanently, UIPath)
	})
}
