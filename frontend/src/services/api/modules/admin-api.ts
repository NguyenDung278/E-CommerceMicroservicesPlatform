import { request } from "../http-client";
import type {
  AdminOrderReport,
  ApiEnvelope,
  Coupon,
  Order,
  Payment,
  ProductSearchAnalyticsSummary,
  ReturnQueueHealth,
  ReturnRequest,
} from "@/types/api";
import {
  normalizeAdminOrderReport,
  normalizeCoupon,
  normalizeCouponList,
  normalizeOrder,
  normalizeOrderList,
  normalizePayment,
  normalizePaymentList,
  normalizeProductSearchAnalyticsSummary,
  normalizeReturnQueueHealth,
  normalizeReturnRequest,
  normalizeReturnRequestList,
} from "../normalizers";

export interface AdminListOrdersOptions {
  userId?: string;
  status?: string;
  from?: string;
  to?: string;
  cursor?: string;
  page?: number;
  limit?: number;
}

export interface AdminCancelOrderData {
  message?: string;
}

export interface AdminListReturnsOptions {
  query?: string;
  status?: string;
  page?: number;
  limit?: number;
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

export interface UpdateReturnStatusData {
  status: "approved" | "rejected" | "received" | "cancelled";
  message?: string;
}

export interface RequestReturnRefundData {
  message?: string;
}

export interface SearchAnalyticsOptions {
  days?: number;
  limit?: number;
}

export const adminApi = {
  /**
   * Load the paginated admin returns queue with optional filters.
   */
  listReturns(
    token: string,
    options: AdminListReturnsOptions = {}
  ): Promise<ApiEnvelope<ReturnRequest[]>> {
    const params = new URLSearchParams();
    params.set("page", String(options.page ?? 1));
    params.set("limit", String(options.limit ?? 20));

    if (options.query) {
      params.set("query", options.query);
    }
    if (options.status) {
      params.set("status", options.status);
    }

    return request<unknown>(`/api/v1/admin/returns?${params.toString()}`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeReturnRequestList(response.data),
    }));
  },

  getReturnQueueHealth(token: string): Promise<ApiEnvelope<ReturnQueueHealth>> {
    return request<unknown>("/api/v1/admin/returns/health", { token }).then((response) => ({
      ...response,
      data: normalizeReturnQueueHealth(response.data),
    }));
  },

  getOrderReport(token: string, windowDays = 30): Promise<ApiEnvelope<AdminOrderReport>> {
    return request<unknown>(
      `/api/v1/admin/orders/report?days=${encodeURIComponent(String(windowDays))}`,
      { token }
    ).then((response) => ({
      ...response,
      data: normalizeAdminOrderReport(response.data),
    }));
  },

  getSearchAnalytics(
    token: string,
    options: SearchAnalyticsOptions = {}
  ): Promise<ApiEnvelope<ProductSearchAnalyticsSummary>> {
    const params = new URLSearchParams();
    params.set("days", String(options.days ?? 30));
    params.set("limit", String(options.limit ?? 10));

    return request<unknown>(`/api/v1/products/analytics/search?${params.toString()}`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeProductSearchAnalyticsSummary(response.data),
    }));
  },

  listOrders(token: string, options: AdminListOrdersOptions = {}): Promise<ApiEnvelope<Order[]>> {
    const params = new URLSearchParams();
    params.set("limit", String(options.limit ?? 20));

    if (options.cursor) {
      params.set("cursor", options.cursor);
    } else {
      params.set("page", String(options.page ?? 1));
    }

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

  createCoupon(token: string, body: CreateCouponData): Promise<ApiEnvelope<Coupon>> {
    return request<unknown>("/api/v1/admin/coupons", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeCoupon(response.data),
    }));
  },

  listPaymentsByOrder(token: string, orderId: string): Promise<ApiEnvelope<Payment[]>> {
    return request<unknown>(`/api/v1/admin/payments/order/${encodeURIComponent(orderId)}/history`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizePaymentList(response.data),
    }));
  },

  listPaymentsByOrders(
    token: string,
    orderIds: string[]
  ): Promise<ApiEnvelope<Record<string, Payment[]>>> {
    const params = new URLSearchParams();
    orderIds.forEach((orderId) => {
      const normalizedOrderId = orderId.trim();
      if (normalizedOrderId) {
        params.append("order_ids", normalizedOrderId);
      }
    });

    if (!params.toString()) {
      return Promise.resolve({
        success: true,
        message: "payments retrieved",
        data: {},
      });
    }

    return request<unknown>(`/api/v1/admin/payments/history?${params.toString()}`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizePaymentsByOrderRecord(response.data),
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

  /**
   * Update a return lifecycle status from the admin surface.
   */
  updateReturnStatus(
    token: string,
    returnId: string,
    body: UpdateReturnStatusData
  ): Promise<ApiEnvelope<ReturnRequest>> {
    return request<unknown>(`/api/v1/admin/returns/${encodeURIComponent(returnId)}/status`, {
      method: "PUT",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeReturnRequest(response.data),
    }));
  },

  /**
   * Queue or retry an asynchronous refund for a return.
   */
  requestReturnRefund(
    token: string,
    returnId: string,
    body: RequestReturnRefundData = {}
  ): Promise<ApiEnvelope<ReturnRequest>> {
    return request<unknown>(`/api/v1/admin/returns/${encodeURIComponent(returnId)}/refund`, {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeReturnRequest(response.data),
    }));
  },
};

export default adminApi;

function normalizePaymentsByOrderRecord(value: unknown): Record<string, Payment[]> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, Payment[]>>((result, [orderId, payments]) => {
    result[orderId] = normalizePaymentList(payments);
    return result;
  }, {});
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
