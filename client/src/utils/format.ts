const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const shortDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const longDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const statusLabels: Record<string, string> = {
  pending: "Chờ xử lý",
  paid: "Đã thanh toán",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn tiền",
  completed: "Hoàn tất",
  failed: "Thất bại",
  success: "Thành công",
};

const shippingMethodLabels: Record<string, string> = {
  standard: "Giao tiêu chuẩn",
  express: "Giao nhanh",
  pickup: "Nhận tại quầy",
};

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatShortDate(value: string) {
  return shortDateFormatter.format(new Date(value));
}

export function formatLongDate(value: string) {
  return longDateFormatter.format(new Date(value));
}

export function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

export function formatStatusLabel(value: string) {
  const normalized = value.trim().toLowerCase();

  if (statusLabels[normalized]) {
    return statusLabels[normalized];
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatShippingMethodLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  return shippingMethodLabels[normalized] ?? formatStatusLabel(value);
}

export function formatShortOrderId(orderId: string) {
  return `#${orderId.slice(0, 8).toUpperCase()}`;
}

export function humanizeToken(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getDisplayName(firstName?: string, lastName?: string) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || "Tài khoản khách hàng";
}

