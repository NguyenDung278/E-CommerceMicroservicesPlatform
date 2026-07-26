package service

import (
	"strings"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

// GatewayWebhook là dạng trung tính của một callback từ cổng thanh toán.
//
// Handler chịu trách nhiệm dịch khuôn dạng HTTP cụ thể của từng cổng (MoMo gửi
// JSON body, VNPay gửi query string) về struct này, nhờ vậy `HandleGatewayWebhook`
// không cần biết mình đang nói chuyện với cổng nào.
//
// Params giữ nguyên tham số thô để cổng nào cần tự dựng lại chuỗi ký (VNPay ký
// trên toàn bộ query string đã sắp xếp) vẫn làm được.
type GatewayWebhook struct {
	PaymentID            string
	GatewayOrderID       string
	GatewayTransactionID string
	Amount               float64
	Succeeded            bool
	Message              string
	Signature            string
	Params               map[string]string
}

// PaymentGateway mô tả *năng lực* mà luồng thanh toán cần ở một cổng, không mô
// tả *công nghệ* của cổng đó.
//
// Interface này được đặt ở tầng service (bên dùng), không phải ở tầng client
// (bên cung cấp) — đúng hướng Dependency Inversion: thêm cổng mới chỉ cần viết
// một implementation, không phải sửa `ProcessPayment` hay `HandleGatewayWebhook`.
type PaymentGateway interface {
	// Provider trả về định danh lưu vào cột `gateway_provider`.
	Provider() string

	// SettlesImmediately = true nghĩa là payment hoàn tất ngay lúc tạo (thanh
	// toán thủ công). False nghĩa là payment dừng ở `pending` và chỉ chuyển
	// trạng thái khi webhook của cổng được xác thực.
	SettlesImmediately() bool

	// PreparePending gắn state riêng của cổng vào một payment vừa được tạo và
	// đang chờ khách thanh toán: gateway order id, checkout URL.
	PreparePending(payment *model.Payment)

	// VerifyWebhook xác thực chữ ký của callback. Mọi implementation phải
	// fail closed khi thiếu secret.
	VerifyWebhook(hook GatewayWebhook) bool

	// WebhookMessageID sinh khóa dedupe cho inbox pattern. Cùng một nội dung
	// callback phải luôn cho ra cùng một id thì `ON CONFLICT DO NOTHING` mới
	// chặn được duplicate delivery.
	WebhookMessageID(hook GatewayWebhook) string
}

// webhookConsumerName sinh tên consumer dùng làm nửa đầu của khóa inbox
// `(consumer, message_id)`. Mỗi cổng có namespace riêng nên hai cổng lỡ sinh
// trùng message id vẫn được xử lý độc lập.
func webhookConsumerName(provider string) string {
	return provider + "-webhook"
}

// resolveWebhookPaymentID lấy định danh payment mà callback trỏ tới.
//
// Ưu tiên payment id nội bộ; nếu cổng không mang theo (VNPay chỉ gửi mã đơn của
// merchant) thì caller sẽ tra theo gateway order id.
func resolveWebhookPaymentID(hook GatewayWebhook) string {
	return strings.TrimSpace(hook.PaymentID)
}
