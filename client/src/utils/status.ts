// Nhãn tiếng Việt cho status của order / payment / return / shipment.
// Dùng chung cho mọi trang; status chưa có nhãn thì hiển thị nguyên giá trị.
const statusLabels: Record<string, string> = {
  pending: "Chờ xử lý",
  paid: "Đã thanh toán",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn tiền",
  completed: "Hoàn tất",
  failed: "Thất bại",
  requested: "Đã gửi yêu cầu",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  received: "Đã nhận hàng trả",
  refund_pending: "Đang hoàn tiền",
  in_transit: "Đang vận chuyển",
  out_for_delivery: "Đang giao hôm nay",
  exception: "Cần kiểm tra",
};

export function statusLabel(value: string) {
  return statusLabels[value] ?? value;
}

/** Status hiển thị pill xanh (`is-good`) thay vì trung tính. */
export function isPositiveStatus(value: string) {
  return [
    "paid",
    "shipped",
    "delivered",
    "completed",
    "approved",
    "received",
    "refund_pending",
    "refunded",
  ].includes(value);
}
