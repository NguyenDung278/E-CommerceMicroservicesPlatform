import { request } from "./http";
import type { Cart } from "../types/api";

export type AddToCartRequest = {
  product_id: string;
  /** Bắt buộc khi sản phẩm có variant; bỏ trống backend trả 400. */
  sku?: string;
  quantity: number;
};

/**
 * Một dòng giỏ hàng được định danh bằng cặp (product_id, sku), nên các thao tác
 * sửa/xoá phải kèm sku qua query param — nếu không sẽ trỏ nhầm sang dòng khác
 * của cùng sản phẩm.
 */
function cartItemPath(productId: string, sku?: string): string {
  const path = `/api/v1/cart/items/${encodeURIComponent(productId)}`;
  return sku ? `${path}?sku=${encodeURIComponent(sku)}` : path;
}

export async function getCart(token: string): Promise<Cart> {
  const response = await request<Cart>("/api/v1/cart", { token });
  return response.data;
}

export async function addCartItem(token: string, body: AddToCartRequest): Promise<Cart> {
  const response = await request<Cart>("/api/v1/cart/items", {
    method: "POST",
    token,
    body,
  });
  return response.data;
}

export async function updateCartItem(
  token: string,
  productId: string,
  quantity: number,
  sku?: string,
): Promise<Cart> {
  const response = await request<Cart>(cartItemPath(productId, sku), {
    method: "PUT",
    token,
    body: { quantity },
  });
  return response.data;
}

export async function removeCartItem(
  token: string,
  productId: string,
  sku?: string,
): Promise<Cart> {
  const response = await request<Cart>(cartItemPath(productId, sku), {
    method: "DELETE",
    token,
  });
  return response.data;
}

export async function clearCart(token: string): Promise<Cart> {
  const response = await request<Cart>("/api/v1/cart", { method: "DELETE", token });
  return response.data;
}
