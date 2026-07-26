package service

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

const (
	// vnpayParamPrefix — VNPay chỉ ký các tham số thuộc namespace của nó.
	vnpayParamPrefix = "vnp_"
	// vnpaySecureHashParam và vnpaySecureHashTypeParam bị loại khỏi chuỗi ký:
	// không thể ký lên chính chữ ký.
	vnpaySecureHashParam     = "vnp_SecureHash"
	vnpaySecureHashTypeParam = "vnp_SecureHashType"
	// vnpaySuccessResponseCode là mã "giao dịch thành công" của VNPay.
	vnpaySuccessResponseCode = "00"
	// vnpayAmountScale — VNPay truyền số tiền đã nhân 100 để tránh số thập phân.
	vnpayAmountScale = 100
)

// vnpayGateway là cổng thứ hai của hệ thống.
//
// Nó tồn tại để chứng minh abstraction đứng vững: VNPay khác MoMo ở gần như mọi
// chi tiết kỹ thuật — HMAC-SHA512 thay vì SHA256, ký trên query string đã sắp
// xếp thay vì chuỗi nối bằng `|`, số tiền nhân 100, mã thành công là chuỗi "00"
// thay vì số 0 — nhưng `ProcessPayment` và `HandleGatewayWebhook` không đổi một
// dòng nào để đón nó.
type vnpayGateway struct {
	secret    string
	returnURL string
}

func newVNPayGateway(secret, returnURL string) *vnpayGateway {
	return &vnpayGateway{
		secret:    strings.TrimSpace(secret),
		returnURL: strings.TrimSpace(returnURL),
	}
}

func (g *vnpayGateway) Provider() string {
	return "vnpay"
}

func (g *vnpayGateway) SettlesImmediately() bool {
	return false
}

func (g *vnpayGateway) PreparePending(payment *model.Payment) {
	payment.GatewayOrderID = "VNP-" + payment.ID
	payment.CheckoutURL = buildCheckoutURL(g.returnURL, "vnp_TxnRef", payment.GatewayOrderID)
}

// VerifyWebhook xác thực chữ ký theo đúng quy ước VNPay: HMAC-SHA512 trên chuỗi
// `key=urlencode(value)` của toàn bộ tham số `vnp_*` đã sắp xếp theo key.
//
// Edge cases:
//   - secret rỗng luôn trả false (fail closed), giống momoGateway.
//   - so sánh không phân biệt hoa/thường vì VNPay trả hex chữ hoa.
//
// Security:
//   - dùng `hmac.Equal` để so sánh trong thời gian không đổi.
func (g *vnpayGateway) VerifyWebhook(hook GatewayWebhook) bool {
	if g.secret == "" {
		return false
	}

	signature := strings.TrimSpace(hook.Signature)
	if signature == "" {
		return false
	}

	mac := hmac.New(sha512.New, []byte(g.secret))
	_, _ = mac.Write([]byte(g.signaturePayload(hook)))
	expected := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(strings.ToLower(expected)), []byte(strings.ToLower(signature)))
}

func (g *vnpayGateway) WebhookMessageID(hook GatewayWebhook) string {
	sum := sha512.Sum512_256([]byte(g.signaturePayload(hook) + "|" + strings.ToLower(strings.TrimSpace(hook.Signature))))
	return hex.EncodeToString(sum[:])
}

// signaturePayload dựng lại chuỗi ký của VNPay.
//
// Tham số rỗng bị bỏ qua và `vnp_SecureHash*` bị loại trừ — đúng như tài liệu
// tích hợp của VNPay, nếu lệch một chi tiết là chữ ký không bao giờ khớp.
func (g *vnpayGateway) signaturePayload(hook GatewayWebhook) string {
	keys := make([]string, 0, len(hook.Params))
	for key := range hook.Params {
		if !strings.HasPrefix(key, vnpayParamPrefix) {
			continue
		}
		if key == vnpaySecureHashParam || key == vnpaySecureHashTypeParam {
			continue
		}
		if strings.TrimSpace(hook.Params[key]) == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var builder strings.Builder
	for index, key := range keys {
		if index > 0 {
			builder.WriteByte('&')
		}
		builder.WriteString(key)
		builder.WriteByte('=')
		builder.WriteString(url.QueryEscape(hook.Params[key]))
	}

	return builder.String()
}

// VNPayWebhookFromParams dịch query string của VNPay sang dạng trung tính.
//
// Inputs:
//   - params là toàn bộ tham số query đã được giải mã.
//
// Returns:
//   - GatewayWebhook với Params giữ nguyên bản thô để `signaturePayload` dựng lại được.
//
// Edge cases:
//   - `vnp_Amount` không parse được cho ra amount 0, và sẽ bị chốt so khớp số
//     tiền trong `HandleGatewayWebhook` từ chối.
func VNPayWebhookFromParams(params map[string]string) GatewayWebhook {
	amount, _ := strconv.ParseFloat(strings.TrimSpace(params["vnp_Amount"]), 64)

	return GatewayWebhook{
		GatewayOrderID:       strings.TrimSpace(params["vnp_TxnRef"]),
		GatewayTransactionID: strings.TrimSpace(params["vnp_TransactionNo"]),
		Amount:               amount / vnpayAmountScale,
		Succeeded:            strings.TrimSpace(params["vnp_ResponseCode"]) == vnpaySuccessResponseCode,
		Message:              strings.TrimSpace(params["vnp_OrderInfo"]),
		Signature:            strings.TrimSpace(params[vnpaySecureHashParam]),
		Params:               params,
	}
}
