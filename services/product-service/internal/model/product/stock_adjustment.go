package model

import "time"

// StockAdjustmentReason phân loại vì sao tồn kho thay đổi ngoài luồng bán hàng.
//
// Lý do là bắt buộc chứ không phải ghi chú tuỳ ý: khi kiểm kê lệch, thứ người
// vận hành cần là lọc được "lệch vì hỏng hàng" khỏi "lệch vì nhập thiếu", và
// một ô text tự do không cho phép làm điều đó.
type StockAdjustmentReason string

const (
	// StockAdjustmentReasonReceived là nhập hàng mới về kho.
	StockAdjustmentReasonReceived StockAdjustmentReason = "received"
	// StockAdjustmentReasonRecount là chỉnh cho khớp số đếm thực tế khi kiểm kê.
	StockAdjustmentReasonRecount StockAdjustmentReason = "recount"
	// StockAdjustmentReasonDamaged là loại bỏ hàng hỏng, mất, hết hạn.
	StockAdjustmentReasonDamaged StockAdjustmentReason = "damaged"
	// StockAdjustmentReasonReturned là nhập lại kho hàng khách trả còn bán được.
	StockAdjustmentReasonReturned StockAdjustmentReason = "returned"
	// StockAdjustmentReasonCorrection là sửa một lần điều chỉnh sai trước đó.
	StockAdjustmentReasonCorrection StockAdjustmentReason = "correction"
)

// IsValid cho biết lý do có nằm trong tập được phép hay không.
func (r StockAdjustmentReason) IsValid() bool {
	switch r {
	case StockAdjustmentReasonReceived,
		StockAdjustmentReasonRecount,
		StockAdjustmentReasonDamaged,
		StockAdjustmentReasonReturned,
		StockAdjustmentReasonCorrection:
		return true
	default:
		return false
	}
}

// StockAdjustment là một dòng sổ cái tồn kho.
//
// Delta âm là xuất kho, dương là nhập kho. ResultingStock chốt tồn kho của đúng
// bể bị tác động ngay sau khi áp delta, nên lịch sử đọc được mà không phải cộng
// dồn lại từ đầu.
type StockAdjustment struct {
	ID             string                `json:"id"`
	ProductID      string                `json:"product_id"`
	SKU            string                `json:"sku,omitempty"`
	Delta          int                   `json:"delta"`
	ResultingStock int                   `json:"resulting_stock"`
	Reason         StockAdjustmentReason `json:"reason"`
	Note           string                `json:"note,omitempty"`
	ActorID        string                `json:"actor_id,omitempty"`
	ActorRole      string                `json:"actor_role,omitempty"`
	IdempotencyKey string                `json:"-"`
	CreatedAt      time.Time             `json:"created_at"`
}
