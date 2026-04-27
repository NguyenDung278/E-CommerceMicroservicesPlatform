import { productApi } from "@/lib/api/product";
import type { CatalogSortMode } from "@/lib/storefront/initial-data";
import type { Product } from "@/types/api";

export const catalogPageSize = 12;
export const catalogSortOptions: Array<{ value: CatalogSortMode; label: string }> = [
  { value: "latest", label: "Mới cập nhật" },
  { value: "popular", label: "Bán chạy" },
  { value: "price_asc", label: "Giá tăng dần" },
  { value: "price_desc", label: "Giá giảm dần" },
];

export function normalizeCatalogSort(value: string | null): CatalogSortMode {
  return catalogSortOptions.some((option) => option.value === value)
    ? (value as CatalogSortMode)
    : "latest";
}

export function normalizeCatalogPage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function buildCatalogCategories(products: Product[]) {
  return Array.from(new Set(products.map((product) => product.category.trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right, "vi"),
  );
}

export async function fetchCatalogProducts() {
  const products: Product[] = [];
  let cursor = "";

  for (let page = 0; page < 8; page += 1) {
    const response = await productApi.listProducts({
      status: "active",
      sort: "merchandising",
      limit: 40,
      cursor: cursor || undefined,
    });

    products.push(...response.data);

    if (!response.meta?.has_next || !response.meta.next_cursor) {
      break;
    }

    cursor = response.meta.next_cursor;
  }

  return Array.from(new Map(products.map((product) => [product.id, product])).values());
}

export function sortCatalogProducts(
  products: Product[],
  sortMode: CatalogSortMode,
  popularityRank: Map<string, number>,
) {
  return products.slice().sort((left, right) => {
    if (sortMode === "price_asc") {
      return left.price - right.price || right.updated_at.localeCompare(left.updated_at);
    }

    if (sortMode === "price_desc") {
      return right.price - left.price || right.updated_at.localeCompare(left.updated_at);
    }

    if (sortMode === "popular") {
      return (
        (popularityRank.get(right.id) ?? 0) - (popularityRank.get(left.id) ?? 0) ||
        right.updated_at.localeCompare(left.updated_at)
      );
    }

    return right.updated_at.localeCompare(left.updated_at);
  });
}
