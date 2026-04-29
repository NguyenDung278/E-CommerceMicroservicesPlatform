import { request } from "./http";
import { buildQuery } from "../utils/query";
import type {
  ApiEnvelope,
  Product,
  ProductPopularity,
  ProductReview,
  ProductReviewList,
  ProductSearchAssist,
  StorefrontCategory,
  StorefrontCategoryPageData,
  StorefrontHomeData,
} from "../types/api";

export type ProductListParams = {
  search?: string;
  category?: string;
  brand?: string;
  tag?: string;
  cursor?: string;
  limit?: number;
  sort?: string;
  min_price?: number;
  max_price?: number;
  size?: string;
  color?: string;
};

export type SearchAssistParams = {
  query?: string;
  category?: string;
  status?: string;
  limit?: number;
};

export type ProductSearchEventRequest = {
  source: string;
  event_kind: "result_click" | "filter_apply";
  query?: string;
  category?: string;
  filter_key?: string;
  filter_value?: string;
};

export async function listProducts(
  params: ProductListParams = {},
): Promise<ApiEnvelope<Product[]>> {
  const response = await request<Product[]>(
    `/api/v1/products${buildQuery({ limit: 24, ...params })}`,
  );
  return {
    ...response,
    data: Array.isArray(response.data) ? response.data : [],
  };
}

export async function getProduct(productId: string): Promise<Product> {
  const response = await request<Product>(`/api/v1/products/${encodeURIComponent(productId)}`);
  return response.data;
}

export async function listProductsByIDs(productIds: string[]): Promise<Product[]> {
  const uniqueProductIds = Array.from(
    new Set(productIds.map((productId) => productId.trim()).filter(Boolean)),
  );
  if (uniqueProductIds.length === 0) {
    return [];
  }

  const response = await request<Product[]>(
    `/api/v1/products/batch${buildQuery({ ids: uniqueProductIds.join(",") })}`,
  );
  return Array.isArray(response.data) ? response.data : [];
}

export async function getProductReviews(productId: string): Promise<ProductReviewList> {
  const response = await request<ProductReviewList>(
    `/api/v1/products/${encodeURIComponent(productId)}/reviews`,
  );
  return {
    summary: response.data?.summary ?? { average_rating: 0, review_count: 0 },
    items: Array.isArray(response.data?.items) ? response.data.items : [],
  };
}

export async function getMyProductReview(
  token: string,
  productId: string,
): Promise<ProductReview | null> {
  const response = await request<ProductReview>(
    `/api/v1/products/${encodeURIComponent(productId)}/reviews/me`,
    { token },
  );
  return response.data ?? null;
}

export async function createProductReview(
  token: string,
  productId: string,
  body: { rating: number; comment: string },
): Promise<ProductReview> {
  const response = await request<ProductReview>(
    `/api/v1/products/${encodeURIComponent(productId)}/reviews`,
    {
      method: "POST",
      token,
      body,
    },
  );
  return response.data;
}

export async function updateMyProductReview(
  token: string,
  productId: string,
  body: { rating: number; comment: string },
): Promise<ProductReview> {
  const response = await request<ProductReview>(
    `/api/v1/products/${encodeURIComponent(productId)}/reviews/me`,
    {
      method: "PUT",
      token,
      body,
    },
  );
  return response.data;
}

export async function deleteMyProductReview(token: string, productId: string): Promise<void> {
  await request<null>(`/api/v1/products/${encodeURIComponent(productId)}/reviews/me`, {
    method: "DELETE",
    token,
  });
}

export async function getSearchAssist(query: string): Promise<ProductSearchAssist> {
  const response = await request<ProductSearchAssist>(
    `/api/v1/products/search/assist${buildQuery({ q: query, limit: 6 })}`,
  );
  return response.data;
}

export async function getProductSearchAssist(
  params: SearchAssistParams = {},
): Promise<ProductSearchAssist> {
  const response = await request<ProductSearchAssist>(
    `/api/v1/products/search/assist${buildQuery({
      q: params.query,
      category: params.category,
      status: params.status,
      limit: params.limit ?? 8,
    })}`,
  );
  return {
    query: response.data?.query ?? params.query ?? "",
    resolved_query: response.data?.resolved_query ?? "",
    applied_synonyms: Array.isArray(response.data?.applied_synonyms)
      ? response.data.applied_synonyms
      : [],
    result_count: response.data?.result_count ?? 0,
    suggestions: Array.isArray(response.data?.suggestions) ? response.data.suggestions : [],
    facets: Array.isArray(response.data?.facets) ? response.data.facets : [],
    sort_options: Array.isArray(response.data?.sort_options) ? response.data.sort_options : [],
  };
}

export async function recordSearchAnalyticsEvent(body: ProductSearchEventRequest): Promise<void> {
  await request<{ accepted: boolean }>("/api/v1/products/analytics/search/events", {
    method: "POST",
    body,
  });
}

export async function getStorefrontHome(): Promise<StorefrontHomeData> {
  const response = await request<StorefrontHomeData>("/api/v1/storefront/home?limit=8");
  return response.data;
}

export async function listCategories(): Promise<StorefrontCategory[]> {
  const response = await request<StorefrontCategory[]>("/api/v1/storefront/categories");
  return response.data;
}

export async function getStorefrontCategory(
  identifier: string,
): Promise<StorefrontCategoryPageData> {
  const response = await request<StorefrontCategoryPageData>(
    `/api/v1/storefront/categories/${encodeURIComponent(identifier)}`,
  );
  return {
    category: response.data.category,
    sections: Array.isArray(response.data.sections) ? response.data.sections : [],
    featured_products: Array.isArray(response.data.featured_products)
      ? response.data.featured_products
      : [],
  };
}

export async function getCatalogPopularity(limit = 8): Promise<ProductPopularity[]> {
  const response = await request<ProductPopularity[]>(
    `/api/v1/catalog/popularity${buildQuery({ limit })}`,
  );
  return Array.isArray(response.data) ? response.data : [];
}
