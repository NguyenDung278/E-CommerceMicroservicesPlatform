import type { Product } from "@/types/api";
import { fallbackImageForProduct } from "@/lib/utils";
import { formatTime } from "@/utils/format";

type ProductImageSource = Pick<Product, "image_url" | "image_urls"> | null | undefined;

export const storefrontSyncIntervalMs = 5_000;

export function formatStorefrontSyncLabel(value: Date | null) {
  return value ? formatTime(value) : "Chưa đồng bộ";
}

export function resolveStorefrontProductImage(
  product: ProductImageSource,
  fallbackName: string,
) {
  return product?.image_urls[0] || product?.image_url || fallbackImageForProduct(fallbackName);
}
