import { request } from "./http";
import { buildQuery } from "../utils/query";
import type {
  ApiEnvelope,
  Product,
  ProductReviewList,
  ProductSearchAssist,
  StorefrontCategory,
  StorefrontHomeData,
} from "../types/api";

export type ProductListParams = {
  search?: string;
  category?: string;
  cursor?: string;
  limit?: number;
  sort?: string;
};

export async function listProducts(
  params: ProductListParams = {},
): Promise<ApiEnvelope<Product[]>> {
  return request<Product[]>(`/api/v1/products${buildQuery({ limit: 24, ...params })}`);
}

export async function getProduct(productId: string): Promise<Product> {
  const response = await request<Product>(`/api/v1/products/${encodeURIComponent(productId)}`);
  return response.data;
}

export async function getProductReviews(productId: string): Promise<ProductReviewList> {
  const response = await request<ProductReviewList>(
    `/api/v1/products/${encodeURIComponent(productId)}/reviews`,
  );
  return response.data;
}

export async function getSearchAssist(query: string): Promise<ProductSearchAssist> {
  const response = await request<ProductSearchAssist>(
    `/api/v1/products/search/assist${buildQuery({ q: query, limit: 6 })}`,
  );
  return response.data;
}

export async function getStorefrontHome(): Promise<StorefrontHomeData> {
  const response = await request<StorefrontHomeData>("/api/v1/storefront/home?limit=8");
  return response.data;
}

export async function listCategories(): Promise<StorefrontCategory[]> {
  const response = await request<StorefrontCategory[]>("/api/v1/storefront/categories");
  return response.data;
}
