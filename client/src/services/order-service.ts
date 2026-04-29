import { request } from "./http";
import type {
  CreateOrderRequest,
  CreateReturnRequest,
  ApiEnvelope,
  Order,
  OrderEvent,
  OrderPreview,
  ReturnEligibilitySnapshot,
  ReturnRequest,
  ShipmentTracking,
  UserOrderSummary,
} from "../types/api";
import { buildQuery } from "../utils/query";

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

export async function getOrder(token: string, orderId: string): Promise<Order> {
  const response = await request<Order>(`/api/v1/orders/${encodeURIComponent(orderId)}`, {
    token,
  });
  return response.data;
}

export async function cancelOrder(token: string, orderId: string): Promise<void> {
  await request<null>(`/api/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "PUT",
    token,
  });
}

export async function getOrderTimeline(token: string, orderId: string): Promise<OrderEvent[]> {
  const response = await request<OrderEvent[]>(
    `/api/v1/orders/${encodeURIComponent(orderId)}/events`,
    { token },
  );
  return Array.isArray(response.data) ? response.data : [];
}

export async function getShipmentTracking(
  token: string,
  orderId: string,
): Promise<ShipmentTracking | null> {
  const response = await request<ShipmentTracking | null>(
    `/api/v1/orders/${encodeURIComponent(orderId)}/tracking`,
    { token },
  );
  return response.data ?? null;
}

export async function getReturnEligibility(
  token: string,
  orderId: string,
): Promise<ReturnEligibilitySnapshot> {
  const response = await request<ReturnEligibilitySnapshot>(
    `/api/v1/orders/${encodeURIComponent(orderId)}/return-eligibility`,
    { token },
  );
  return {
    order_id: response.data?.order_id ?? orderId,
    order_status: response.data?.order_status ?? "",
    eligible: Boolean(response.data?.eligible),
    reason: response.data?.reason,
    return_window_days: response.data?.return_window_days ?? 30,
    return_window_started_at: response.data?.return_window_started_at,
    return_window_expires_at: response.data?.return_window_expires_at,
    items: Array.isArray(response.data?.items) ? response.data.items : [],
  };
}

export async function createReturnRequest(
  token: string,
  orderId: string,
  body: CreateReturnRequest,
): Promise<ReturnRequest> {
  const response = await request<ReturnRequest>(
    `/api/v1/orders/${encodeURIComponent(orderId)}/returns`,
    {
      method: "POST",
      token,
      body,
    },
  );
  return response.data;
}

export async function listOrderReturns(token: string, orderId: string): Promise<ReturnRequest[]> {
  const response = await request<ReturnRequest[]>(
    `/api/v1/orders/${encodeURIComponent(orderId)}/returns`,
    { token },
  );
  return Array.isArray(response.data) ? response.data : [];
}

export type ReturnListParams = {
  page?: number;
  limit?: number;
  status?: string;
  query?: string;
};

export async function listUserReturns(
  token: string,
  params: ReturnListParams = {},
): Promise<ApiEnvelope<ReturnRequest[]>> {
  const response = await request<ReturnRequest[]>(
    `/api/v1/returns${buildQuery({
      page: params.page ?? 1,
      limit: params.limit ?? 10,
      status: params.status,
      query: params.query,
    })}`,
    { token },
  );
  return {
    ...response,
    data: Array.isArray(response.data) ? response.data : [],
  };
}

export async function getReturn(token: string, returnId: string): Promise<ReturnRequest> {
  const response = await request<ReturnRequest>(`/api/v1/returns/${encodeURIComponent(returnId)}`, {
    token,
  });
  return response.data;
}

export async function uploadReturnEvidence(
  token: string,
  returnId: string,
  file: File,
): Promise<ReturnRequest> {
  const formData = new FormData();
  formData.set("evidence", file);
  const response = await request<ReturnRequest>(
    `/api/v1/returns/${encodeURIComponent(returnId)}/evidence`,
    {
      method: "POST",
      token,
      body: formData,
    },
  );
  return response.data;
}
