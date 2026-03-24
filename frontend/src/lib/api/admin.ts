import { request } from "../http/client";
import type {
  AdminOrderReport,
  ApiEnvelope,
  Coupon,
  Order,
  Payment,
} from "../../types/api";
import {
  normalizeAdminOrderReport,
  normalizeCoupon,
  normalizeCouponList,
  normalizeOrder,
  normalizeOrderList,
  normalizePayment,
  normalizePaymentList,
} from "../normalizers";

export interface AdminListOrdersOptions {
  userId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AdminCancelOrderData {
  message?: string;
}

export interface CreateCouponData {
  code: string;
  description?: string;
  discount_type: "fixed" | "percentage";
  discount_value: number;
  min_order_amount?: number;
  usage_limit?: number;
  expires_at?: string;
  active?: boolean;
}

export interface RefundPaymentData {
  amount?: number;
  message?: string;
}

export const adminApi = {
  getOrderReport(
    token: string,
    windowDays = 30
  ): Promise<ApiEnvelope<AdminOrderReport>> {
    return request<unknown>(
      `/api/v1/admin/orders/report?days=${encodeURIComponent(String(windowDays))}`,
      { token }
    ).then((response) => ({
      ...response,
      data: normalizeAdminOrderReport(response.data),
    }));
  },

  listOrders(
    token: string,
    options: AdminListOrdersOptions = {}
  ): Promise<ApiEnvelope<Order[]>> {
    const params = new URLSearchParams();
    params.set("page", String(options.page ?? 1));
    params.set("limit", String(options.limit ?? 20));

    if (options.userId) {
      params.set("user_id", options.userId);
    }
    if (options.status) {
      params.set("status", options.status);
    }
    if (options.from) {
      params.set("from", options.from);
    }
    if (options.to) {
      params.set("to", options.to);
    }

    return request<unknown>(`/api/v1/admin/orders?${params.toString()}`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeOrderList(response.data),
    }));
  },

  cancelOrder(
    token: string,
    orderId: string,
    body: AdminCancelOrderData = {}
  ): Promise<ApiEnvelope<Order>> {
    return request<unknown>(`/api/v1/admin/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "PUT",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeOrder(response.data),
    }));
  },

  listCoupons(token: string): Promise<ApiEnvelope<Coupon[]>> {
    return request<unknown>("/api/v1/admin/coupons", { token }).then((response) => ({
      ...response,
      data: normalizeCouponList(response.data),
    }));
  },

  createCoupon(
    token: string,
    body: CreateCouponData
  ): Promise<ApiEnvelope<Coupon>> {
    return request<unknown>("/api/v1/admin/coupons", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeCoupon(response.data),
    }));
  },

  listPaymentsByOrder(
    token: string,
    orderId: string
  ): Promise<ApiEnvelope<Payment[]>> {
    return request<unknown>(
      `/api/v1/admin/payments/order/${encodeURIComponent(orderId)}/history`,
      { token }
    ).then((response) => ({
      ...response,
      data: normalizePaymentList(response.data),
    }));
  },

  refundPayment(
    token: string,
    paymentId: string,
    body: RefundPaymentData = {}
  ): Promise<ApiEnvelope<Payment>> {
    return request<unknown>(`/api/v1/admin/payments/${encodeURIComponent(paymentId)}/refunds`, {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizePayment(response.data),
    }));
  },
};

export default adminApi;
