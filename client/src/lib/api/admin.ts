import { request } from "@/lib/api/http-client";
import { normalizeOrder, normalizeOrderList } from "@/lib/api/normalizers";
import type { AdminOrderReport, ApiEnvelope, Order } from "@/types/api";

export interface AdminListOrdersOptions {
  status?: string;
  cursor?: string;
  page?: number;
  limit?: number;
}

export interface AdminCancelOrderData {
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeAdminOrderReport(value: unknown): AdminOrderReport {
  const report = isRecord(value) ? value : {};

  return {
    window_days: normalizeNumber(report.window_days),
    total_revenue: normalizeNumber(report.total_revenue),
    order_count: normalizeNumber(report.order_count),
    cancelled_count: normalizeNumber(report.cancelled_count),
    average_order_value: normalizeNumber(report.average_order_value),
    top_products: Array.isArray(report.top_products)
      ? report.top_products.map((entry) => {
          const product = isRecord(entry) ? entry : {};

          return {
            product_id: normalizeString(product.product_id),
            name: normalizeString(product.name),
            quantity: normalizeNumber(product.quantity),
            revenue: normalizeNumber(product.revenue),
          };
        })
      : [],
    status_breakdown: Array.isArray(report.status_breakdown)
      ? report.status_breakdown.map((entry) => {
          const item = isRecord(entry) ? entry : {};

          return {
            status: normalizeString(item.status),
            orders: normalizeNumber(item.orders),
            revenue: normalizeNumber(item.revenue),
          };
        })
      : [],
  };
}

export const adminApi = {
  listOrders(token: string, options: AdminListOrdersOptions = {}): Promise<ApiEnvelope<Order[]>> {
    const params = new URLSearchParams();
    params.set("limit", String(options.limit ?? 20));

    if (options.cursor) {
      params.set("cursor", options.cursor);
    } else {
      params.set("page", String(options.page ?? 1));
    }

    if (options.status) {
      params.set("status", options.status);
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
    body: AdminCancelOrderData = {},
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

  getOrderReport(token: string, windowDays = 30): Promise<ApiEnvelope<AdminOrderReport>> {
    return request<unknown>(
      `/api/v1/admin/orders/report?days=${encodeURIComponent(String(windowDays))}`,
      { token },
    ).then((response) => ({
      ...response,
      data: normalizeAdminOrderReport(response.data),
    }));
  },
};
