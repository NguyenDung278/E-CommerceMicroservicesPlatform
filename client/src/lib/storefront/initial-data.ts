import type { Product, ProductPopularity, ProductReviewList } from "@/types/api";

export type CatalogSortMode = "latest" | "price_asc" | "price_desc" | "popular";

export type CatalogPageQueryState = {
  search: string;
  category: string;
  brand: string;
  size: string;
  color: string;
  sort: CatalogSortMode;
  minPrice: string;
  maxPrice: string;
  savedOnly: boolean;
};

export type HomePageInitialData = {
  products: Product[];
  popularity: ProductPopularity[];
  error: string;
};

export type CatalogPageInitialData = {
  catalogIndex: Product[];
  products: Product[];
  popularity: ProductPopularity[];
  feedback: string;
};

export type ProductPageInitialData = {
  product: Product | null;
  reviewList: ProductReviewList;
  feedback: string;
  reviewFeedback: string;
};

const catalogSortModes = new Set<CatalogSortMode>([
  "latest",
  "price_asc",
  "price_desc",
  "popular",
]);

function readSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function readCatalogPageQuery(
  searchParams: Record<string, string | string[] | undefined>,
  initialCategory = "",
): CatalogPageQueryState {
  const categoryFromQuery = readSingleValue(searchParams.category).trim();
  const sortValue = readSingleValue(searchParams.sort).trim();

  return {
    search: readSingleValue(searchParams.search).trim(),
    category: initialCategory || categoryFromQuery,
    brand: readSingleValue(searchParams.brand).trim(),
    size: readSingleValue(searchParams.size).trim(),
    color: readSingleValue(searchParams.color).trim(),
    sort: catalogSortModes.has(sortValue as CatalogSortMode)
      ? (sortValue as CatalogSortMode)
      : "latest",
    minPrice: readSingleValue(searchParams.min_price).trim(),
    maxPrice: readSingleValue(searchParams.max_price).trim(),
    savedOnly: readSingleValue(searchParams.saved) === "1",
  };
}
