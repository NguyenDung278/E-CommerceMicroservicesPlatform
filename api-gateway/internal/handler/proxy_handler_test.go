package handler

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

type fakeRequestForwarder struct {
	resp             *http.Response
	doErr            error
	forwardErr       error
	lastRequestPath  string
	lastRequestQuery string
}

func (f *fakeRequestForwarder) Do(_ context.Context, req *http.Request) (*http.Response, error) {
	f.lastRequestPath = req.URL.Path
	f.lastRequestQuery = req.URL.RawQuery
	if f.doErr != nil {
		return nil, f.doErr
	}
	return f.resp, nil
}

func (f *fakeRequestForwarder) ForwardResponse(w http.ResponseWriter, resp *http.Response) error {
	if f.forwardErr != nil {
		return f.forwardErr
	}

	for name, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(name, value)
		}
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
	_ = resp.Body.Close()
	return nil
}

func TestForwardWithProxySuccess(t *testing.T) {
	e := echo.New()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/orders?status=pending", nil)
	c := e.NewContext(req, rec)

	forwarder := &fakeRequestForwarder{
		resp: &http.Response{
			StatusCode: http.StatusAccepted,
			Header:     http.Header{"X-Downstream": []string{"orders"}},
			Body:       io.NopCloser(strings.NewReader(`{"ok":true}`)),
		},
	}

	if err := forwardWithProxy("order service", forwarder)(c); err != nil {
		t.Fatalf("handler returned error: %v", err)
	}
	if forwarder.lastRequestPath != "/api/v1/orders" || forwarder.lastRequestQuery != "status=pending" {
		t.Fatalf("expected request to be forwarded intact, got path=%q query=%q", forwarder.lastRequestPath, forwarder.lastRequestQuery)
	}
	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d", rec.Code)
	}
	if rec.Header().Get("X-Downstream") != "orders" {
		t.Fatalf("expected forwarded header, got %#v", rec.Header())
	}
	if rec.Body.String() != `{"ok":true}` {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestForwardWithProxyReturnsGatewayErrorOnProxyFailure(t *testing.T) {
	e := echo.New()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/cart", nil)
	c := e.NewContext(req, rec)

	err := forwardWithProxy("cart service", &fakeRequestForwarder{doErr: errors.New("downstream unavailable")})(c)
	if err != nil {
		t.Fatalf("handler returned error: %v", err)
	}
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
	if body := rec.Body.String(); !strings.Contains(body, "cart service") {
		t.Fatalf("expected service name in error body, got %s", body)
	}
}
