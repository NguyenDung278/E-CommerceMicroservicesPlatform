import { request } from "./http";
import type { CreateOrderRequest, Order, OrderPreview, UserOrderSummary } from "../types/api";

export async function previewOrder(token: string, body: CreateOrderRequest): Promise<OrderPreview> {
  const response = await request<OrderPreview>("/api/v1/orders/preview", {
    method: "POST",
    token,
    body,
  });
  return response.data;
}

export async function createOrder(token: string, body: CreateOrderRequest): Promise<Order> {
  const response = await request<Order>("/api/v1/orders", {
    method: "POST",
    token,
    body,
    headers: {
      "Idempotency-Key": crypto.randomUUID(),
    },
  });
  return response.data;
}

export async function listOrders(token: string): Promise<Order[]> {
  const response = await request<Order[]>("/api/v1/orders", { token });
  return Array.isArray(response.data) ? response.data : [];
}

export async function getOrderSummary(token: string): Promise<UserOrderSummary> {
  const response = await request<UserOrderSummary>("/api/v1/orders/summary", { token });
  return {
    orders: Array.isArray(response.data?.orders) ? response.data.orders : [],
    payments_by_order: response.data?.payments_by_order ?? {},
  };
}
