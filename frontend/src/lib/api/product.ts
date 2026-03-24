/**
 * Product API Module
 * Handles all product-related API calls including
 * listing, searching, and managing products.
 */

import { request } from "../http/client";
import type {
  ApiEnvelope,
  Product,
  ProductPopularity,
  UploadedProductImages,
} from "../../types/api";
import {
  normalizeProduct,
  normalizeProductList,
  normalizeProductPopularity,
} from "../normalizers";

/**
 * Product list query options
 */
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
}

/**
 * Create product data
 */
export interface CreateProductData {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  brand: string;
  tags: string[];
  status: string;
  sku: string;
  variants: Array<{
    sku: string;
    label: string;
    size?: string;
    color?: string;
    price: number;
    stock: number;
  }>;
  image_url: string;
  image_urls: string[];
}

/**
 * Update product data
 */
export interface UpdateProductData {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  category?: string;
  brand?: string;
  tags?: string[];
  status?: string;
  sku?: string;
  variants?: CreateProductData["variants"];
  image_url?: string;
  image_urls?: string[];
}

/**
 * Product API functions
 */
export const productApi = {
  /**
   * List products with filters and pagination
   */
  listProducts(options?: ProductListOptions): Promise<ApiEnvelope<Product[]>> {
    const params = new URLSearchParams();
    params.set("limit", String(options?.limit ?? 24));

    if (options?.search) {
      params.set("search", options.search);
    }
    if (options?.category) {
      params.set("category", options.category);
    }
    if (options?.brand) {
      params.set("brand", options.brand);
    }
    if (options?.tag) {
      params.set("tag", options.tag);
    }
    if (options?.status) {
      params.set("status", options.status);
    }
    if (typeof options?.minPrice === "number" && options.minPrice > 0) {
      params.set("min_price", String(options.minPrice));
    }
    if (typeof options?.maxPrice === "number" && options.maxPrice > 0) {
      params.set("max_price", String(options.maxPrice));
    }
    if (options?.size) {
      params.set("size", options.size);
    }
    if (options?.color) {
      params.set("color", options.color);
    }
    if (options?.sort) {
      params.set("sort", options.sort);
    }

    const query = `?${params.toString()}`;
    return request<unknown>(`/api/v1/products${query}`).then((response) => ({
      ...response,
      data: normalizeProductList(response.data),
    }));
  },

  /**
   * Get product by ID
   */
  getProductById(productId: string): Promise<ApiEnvelope<Product>> {
    return request<unknown>(`/api/v1/products/${encodeURIComponent(productId)}`).then(
      (response) => {
        if (!isRecord(response.data)) {
          throw new Error("Invalid product response");
        }

        return {
          ...response,
          data: normalizeProduct(response.data),
        };
      }
    );
  },

  /**
   * Get product popularity (trending products)
   */
  getProductPopularity(
    limit = 100
  ): Promise<ApiEnvelope<ProductPopularity[]>> {
    return request<ProductPopularity[]>(
      `/api/v1/catalog/popularity?limit=${encodeURIComponent(String(limit))}`
    ).then((response) => ({
      ...response,
      data: response.data.map((item) => normalizeProductPopularity(item)),
    }));
  },

  /**
   * Create a new product (admin)
   */
  createProduct(
    token: string,
    body: CreateProductData
  ): Promise<ApiEnvelope<Product>> {
    return request<unknown>("/api/v1/products", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeProduct(response.data),
    }));
  },

  /**
   * Upload product images
   */
  uploadProductImages(
    token: string,
    files: File[]
  ): Promise<ApiEnvelope<UploadedProductImages>> {
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

  /**
   * Update a product (admin)
   */
  updateProduct(
    token: string,
    productId: string,
    body: UpdateProductData
  ): Promise<ApiEnvelope<Product>> {
    return request<unknown>(`/api/v1/products/${encodeURIComponent(productId)}`, {
      method: "PUT",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeProduct(response.data),
    }));
  },

  /**
   * Delete a product (admin)
   */
  deleteProduct(token: string, productId: string): Promise<ApiEnvelope<null>> {
    return request<null>(`/api/v1/products/${encodeURIComponent(productId)}`, {
      method: "DELETE",
      token,
    });
  },
};

/**
 * Type guard for record
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default productApi;
