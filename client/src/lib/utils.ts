import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Availability, Product } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyPrecise(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getDiscountPercent(price: number, compareAtPrice?: number) {
  if (!compareAtPrice || compareAtPrice <= price) {
    return null;
  }

  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export function clampQuantity(value: number) {
  return Math.min(9, Math.max(1, value));
}

export function getAvailabilityTone(availability: Availability) {
  switch (availability) {
    case "sold-out":
      return "text-error";
    case "low-stock":
      return "text-tertiary";
    case "pre-order":
      return "text-secondary";
    default:
      return "text-on-surface-variant";
  }
}

export function getAvailabilityLabel(product: Product) {
  switch (product.availability) {
    case "sold-out":
      return "Sold out";
    case "low-stock":
      return `Only ${product.inventory} left`;
    case "pre-order":
      return "Pre-order ships in 7 days";
    default:
      return "In stock";
  }
}

export function getOrderNumber() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `ND-${random}`;
}

export function getCartSubtotal(
  lines: Array<{ quantity: number; product: Product }>,
) {
  return lines.reduce((total, line) => total + line.product.price * line.quantity, 0);
}
