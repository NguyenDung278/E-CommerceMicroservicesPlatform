import { request } from "@/lib/api/http-client";
import {
  normalizeProduct,
  normalizeProductList,
  normalizeProductPopularity,
  normalizeProductReview,
  normalizeProductReviewList,
} from "@/lib/api/normalizers";
import type {
  ApiEnvelope,
  Product,
  ProductPopularity,
  ProductReview,
  ProductReviewList,
  UploadedProductImages,
} from "@/types/api";

export interface ProductListOptions {
  search?: string;
  category?: string;
  brand?: string;
  tag?: string;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  color?: string;
  sort?: "latest" | "price_asc" | "price_desc" | "popular";
  limit?: number;
  cursor?: string;
}

export interface ProductReviewListOptions {
  page?: number;
  limit?: number;
}

export interface ProductReviewData {
  rating: number;
  comment?: string;
}

export const productApi = {
  listProducts(options?: ProductListOptions): Promise<ApiEnvelope<Product[]>> {
    const params = new URLSearchParams();
    params.set("limit", String(options?.limit ?? 24));

    if (options?.search) params.set("search", options.search);
    if (options?.category) params.set("category", options.category);
    if (options?.brand) params.set("brand", options.brand);
    if (options?.tag) params.set("tag", options.tag);
    if (options?.status) params.set("status", options.status);
    if (typeof options?.minPrice === "number" && options.minPrice > 0) params.set("min_price", String(options.minPrice));
    if (typeof options?.maxPrice === "number" && options.maxPrice > 0) params.set("max_price", String(options.maxPrice));
    if (options?.size) params.set("size", options.size);
    if (options?.color) params.set("color", options.color);
    if (options?.sort) params.set("sort", options.sort);
    if (options?.cursor) params.set("cursor", options.cursor);

    return request<unknown>(`/api/v1/products?${params.toString()}`).then((response) => ({
      ...response,
      data: normalizeProductList(response.data),
    }));
  },

  getProductById(productId: string): Promise<ApiEnvelope<Product>> {
    return request<unknown>(`/api/v1/products/${encodeURIComponent(productId)}`).then((response) => ({
      ...response,
      data: normalizeProduct(response.data),
    }));
  },

  getProductsByIds(productIds: string[]): Promise<ApiEnvelope<Product[]>> {
    const params = new URLSearchParams();
    productIds.forEach((productId) => {
      const normalizedProductId = productId.trim();
      if (normalizedProductId) {
        params.append("ids", normalizedProductId);
      }
    });

    return request<unknown>(`/api/v1/products/batch?${params.toString()}`).then((response) => ({
      ...response,
      data: normalizeProductList(response.data),
    }));
  },

  listProductReviews(productId: string, options: ProductReviewListOptions = {}): Promise<ApiEnvelope<ProductReviewList>> {
    const params = new URLSearchParams();
    params.set("page", String(options.page ?? 1));
    params.set("limit", String(options.limit ?? 10));

    return request<unknown>(`/api/v1/products/${encodeURIComponent(productId)}/reviews?${params.toString()}`).then((response) => ({
      ...response,
      data: normalizeProductReviewList(response.data),
    }));
  },

  getMyProductReview(token: string, productId: string): Promise<ApiEnvelope<ProductReview>> {
    return request<unknown>(`/api/v1/products/${encodeURIComponent(productId)}/reviews/me`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeProductReview(response.data),
    }));
  },

  createProductReview(token: string, productId: string, body: ProductReviewData): Promise<ApiEnvelope<ProductReview>> {
    return request<unknown>(`/api/v1/products/${encodeURIComponent(productId)}/reviews`, {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeProductReview(response.data),
    }));
  },

  updateMyProductReview(token: string, productId: string, body: ProductReviewData): Promise<ApiEnvelope<ProductReview>> {
    return request<unknown>(`/api/v1/products/${encodeURIComponent(productId)}/reviews/me`, {
      method: "PUT",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeProductReview(response.data),
    }));
  },

  deleteMyProductReview(token: string, productId: string): Promise<ApiEnvelope<null>> {
    return request<null>(`/api/v1/products/${encodeURIComponent(productId)}/reviews/me`, {
      method: "DELETE",
      token,
    });
  },

  getProductPopularity(limit = 24): Promise<ApiEnvelope<ProductPopularity[]>> {
    return request<ProductPopularity[]>(`/api/v1/catalog/popularity?limit=${encodeURIComponent(String(limit))}`).then((response) => ({
      ...response,
      data: response.data.map((item) => normalizeProductPopularity(item)),
    }));
  },

  uploadProductImages(token: string, files: File[]): Promise<ApiEnvelope<UploadedProductImages>> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });

    return request<UploadedProductImages>("/api/v1/products/uploads", {
      method: "POST",
      token,
      body: formData,
    });
  },
};
