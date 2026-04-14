/**
 * Order API Module
 * Handles all order-related API calls including
 * order creation, management, and history.
 */

import { request } from "../http-client";
import type {
  ApiEnvelope,
  Order,
  OrderEvent,
  OrderPreview,
  ReturnRequest,
  ShippingAddress,
} from "@/types/api";
import {
  normalizeOrder,
  normalizeOrderList,
  normalizeOrderEventList,
  normalizeOrderPreview,
  normalizeReturnRequest,
  normalizeReturnRequestList,
} from "../normalizers";

/**
 * Order item data
 */
export interface OrderItemData {
  product_id: string;
  quantity: number;
}

/**
 * Create order data
 */
export interface CreateOrderData {
  items: OrderItemData[];
  coupon_code?: string;
  shipping_method: string;
  shipping_address?: ShippingAddress;
}

/**
 * Preview order data
 */
export interface PreviewOrderData {
  items: OrderItemData[];
  coupon_code?: string;
  shipping_method?: string;
  shipping_address?: ShippingAddress;
}

export interface ReturnItemData {
  order_item_id: string;
  quantity: number;
  reason?: string;
}

export interface CreateReturnData {
  reason: string;
  items: ReturnItemData[];
}

export interface ListReturnsOptions {
  query?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/**
 * Order API functions
 */
export const orderApi = {
  /**
   * Create a new order
   */
  createOrder(token: string, body: CreateOrderData): Promise<ApiEnvelope<Order>> {
    return request<unknown>("/api/v1/orders", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeOrder(response.data),
    }));
  },

  /**
   * Preview order with pricing (before creating)
   */
  previewOrder(token: string, body: PreviewOrderData): Promise<ApiEnvelope<OrderPreview>> {
    return request<unknown>("/api/v1/orders/preview", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeOrderPreview(response.data),
    }));
  },

  /**
   * Get current user's orders
   */
  listOrders(token: string): Promise<ApiEnvelope<Order[]>> {
    return request<unknown>("/api/v1/orders", { token }).then((response) => ({
      ...response,
      data: normalizeOrderList(response.data),
    }));
  },

  /**
   * Get order by ID
   */
  getOrderById(token: string, orderId: string): Promise<ApiEnvelope<Order>> {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeOrder(response.data),
    }));
  },

  /**
   * Get order events/history
   */
  getOrderEvents(token: string, orderId: string): Promise<ApiEnvelope<OrderEvent[]>> {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}/events`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeOrderEventList(response.data),
    }));
  },

  /**
   * Get paginated returns for the signed-in customer.
   */
  listReturns(
    token: string,
    options: ListReturnsOptions = {}
  ): Promise<ApiEnvelope<ReturnRequest[]>> {
    const params = new URLSearchParams();
    params.set("page", String(options.page ?? 1));
    params.set("limit", String(options.limit ?? 10));

    if (options.query) {
      params.set("query", options.query);
    }
    if (options.status) {
      params.set("status", options.status);
    }

    return request<unknown>(`/api/v1/returns?${params.toString()}`, { token }).then((response) => ({
      ...response,
      data: normalizeReturnRequestList(response.data),
    }));
  },

  /**
   * Get all returns attached to one order.
   */
  listReturnsByOrder(token: string, orderId: string): Promise<ApiEnvelope<ReturnRequest[]>> {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}/returns`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeReturnRequestList(response.data),
    }));
  },

  /**
   * Get one return request by ID.
   */
  getReturnById(token: string, returnId: string): Promise<ApiEnvelope<ReturnRequest>> {
    return request<unknown>(`/api/v1/returns/${encodeURIComponent(returnId)}`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeReturnRequest(response.data),
    }));
  },

  /**
   * Upload image evidence for one return request.
   */
  uploadReturnEvidence(
    token: string,
    returnId: string,
    files: File[]
  ): Promise<ApiEnvelope<ReturnRequest>> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("evidence", file);
    });

    return request<unknown>(`/api/v1/returns/${encodeURIComponent(returnId)}/evidence`, {
      method: "POST",
      token,
      body: formData,
    }).then((response) => ({
      ...response,
      data: normalizeReturnRequest(response.data),
    }));
  },

  /**
   * Create a new return request for one order.
   */
  createReturn(
    token: string,
    orderId: string,
    body: CreateReturnData
  ): Promise<ApiEnvelope<ReturnRequest>> {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}/returns`, {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeReturnRequest(response.data),
    }));
  },

  /**
   * Cancel order
   */
  cancelOrder(token: string, orderId: string): Promise<ApiEnvelope<Order>> {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "PUT",
      token,
    }).then((response) => ({
      ...response,
      data: normalizeOrder(response.data),
    }));
  },

  /**
   * Get admin order report
   */
  getAdminOrderReport(token: string, windowDays: number = 30): Promise<ApiEnvelope<unknown>> {
    return request<unknown>(
      `/api/v1/admin/orders/report?days=${encodeURIComponent(String(windowDays))}`,
      { token }
    );
  },
};

export default orderApi;
