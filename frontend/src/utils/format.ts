const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const statusLabels: Record<string, string> = {
  pending: "Chờ xử lý",
  paid: "Đã thanh toán",
  completed: "Hoàn tất",
  failed: "Thất bại",
  success: "Thành công"
};

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
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
