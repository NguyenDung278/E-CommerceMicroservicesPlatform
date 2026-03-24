/**
 * Order API Module
 * Handles all order-related API calls including
 * order creation, management, and history.
 */

import { request } from "../http/client";
import type {
  ApiEnvelope,
  Order,
  OrderEvent,
  OrderPreview,
  ShippingAddress,
} from "../../types/api";
import {
  normalizeOrder,
  normalizeOrderList,
  normalizeOrderEventList,
  normalizeOrderPreview,
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

/**
 * Order API functions
 */
export const orderApi = {
  /**
   * Create a new order
   */
  createOrder(
    token: string,
    body: CreateOrderData
  ): Promise<ApiEnvelope<Order>> {
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
  previewOrder(
    token: string,
    body: PreviewOrderData
  ): Promise<ApiEnvelope<OrderPreview>> {
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
  getOrderEvents(
    token: string,
    orderId: string
  ): Promise<ApiEnvelope<OrderEvent[]>> {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}/events`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeOrderEventList(response.data),
    }));
  },

  /**
   * Cancel order
   */
  cancelOrder(token: string, orderId: string): Promise<ApiEnvelope<Order>> {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "POST",
      token,
    }).then((response) => ({
      ...response,
      data: normalizeOrder(response.data),
    }));
  },

  /**
   * Get admin order report
   */
  getAdminOrderReport(
    token: string,
    windowDays: number = 30
  ): Promise<ApiEnvelope<unknown>> {
    return request<unknown>(
      `/api/v1/admin/orders/report?days=${encodeURIComponent(String(windowDays))}`,
      { token }
    );
  },
};

export default orderApi;
