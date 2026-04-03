import type { ApiEnvelope, Cart } from "../../types/api";
import type { RequestOptions } from "../http-core";

export interface SharedAddToCartItem {
  product_id: string;
  quantity: number;
}

type RequestLike = <T>(
  path: string,
  options?: RequestOptions
) => Promise<ApiEnvelope<T>>;

interface CreateCartApiConfig {
  request: RequestLike;
  normalizeCart: (value: unknown) => Cart;
}

export function createCartApi(config: CreateCartApiConfig) {
  const { request, normalizeCart } = config;

  return {
    getCart(token: string): Promise<ApiEnvelope<Cart>> {
      return request<unknown>("/api/v1/cart", { token }).then((response) => ({
        ...response,
        data: normalizeCart(response.data),
      }));
    },

    addToCart(
      token: string,
      item: SharedAddToCartItem
    ): Promise<ApiEnvelope<Cart>> {
      return request<unknown>("/api/v1/cart/items", {
        method: "POST",
        token,
        body: item,
      }).then((response) => ({
        ...response,
        data: normalizeCart(response.data),
      }));
    },

    updateCartItem(
      token: string,
      productId: string,
      quantity: number
    ): Promise<ApiEnvelope<Cart>> {
      return request<unknown>(
        `/api/v1/cart/items/${encodeURIComponent(productId)}`,
        {
          method: "PUT",
          token,
          body: { quantity },
        }
      ).then((response) => ({
        ...response,
        data: normalizeCart(response.data),
      }));
    },

    removeCartItem(
      token: string,
      productId: string
    ): Promise<ApiEnvelope<Cart>> {
      return request<unknown>(
        `/api/v1/cart/items/${encodeURIComponent(productId)}`,
        {
          method: "DELETE",
          token,
        }
      ).then((response) => ({
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
}
