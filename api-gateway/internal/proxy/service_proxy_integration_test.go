package proxy

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"go.uber.org/zap"
)

func TestServiceProxyPreservesQueryStringAndResponseHeaders(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.RawQuery; got != "page=2&search=laptop" {
			t.Fatalf("expected query string to be preserved, got %q", got)
		}

		w.Header().Set("X-Backend", "products")
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer backend.Close()

	proxy := NewServiceProxy(backend.URL, zap.NewNop())

	req := httptest.NewRequest(http.MethodGet, "/api/v1/products?page=2&search=laptop", nil)
	resp, err := proxy.Do(context.Background(), req)
	if err != nil {
		t.Fatalf("proxy.Do returned error: %v", err)
	}
	defer resp.Body.Close()

	rec := httptest.NewRecorder()
	if err := proxy.ForwardResponse(rec, resp); err != nil {
		t.Fatalf("ForwardResponse returned error: %v", err)
	}

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d", rec.Code)
	}
	if rec.Header().Get("X-Backend") != "products" {
		t.Fatalf("expected response header to be forwarded")
	}

	body, _ := io.ReadAll(rec.Result().Body)
	if string(body) != `{"ok":true}` {
		t.Fatalf("unexpected body: %s", string(body))
	}
}
