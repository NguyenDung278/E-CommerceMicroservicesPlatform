/**
 * Cart API Module
 * Handles all cart-related API calls including
 * cart operations, items management, and merging.
 */

import { request } from "../http-client";
import type { ApiEnvelope, Cart } from "../../types/api";
import { normalizeCart } from "../normalizers";

/**
 * Add to cart item data
 */
export interface AddToCartItem {
  product_id: string;
  quantity: number;
}

/**
 * Cart API functions
 */
export const cartApi = {
  /**
   * Get current user's cart
   */
  getCart(token: string): Promise<ApiEnvelope<Cart>> {
    return request<unknown>("/api/v1/cart", { token }).then((response) => ({
      ...response,
      data: normalizeCart(response.data),
    }));
  },

  /**
   * Add item to cart
   */
  addToCart(
    token: string,
    item: AddToCartItem
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

  /**
   * Update cart item quantity
   */
  updateCartItem(
    token: string,
    productId: string,
    quantity: number
  ): Promise<ApiEnvelope<Cart>> {
    return request<unknown>(`/api/v1/cart/items/${encodeURIComponent(productId)}`, {
      method: "PUT",
      token,
      body: { quantity },
    }).then((response) => ({
      ...response,
      data: normalizeCart(response.data),
    }));
  },

  /**
   * Remove item from cart
   */
  removeCartItem(
    token: string,
    productId: string
  ): Promise<ApiEnvelope<Cart>> {
    return request<unknown>(`/api/v1/cart/items/${encodeURIComponent(productId)}`, {
      method: "DELETE",
      token,
    }).then((response) => ({
      ...response,
      data: normalizeCart(response.data),
    }));
  },

  /**
   * Clear all items from cart
   */
  clearCart(token: string): Promise<ApiEnvelope<Cart>> {
    return request<unknown>("/api/v1/cart", {
      method: "DELETE",
      token,
    }).then((response) => ({
      ...response,
      data: normalizeCart(response.data),
    }));
  },

  /**
   * Merge guest cart with user cart
   */
  mergeCart(
    token: string,
    guestCartItems: Array<{ product_id: string; quantity: number }>
  ): Promise<ApiEnvelope<Cart>> {
    return request<unknown>("/api/v1/cart/merge", {
      method: "POST",
      token,
      body: { items: guestCartItems },
    }).then((response) => ({
      ...response,
      data: normalizeCart(response.data),
    }));
  },
};

export default cartApi;
