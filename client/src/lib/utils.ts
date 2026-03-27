import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clampQuantity(value: number) {
  return Math.min(9, Math.max(1, value));
}

export function debounce<T extends (...args: never[]) => void>(
  callback: T,
  delay: number,
) {
  let timeoutId: number | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, delay);
  };
}

export function buildSearchParams(input: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    params.set(key, String(value));
  });

  return params.toString();
}

export function getStatusTone(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized.includes("paid") || normalized.includes("deliver") || normalized.includes("success")) {
    return "emerald";
  }

  if (normalized.includes("pending") || normalized.includes("ship")) {
    return "amber";
  }

  if (normalized.includes("fail") || normalized.includes("cancel")) {
    return "red";
  }

  if (normalized.includes("refund")) {
    return "slate";
  }

  return "slate";
}

export function getProductImages(imageUrl: string, imageUrls: string[]) {
  const images = imageUrls.filter(Boolean);

  if (imageUrl && !images.includes(imageUrl)) {
    images.unshift(imageUrl);
  }

  return images;
}

export function fallbackImageForProduct(name: string) {
  const encoded = encodeURIComponent(name || "Product");
  return `https://placehold.co/1200x1500/F5F3EE/1B3022?text=${encoded}`;
}
