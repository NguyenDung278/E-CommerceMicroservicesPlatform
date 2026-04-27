import { request } from "./http";
import type { Cart } from "../types/api";

export type AddToCartRequest = {
  product_id: string;
  quantity: number;
};

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
): Promise<Cart> {
  const response = await request<Cart>(`/api/v1/cart/items/${encodeURIComponent(productId)}`, {
    method: "PUT",
    token,
    body: { quantity },
  });
  return response.data;
}

export async function removeCartItem(token: string, productId: string): Promise<Cart> {
  const response = await request<Cart>(`/api/v1/cart/items/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    token,
  });
  return response.data;
}

export async function clearCart(token: string): Promise<Cart> {
  const response = await request<Cart>("/api/v1/cart", { method: "DELETE", token });
  return response.data;
}
