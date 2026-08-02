package docs_test

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"gopkg.in/yaml.v3"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/docs"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/handler"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
)

// infraRoutes là các route hạ tầng đăng ký trực tiếp trong cmd/main.go nên
// không dựng lại được từ package handler.
//
// Đây là hai route ổn định (probe của Docker/K8s và scrape của Prometheus).
// Chúng vẫn phải có trong openapi.yaml, nên liệt kê ở đây để phép so khớp hai
// chiều không báo nhầm là "doc thừa".
var infraRoutes = []string{
	"GET /health",
	"GET /metrics",
}

// redirectAliases là route chỉ để redirect, cố ý không đưa vào spec.
//
// GET /swagger/ chuyển hướng 301 về GET /swagger — đưa cả hai vào tài liệu chỉ
// làm nhiễu danh sách endpoint mà không cho người đọc thêm thông tin gì.
var redirectAliases = []string{
	"GET /swagger/",
}

// openAPIDocument chỉ mô tả phần cần cho phép so khớp: path và method.
type openAPIDocument struct {
	Paths map[string]map[string]yaml.Node `yaml:"paths"`
}

var httpMethods = map[string]bool{
	"get": true, "post": true, "put": true, "patch": true,
	"delete": true, "head": true, "options": true, "trace": true,
}

// newGatewayEcho dựng lại đúng bộ route mà gateway đăng ký lúc chạy thật.
//
// Proxy trỏ vào host giả và không bao giờ được gọi: bài test chỉ đọc bảng
// route chứ không thực thi handler nào.
func newGatewayEcho() *echo.Echo {
	log := zap.NewNop()
	newProxy := func() *proxy.ServiceProxy {
		return proxy.NewServiceProxy("http://service.invalid", log)
	}

	const jwtSecret = "test-secret"

	e := echo.New()
	handler.NewUserHandler(newProxy()).RegisterRoutes(e, jwtSecret)
	handler.NewProductHandler(newProxy()).RegisterRoutes(e, jwtSecret)
	handler.NewStorefrontHandler(newProxy()).RegisterRoutes(e)
	handler.NewCartHandler(newProxy()).RegisterRoutes(e, jwtSecret)
	handler.NewOrderHandler(newProxy()).RegisterRoutes(e, jwtSecret)
	handler.NewPaymentHandler(newProxy()).RegisterRoutes(e, jwtSecret)
	handler.NewNotificationHandler(newProxy()).RegisterRoutes(e, jwtSecret)
	docs.RegisterRoutes(e)

	return e
}

// registeredRoutes trả về tập "METHOD /path" mà gateway thật sự phục vụ.
//
// Echo tự thêm route bắt-tất-cả gắn NotFoundHandler cho mỗi group có gọi Use(),
// để middleware của group vẫn chạy khi router không khớp route nào. Những route
// đó là chi tiết nội bộ của framework, không phải contract, nên bị loại ra dựa
// vào việc handler thuộc package echo.
func registeredRoutes(t *testing.T) map[string]bool {
	t.Helper()

	routes := make(map[string]bool)
	for _, route := range newGatewayEcho().Routes() {
		if strings.HasPrefix(route.Name, "github.com/labstack/echo/v4.") {
			continue
		}
		routes[route.Method+" "+normalizePath(route.Path)] = true
	}

	for _, key := range infraRoutes {
		routes[key] = true
	}
	for _, key := range redirectAliases {
		delete(routes, key)
	}

	return routes
}

// documentedRoutes trả về tập "METHOD /path" khai báo trong openapi.yaml.
func documentedRoutes(t *testing.T) map[string]bool {
	t.Helper()

	var document openAPIDocument
	if err := yaml.Unmarshal(docs.Spec(), &document); err != nil {
		t.Fatalf("openapi.yaml không phải YAML hợp lệ: %v", err)
	}
	if len(document.Paths) == 0 {
		t.Fatal("openapi.yaml không có path nào")
	}

	routes := make(map[string]bool)
	for path, operations := range document.Paths {
		for method := range operations {
			if !httpMethods[strings.ToLower(method)] {
				// "parameters" dùng chung cho cả path item, không phải operation.
				continue
			}
			routes[strings.ToUpper(method)+" "+path] = true
		}
	}

	return routes
}

// normalizePath đổi tham số kiểu Echo (:id) sang kiểu OpenAPI ({id}).
func normalizePath(path string) string {
	segments := strings.Split(path, "/")
	for i, segment := range segments {
		if strings.HasPrefix(segment, ":") {
			segments[i] = "{" + segment[1:] + "}"
		}
	}
	return strings.Join(segments, "/")
}

func difference(left, right map[string]bool) []string {
	var missing []string
	for key := range left {
		if !right[key] {
			missing = append(missing, key)
		}
	}
	sort.Strings(missing)
	return missing
}

// TestSpecCoversEveryRegisteredRoute bắt trường hợp thêm route mà quên viết docs.
func TestSpecCoversEveryRegisteredRoute(t *testing.T) {
	undocumented := difference(registeredRoutes(t), documentedRoutes(t))
	if len(undocumented) > 0 {
		t.Fatalf(
			"%d route đang phục vụ nhưng thiếu trong openapi.yaml:\n%s",
			len(undocumented),
			formatList(undocumented),
		)
	}
}

// TestSpecDoesNotDocumentUnknownRoutes bắt trường hợp xoá/đổi route mà docs còn sót.
func TestSpecDoesNotDocumentUnknownRoutes(t *testing.T) {
	stale := difference(documentedRoutes(t), registeredRoutes(t))
	if len(stale) > 0 {
		t.Fatalf(
			"%d route có trong openapi.yaml nhưng gateway không đăng ký:\n%s",
			len(stale),
			formatList(stale),
		)
	}
}

// TestSpecOperationIDsAreUnique giữ operationId duy nhất — client generator dùng
// nó làm tên hàm, trùng là sinh code hỏng.
func TestSpecOperationIDsAreUnique(t *testing.T) {
	var document openAPIDocument
	if err := yaml.Unmarshal(docs.Spec(), &document); err != nil {
		t.Fatalf("openapi.yaml không phải YAML hợp lệ: %v", err)
	}

	seen := make(map[string]string)
	for path, pathItem := range document.Paths {
		for method, node := range pathItem {
			// Bỏ qua "parameters" — nó là mảng dùng chung cho cả path item chứ
			// không phải một operation, nên không có operationId.
			if !httpMethods[strings.ToLower(method)] {
				continue
			}

			var operation struct {
				OperationID string `yaml:"operationId"`
			}
			if err := node.Decode(&operation); err != nil {
				t.Fatalf("không đọc được operation %s %s: %v", method, path, err)
			}

			route := strings.ToUpper(method) + " " + path
			if operation.OperationID == "" {
				t.Errorf("%s thiếu operationId", route)
				continue
			}
			if previous, exists := seen[operation.OperationID]; exists {
				t.Errorf(
					"operationId %q dùng cho cả %s và %s",
					operation.OperationID, previous, route,
				)
				continue
			}
			seen[operation.OperationID] = route
		}
	}
}

func formatList(items []string) string {
	var builder strings.Builder
	for _, item := range items {
		fmt.Fprintf(&builder, "  - %s\n", item)
	}
	return builder.String()
}
