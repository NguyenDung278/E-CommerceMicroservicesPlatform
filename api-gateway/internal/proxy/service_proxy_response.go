package proxy

import (
	"io"
	"net/http"

	"go.uber.org/zap"
)

// ForwardResponse copies the backend response to the gateway client response.
//
// Inputs:
//   - w is the client-facing response writer.
//   - resp is the backend response returned by the proxy.
//
// Returns:
//   - any error produced while copying the response body.
//
// Edge cases:
//   - response headers are copied before the status code is written.
//
// Side effects:
//   - writes headers, status, and body to the client response.
//   - always closes the backend response body.
//
// Performance:
//   - O(h+b) over header count and body size; body streaming uses io.Copy without buffering the full payload in memory.
func (p *ServiceProxy) ForwardResponse(w http.ResponseWriter, resp *http.Response) error {
	defer resp.Body.Close()

	copyHeaders(w.Header(), resp.Header)
	w.WriteHeader(resp.StatusCode)

	_, err := io.Copy(w, resp.Body)
	if err != nil {
		p.log.Error("failed to copy response body", zap.Error(err))
	}
	return err
}

// copyHeaders appends all header values from src into dst.
//
// Inputs:
//   - dst is the destination header map.
//   - src is the source header map.
//
// Returns:
//   - none.
//
// Edge cases:
//   - multiple header values for the same key are preserved.
//
// Side effects:
//   - mutates the destination header map.
//
// Performance:
//   - O(h+v) over header keys and values.
func copyHeaders(dst, src http.Header) {
	for name, values := range src {
		for _, value := range values {
			dst.Add(name, value)
		}
	}
}
