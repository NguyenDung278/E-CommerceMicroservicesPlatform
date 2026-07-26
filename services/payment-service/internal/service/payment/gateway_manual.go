package service

import "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"

// manualGateway đại diện cho thanh toán không qua cổng ngoài (COD, ghi nhận thủ
// công). Nó tồn tại để `ProcessPayment` không phải viết nhánh `if provider ==
// "momo"` nữa: mọi phương thức đều đi qua cùng một interface.
type manualGateway struct{}

func newManualGateway() *manualGateway {
	return &manualGateway{}
}

func (g *manualGateway) Provider() string {
	return "manual"
}

func (g *manualGateway) SettlesImmediately() bool {
	return true
}

func (g *manualGateway) PreparePending(_ *model.Payment) {}

// VerifyWebhook luôn từ chối: thanh toán thủ công không có webhook, nên mọi
// callback tự nhận là "manual" đều là giả mạo.
func (g *manualGateway) VerifyWebhook(_ GatewayWebhook) bool {
	return false
}

func (g *manualGateway) WebhookMessageID(_ GatewayWebhook) string {
	return ""
}
