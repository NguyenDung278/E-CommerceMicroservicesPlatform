import { request } from "./http";
import { buildQuery } from "../utils/query";
import type { CouponWalletItem } from "../types/api";

export async function listPublicCoupons(subtotal?: number): Promise<CouponWalletItem[]> {
  const response = await request<CouponWalletItem[]>(
    `/api/v1/coupons/public${buildQuery({ subtotal })}`,
  );
  return Array.isArray(response.data) ? response.data : [];
}
