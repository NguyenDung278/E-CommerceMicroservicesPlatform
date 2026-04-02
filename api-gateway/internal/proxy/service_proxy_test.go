package proxy

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sony/gobreaker/v2"
)

type timeoutError struct{}

func (timeoutError) Error() string   { return "timeout" }
func (timeoutError) Timeout() bool   { return true }
func (timeoutError) Temporary() bool { return true }

func TestBuildBackendURL(t *testing.T) {
	got := buildBackendURL("http://orders:8080", "/api/v1/orders", "page=2&status=pending")
	want := "http://orders:8080/api/v1/orders?page=2&status=pending"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestForwardedProtoPrefersTLSThenHeaderThenOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "http://gateway.local/api/v1/products", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	if got := forwardedProto(req); got != "https" {
		t.Fatalf("expected forwarded proto https from header, got %q", got)
	}

	req = httptest.NewRequest(http.MethodGet, "http://gateway.local/api/v1/products", nil)
	req.Header.Set("Origin", "https://shop.example.com")
	if got := forwardedProto(req); got != "https" {
		t.Fatalf("expected forwarded proto https from origin, got %q", got)
	}
}

func TestShouldRetry(t *testing.T) {
	if !shouldRetry(http.MethodGet, timeoutError{}, 0, 3) {
		t.Fatal("expected timeout GET to be retryable")
	}
	if shouldRetry(http.MethodPost, timeoutError{}, 0, 3) {
		t.Fatal("expected POST timeout not to be retryable")
	}
	if !shouldRetry(http.MethodGet, gobreaker.ErrOpenState, 0, 3) {
		t.Fatal("expected open breaker GET to be retryable")
	}
	if shouldRetry(http.MethodGet, errors.New("plain error"), 2, 3) {
		t.Fatal("expected final attempt not to retry")
	}
}
