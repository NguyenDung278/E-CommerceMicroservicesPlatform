import { request } from "../http-client";
import type {
  ApiEnvelope,
  StorefrontCategory,
  StorefrontCategoryPageData,
  StorefrontHomeData,
} from "../../types/api";
import {
  normalizeStorefrontCategoryList,
  normalizeStorefrontCategoryPageData,
  normalizeStorefrontHomeData,
} from "../normalizers";

export const storefrontApi = {
  getHome(limit?: number): Promise<ApiEnvelope<StorefrontHomeData>> {
    const query = typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? `?limit=${encodeURIComponent(String(limit))}`
      : "";

    return request<unknown>(`/api/v1/storefront/home${query}`).then((response) => ({
      ...response,
      data: normalizeStorefrontHomeData(response.data),
    }));
  },

  listCategories(): Promise<ApiEnvelope<StorefrontCategory[]>> {
    return request<unknown>("/api/v1/storefront/categories").then((response) => ({
      ...response,
      data: normalizeStorefrontCategoryList(response.data),
    }));
  },

  getCategoryPage(
    identifier: string
  ): Promise<ApiEnvelope<StorefrontCategoryPageData>> {
    return request<unknown>(
      `/api/v1/storefront/categories/${encodeURIComponent(identifier)}`
    ).then((response) => ({
      ...response,
      data: normalizeStorefrontCategoryPageData(response.data),
    }));
  },
};
