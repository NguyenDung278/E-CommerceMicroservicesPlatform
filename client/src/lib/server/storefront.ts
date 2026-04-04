import "server-only";

import {
  normalizeProduct,
  normalizeProductList,
  normalizeProductPopularity,
  normalizeProductReviewList,
  normalizeStorefrontCategoryList,
  normalizeStorefrontCategoryPageData,
} from "@/lib/api/normalizers";
import type { ProductListOptions } from "@/lib/api/product";
import { getErrorMessage } from "@/lib/errors/handler";
import type {
  CatalogPageInitialData,
  CatalogPageQueryState,
  HomePageInitialData,
  ProductPageInitialData,
} from "@/lib/storefront/initial-data";
import type {
  ApiEnvelope,
  Product,
  ProductPopularity,
  ProductReviewList,
  StorefrontCategory,
  StorefrontCategoryPageData,
} from "@/types/api";

const emptyReviewList: ProductReviewList = {
  summary: {
    average_rating: 0,
    review_count: 0,
    rating_breakdown: {
      one: 0,
      two: 0,
      three: 0,
      four: 0,
      five: 0,
    },
  },
  items: [],
};

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getServerApiBaseUrl() {
  const gatewayOrigin = process.env.API_GATEWAY_URL?.trim();
  if (gatewayOrigin) {
    return stripTrailingSlash(gatewayOrigin);
  }

  const publicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (publicApiBaseUrl?.startsWith("http")) {
    return stripTrailingSlash(publicApiBaseUrl);
  }

  return "http://localhost:8080";
}

type ServerHttpError = Error & {
  status: number;
  detail: string;
};

function createServerHttpError(
  status: number,
  message: string,
  detail: string,
): ServerHttpError {
  const error = new Error(message) as ServerHttpError;
  error.status = status;
  error.detail = detail;
  return error;
}

async function requestServer<T>(path: string): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${getServerApiBaseUrl()}${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const raw = await response.text();
  let parsed: ApiEnvelope<T> | null = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw) as ApiEnvelope<T>;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok || !parsed?.success) {
    throw createServerHttpError(
      response.status || 500,
      parsed?.message || response.statusText || "Request failed",
      parsed?.error || raw || "Unexpected response from server",
    );
  }

  return parsed;
}

function toProductListQuery(options: ProductListOptions) {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 24));

  if (options.search) params.set("search", options.search);
  if (options.category) params.set("category", options.category);
  if (options.brand) params.set("brand", options.brand);
  if (options.tag) params.set("tag", options.tag);
  if (options.status) params.set("status", options.status);
  if (typeof options.minPrice === "number" && options.minPrice > 0) params.set("min_price", String(options.minPrice));
  if (typeof options.maxPrice === "number" && options.maxPrice > 0) params.set("max_price", String(options.maxPrice));
  if (options.size) params.set("size", options.size);
  if (options.color) params.set("color", options.color);
  if (options.sort) params.set("sort", options.sort);
  if (options.cursor) params.set("cursor", options.cursor);

  return params.toString();
}

async function fetchProductList(options: ProductListOptions) {
  const response = await requestServer<unknown>(`/api/v1/products?${toProductListQuery(options)}`);
  return normalizeProductList(response.data);
}

async function fetchProduct(productId: string) {
  const response = await requestServer<unknown>(`/api/v1/products/${encodeURIComponent(productId)}`);
  return normalizeProduct(response.data);
}

async function fetchProductPopularity(limit: number) {
  const response = await requestServer<unknown[]>(`/api/v1/catalog/popularity?limit=${encodeURIComponent(String(limit))}`);
  return response.data.map((item) => normalizeProductPopularity(item));
}

async function fetchProductReviewList(productId: string, page = 1, limit = 8) {
  const response = await requestServer<unknown>(
    `/api/v1/products/${encodeURIComponent(productId)}/reviews?page=${page}&limit=${limit}`,
  );
  return normalizeProductReviewList(response.data);
}

