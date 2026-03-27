import { request } from "@/lib/api/http-client";
import { normalizeCart } from "@/lib/api/normalizers";
import type { ApiEnvelope, Cart } from "@/types/api";

export interface AddToCartItem {
  product_id: string;
  quantity: number;
}

export const cartApi = {
  getCart(token: string): Promise<ApiEnvelope<Cart>> {
    return request<unknown>("/api/v1/cart", { token }).then((response) => ({
      ...response,
      data: normalizeCart(response.data),
    }));
  },

  addToCart(token: string, item: AddToCartItem): Promise<ApiEnvelope<Cart>> {
    return request<unknown>("/api/v1/cart/items", {
      method: "POST",
      token,
      body: item,
    }).then((response) => ({
      ...response,
      data: normalizeCart(response.data),
    }));
  },

  updateCartItem(token: string, productId: string, quantity: number): Promise<ApiEnvelope<Cart>> {
    return request<unknown>(`/api/v1/cart/items/${encodeURIComponent(productId)}`, {
      method: "PUT",
      token,
      body: { quantity },
    }).then((response) => ({
      ...response,
      data: normalizeCart(response.data),
    }));
  },

  removeCartItem(token: string, productId: string): Promise<ApiEnvelope<Cart>> {
    return request<unknown>(`/api/v1/cart/items/${encodeURIComponent(productId)}`, {
      method: "DELETE",
      token,
    }).then((response) => ({
      ...response,
      data: normalizeCart(response.data),
    }));
  },

  clearCart(token: string): Promise<ApiEnvelope<Cart>> {
    return request<unknown>("/api/v1/cart", {
      method: "DELETE",
      token,
    }).then((response) => ({
      ...response,
      data: normalizeCart(response.data),
    }));
  },
};

