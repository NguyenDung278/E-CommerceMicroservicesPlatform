import type { Product } from "@/types/api";

const workbookCategoryMatchers = new Set([
  "shop men",
  "men",
  "nam",
  "atelier men",
  "men atelier",
  "shop women",
  "women",
  "nu",
  "atelier women",
  "women atelier",
  "footwear",
  "shoes",
  "giay",
  "atelier footwear",
  "footwear atelier",
  "accessories",
  "accessory",
  "phu kien",
  "atelier accessories",
  "accessories atelier",
]);

export function canSyncProductToWorkbook(product: Product) {
  return workbookCategoryMatchers.has(normalizeWorkbookCategory(product.category));
}

export function normalizeWorkbookCategory(value: string) {
  return value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}
