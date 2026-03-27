import { request } from "@/lib/api/http-client";
import {
  normalizeOrder,
  normalizeOrderEventList,
  normalizeOrderList,
  normalizeOrderPreview,
} from "@/lib/api/normalizers";
import type {
  ApiEnvelope,
  Order,
  OrderEvent,
  OrderPreview,
  ShippingAddress,
} from "@/types/api";

export interface OrderItemData {
  product_id: string;
  quantity: number;
}

export interface CreateOrderData {
  items: OrderItemData[];
  coupon_code?: string;
  shipping_method: string;
  shipping_address?: ShippingAddress;
}

export interface PreviewOrderData {
  items: OrderItemData[];
  coupon_code?: string;
  shipping_method?: string;
  shipping_address?: ShippingAddress;
}

export const orderApi = {
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

  listOrders(token: string): Promise<ApiEnvelope<Order[]>> {
    return request<unknown>("/api/v1/orders", { token }).then((response) => ({
      ...response,
      data: normalizeOrderList(response.data),
    }));
  },

  getOrderById(token: string, orderId: string): Promise<ApiEnvelope<Order>> {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeOrder(response.data),
    }));
  },

  getOrderEvents(token: string, orderId: string): Promise<ApiEnvelope<OrderEvent[]>> {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}/events`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeOrderEventList(response.data),
    }));
  },

  cancelOrder(token: string, orderId: string): Promise<ApiEnvelope<null>> {
    return request<null>(`/api/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "PUT",
      token,
    });
  },
};

