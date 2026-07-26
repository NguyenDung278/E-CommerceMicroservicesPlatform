package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

// momoResultCodeParam giữ nguyên `result_code` thô trong GatewayWebhook.Params.
//
// Chữ ký MoMo được tính trên chính giá trị số này (0 = thành công, khác 0 = mã
// lỗi cụ thể), nên không thể rút gọn thành bool `Succeeded` rồi dựng lại — mã 1
// và mã 49 đều là "thất bại" nhưng cho ra hai chữ ký khác nhau.
const momoResultCodeParam = "result_code"

// momoGateway mô phỏng ví MoMo: khách được chuyển sang trang thanh toán, tiền
// chỉ được ghi nhận khi webhook có chữ ký HMAC-SHA256 hợp lệ gọi ngược về.
type momoGateway struct {
	secret    string
	returnURL string
}

func newMomoGateway(secret, returnURL string) *momoGateway {
	return &momoGateway{
		secret:    strings.TrimSpace(secret),
		returnURL: strings.TrimSpace(returnURL),
	}
}

func (g *momoGateway) Provider() string {
	return "momo"
}

func (g *momoGateway) SettlesImmediately() bool {
	return false
}

// PreparePending sinh gateway order id và checkout URL cho payment đang chờ.
//
// Edge cases:
//   - returnURL rỗng cho ra checkout URL rỗng thay vì URL hỏng.
//   - query string sẵn có được giữ nguyên bằng cách đổi `?` thành `&`.
func (g *momoGateway) PreparePending(payment *model.Payment) {
	payment.GatewayOrderID = "MOMO-" + payment.ID
	payment.CheckoutURL = buildCheckoutURL(g.returnURL, "gateway_order_id", payment.GatewayOrderID)
}

// VerifyWebhook xác thực payload bằng HMAC-SHA256 trên chuỗi các trường nối
// bằng `|`.
//
// Edge cases:
//   - secret rỗng luôn trả false (fail closed): thiếu cấu hình phải là "từ chối
//     tất cả", không phải "cho qua tất cả".
//
// Security:
//   - so sánh bằng `hmac.Equal` (thời gian không đổi) để chặn timing attack.
func (g *momoGateway) VerifyWebhook(hook GatewayWebhook) bool {
	if g.secret == "" {
		return false
	}

	mac := hmac.New(sha256.New, []byte(g.secret))
	_, _ = mac.Write([]byte(g.signaturePayload(hook)))
	expected := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(strings.TrimSpace(hook.Signature)))
}

// WebhookMessageID băm nội dung callback thành khóa dedupe.
//
// Id được sinh từ chính nội dung (content-addressed) chứ không do MoMo cấp, nên
// cùng một callback gửi lại bao nhiêu lần cũng cho ra cùng một id và bị inbox
// chặn từ lần thứ hai.
func (g *momoGateway) WebhookMessageID(hook GatewayWebhook) string {
	sum := sha256.Sum256([]byte(g.signaturePayload(hook) + "|" + strings.TrimSpace(hook.Signature)))
	return hex.EncodeToString(sum[:])
}

func (g *momoGateway) signaturePayload(hook GatewayWebhook) string {
	return strings.Join([]string{
		strings.TrimSpace(hook.PaymentID),
		strings.TrimSpace(hook.GatewayOrderID),
		strings.TrimSpace(hook.GatewayTransactionID),
		formatMoney(hook.Amount),
		strings.TrimSpace(hook.Params[momoResultCodeParam]),
	}, "|")
}

// MomoWebhookFromDTO dịch payload JSON của MoMo sang dạng trung tính.
//
// Việc dịch nằm ở tầng service (không phải handler) để handler không phải biết
// cổng nào cần giữ tham số thô nào.
func MomoWebhookFromDTO(req dto.MomoWebhookRequest) GatewayWebhook {
	return GatewayWebhook{
		PaymentID:            strings.TrimSpace(req.PaymentID),
		GatewayOrderID:       strings.TrimSpace(req.GatewayOrderID),
		GatewayTransactionID: strings.TrimSpace(req.GatewayTransactionID),
		Amount:               req.Amount,
		Succeeded:            req.ResultCode == 0,
		Message:              strings.TrimSpace(req.Message),
		Signature:            strings.TrimSpace(req.Signature),
		Params: map[string]string{
			momoResultCodeParam: strconv.Itoa(req.ResultCode),
		},
	}
}

// buildCheckoutURL nối tham số vào return URL đã cấu hình.
//
// Edge cases:
//   - base URL rỗng hoặc value rỗng cho ra chuỗi rỗng.
//   - query string sẵn có được giữ nguyên.
func buildCheckoutURL(baseURL, key, value string) string {
	trimmed := strings.TrimSpace(baseURL)
	if trimmed == "" || value == "" {
		return ""
	}

	separator := "?"
	if strings.Contains(trimmed, "?") {
		separator = "&"
	}
	return fmt.Sprintf("%s%s%s=%s", trimmed, separator, key, value)
}
