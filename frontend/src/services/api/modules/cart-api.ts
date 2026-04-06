import { request } from "../http-client";
import { normalizeCart } from "../normalizers";
import { createCartApi, type SharedAddToCartItem } from "../../../../../shared/web-sdk/api/cart";

export type AddToCartItem = SharedAddToCartItem;

export const cartApi = createCartApi({
  request,
  normalizeCart,
});

export default cartApi;
