import type { NotificationInboxItem, NotificationPreference, WishlistAlert } from "../../types/api";

export const notificationTopics = [
  { topic: "order_updates", label: "Cập nhật đơn hàng" },
  { topic: "payment_updates", label: "Cập nhật thanh toán" },
  { topic: "return_updates", label: "Trả hàng/hoàn tiền" },
  { topic: "wishlist_back_in_stock", label: "Wishlist có hàng lại" },
  { topic: "wishlist_price_drop", label: "Wishlist giảm giá" },
];

export function getInitials(firstName?: string, email?: string) {
  const source = firstName?.trim() || email?.trim() || "ND";
  return source.slice(0, 2).toUpperCase();
}

export function alertLabel(alert: WishlistAlert) {
  if (alert.kind === "back_in_stock") {
    return "Có hàng lại";
  }
  if (alert.kind === "price_drop") {
    return "Giảm giá";
  }
  return alert.kind;
}

export function preferenceEnabled(preferences: NotificationPreference[], topic: string) {
  return preferences.find((preference) => preference.topic === topic)?.enabled ?? true;
}

export function notificationHref(notification: NotificationInboxItem) {
  if (notification.action_href) {
    return notification.action_href;
  }
  if (notification.return_id) {
    return `/account/returns/${notification.return_id}`;
  }
  if (notification.order_id) {
    return `/account/orders/${notification.order_id}`;
  }
  if (notification.payment_id) {
    return `/payments/${notification.payment_id}`;
  }
  return "";
}

export function notificationActionLabel(notification: NotificationInboxItem) {
  if (notification.action_label) {
    return notification.action_label;
  }
  if (notification.return_id) {
    return "Xem yêu cầu trả hàng";
  }
  if (notification.order_id) {
    return "Xem đơn hàng";
  }
  if (notification.payment_id) {
    return "Xem thanh toán";
  }
  return "";
}

export function phoneVerificationLabel(status?: string) {
  const labels: Record<string, string> = {
    pending: "Đang chờ OTP",
    verified: "Đã xác thực OTP",
    locked: "Đã khóa",
    expired: "Hết hạn",
    consumed: "Đã dùng",
  };

  return status ? (labels[status] ?? status) : "Chưa gửi OTP";
}
