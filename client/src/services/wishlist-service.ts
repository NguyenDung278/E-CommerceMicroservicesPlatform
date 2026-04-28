import { request } from "./http";
import type { WishlistAlert, WishlistItem } from "../types/api";

export async function listWishlist(token: string): Promise<WishlistItem[]> {
  const response = await request<WishlistItem[]>("/api/v1/users/wishlist", { token });
  return Array.isArray(response.data) ? response.data : [];
}

export async function addWishlistItem(token: string, productId: string): Promise<WishlistItem> {
  const response = await request<WishlistItem>("/api/v1/users/wishlist", {
    method: "POST",
    token,
    body: { product_id: productId },
  });
  return response.data;
}

export async function removeWishlistItem(token: string, productId: string): Promise<void> {
  await request<null>(`/api/v1/users/wishlist/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    token,
  });
}

export async function listWishlistAlerts(token: string): Promise<WishlistAlert[]> {
  const response = await request<WishlistAlert[]>("/api/v1/users/wishlist/alerts", { token });
  return Array.isArray(response.data) ? response.data : [];
}
