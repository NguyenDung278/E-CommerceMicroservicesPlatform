import { request } from "@/lib/api/http-client";
import { normalizeCart } from "@/lib/api/normalizers";
import { createCartApi, type SharedAddToCartItem } from "../../../../shared/web-sdk/api/cart";

export type AddToCartItem = SharedAddToCartItem;

export const cartApi = createCartApi({
  request,
  normalizeCart,
});
