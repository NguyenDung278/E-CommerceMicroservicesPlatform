import type { AccountSidebarItem } from "./AccountSidebar";

export const ACCOUNT_NAV_ITEMS: AccountSidebarItem[] = [
  { id: "personal-info", label: "Personal Info", to: "/profile", icon: "person", end: true },
  { id: "orders", label: "My Orders", to: "/profile/orders", icon: "orders" },
  { id: "addresses", label: "Addresses", to: "/profile/addresses", icon: "pin" },
  { id: "payments", label: "Payments", to: "/profile/payments", icon: "payments" },
  { id: "security", label: "Security", to: "/profile/security", icon: "security" },
  { id: "notifications", label: "Notifications", to: "/profile/notifications", icon: "notifications" }
];

export function formatShortOrderId(orderId: string) {
  const normalized = orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `#${normalized}`;
}

export function formatShortDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

export function humanizeToken(value: string) {
  return value
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function buildTileLabel(value: string) {
  const words = value
    .split(/[\s-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return "ND";
  }

  return words
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getOrderStatusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("deliver") || normalized.includes("paid") || normalized.includes("success")) {
    return "success";
  }
  if (normalized.includes("ship")) {
    return "info";
  }
  if (normalized.includes("process") || normalized.includes("pending")) {
    return "processing";
  }

  return "neutral";
}

export function getPaymentStatusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("fail")) {
    return "danger";
  }
  if (normalized.includes("pending")) {
    return "processing";
  }
  if (normalized.includes("refund")) {
    return "neutral";
  }

  return "success";
}