async function fetchStorefrontCategories() {
  const response = await requestServer<unknown>("/api/v1/storefront/categories");
  return normalizeStorefrontCategoryList(response.data);
}

async function fetchStorefrontCategoryPage(identifier: string) {
  const response = await requestServer<unknown>(
    `/api/v1/storefront/categories/${encodeURIComponent(identifier)}`,
  );
  return normalizeStorefrontCategoryPageData(response.data);
}

export function isServerHttpStatus(reason: unknown, status: number) {
  return (
    typeof reason === "object" &&
    reason !== null &&
    "status" in reason &&
    (reason as { status?: unknown }).status === status
  );
}

export async function getEditorialPageInitialData(identifier: string): Promise<{
  pageData: StorefrontCategoryPageData;
  categories: StorefrontCategory[];
}> {
  const [pageData, categories] = await Promise.all([
    fetchStorefrontCategoryPage(identifier),
    fetchStorefrontCategories().catch(() => []),
  ]);

  return {
    pageData,
    categories: categories.length > 0 ? categories : [pageData.category],
  };
}

export async function getHomePageInitialData(): Promise<HomePageInitialData> {
  try {
    const [products, popularity] = await Promise.all([
      fetchProductList({ status: "active", limit: 12 }),
      fetchProductPopularity(8).catch(() => []),
    ]);

    return {
      products,
      popularity,
      error: "",
    };
  } catch (reason) {
    return {
      products: [],
      popularity: [],
      error: getErrorMessage(reason),
    };
  }
}

export async function getCatalogPageInitialData(
  query: CatalogPageQueryState,
): Promise<CatalogPageInitialData> {
  const productListOptions: ProductListOptions = {
    search: query.search || undefined,
    category: query.category || undefined,
    brand: query.brand || undefined,
    size: query.size || undefined,
    color: query.color || undefined,
    status: "active",
    minPrice: query.minPrice ? Number(query.minPrice) : undefined,
    maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
    sort: query.sort === "popular" ? "latest" : query.sort,
    limit: 80,
  };

  const [catalogIndexResult, productListResult] = await Promise.allSettled([
    Promise.all([
      fetchProductList({ status: "active", limit: 120 }),
      fetchProductPopularity(120).catch(() => []),
    ]),
    fetchProductList(productListOptions),
  ]);

  let catalogIndex: Product[] = [];
  let popularity: ProductPopularity[] = [];
  let products: Product[] = [];
  let feedback = "";

  if (catalogIndexResult.status === "fulfilled") {
    [catalogIndex, popularity] = catalogIndexResult.value;
  } else {
    feedback = getErrorMessage(catalogIndexResult.reason);
  }

  if (productListResult.status === "fulfilled") {
    products = productListResult.value;

    if (query.sort === "popular" && popularity.length > 0) {
      const popularityRank = new Map(
        popularity.map((item, index) => [item.product_id, item.quantity * 1000 - index]),
      );

      products = products
        .slice()
        .sort(
          (left, right) =>
            (popularityRank.get(right.id) ?? 0) - (popularityRank.get(left.id) ?? 0),
        );
    }
  } else if (!feedback) {
    feedback = getErrorMessage(productListResult.reason);
  }

  return {
    catalogIndex,
    products,
    popularity,
    feedback,
  };
}

export async function getProductPageInitialData(
  productId: string,
): Promise<ProductPageInitialData> {
  const [productResult, reviewResult] = await Promise.allSettled([
    fetchProduct(productId),
    fetchProductReviewList(productId),
  ]);

  return {
    product: productResult.status === "fulfilled" ? productResult.value : null,
    reviewList:
      reviewResult.status === "fulfilled" ? reviewResult.value : emptyReviewList,
    feedback:
      productResult.status === "fulfilled"
        ? ""
        : getErrorMessage(productResult.reason),
    reviewFeedback:
      reviewResult.status === "fulfilled"
        ? ""
        : getErrorMessage(reviewResult.reason),
  };
}
