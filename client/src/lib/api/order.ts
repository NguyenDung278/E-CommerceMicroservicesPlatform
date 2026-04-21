import { request } from "@/lib/api/http-client";
import {
  normalizeOrder,
  normalizeOrderEventList,
  normalizeOrderList,
  normalizeOrderPaymentsSummary,
  normalizeOrderPreview,
  normalizeReturnRequest,
  normalizeReturnRequestList,
  normalizeReturnEligibilitySnapshot,
} from "@/lib/api/normalizers";
import type {
  ApiEnvelope,
  Order,
  OrderEvent,
  OrderPaymentsSummary,
  OrderPreview,
  ReturnRequest,
  ReturnEligibilitySnapshot,
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

  getOrderSummary(token: string): Promise<ApiEnvelope<OrderPaymentsSummary>> {
    return request<unknown>("/api/v1/orders/summary", { token }).then((response) => ({
      ...response,
      data: normalizeOrderPaymentsSummary(response.data),
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

  getReturnEligibility(
    token: string,
    orderId: string,
  ): Promise<ApiEnvelope<ReturnEligibilitySnapshot>> {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}/return-eligibility`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeReturnEligibilitySnapshot(response.data),
    }));
  },

  listReturns(
    token: string,
    options: ListReturnsOptions = {},
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

    return request<unknown>(`/api/v1/returns?${params.toString()}`, { token }).then(
      (response) => ({
        ...response,
        data: normalizeReturnRequestList(response.data),
      }),
    );
  },

  listReturnsByOrder(token: string, orderId: string): Promise<ApiEnvelope<ReturnRequest[]>> {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}/returns`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeReturnRequestList(response.data),
    }));
  },

  getReturnById(token: string, returnId: string): Promise<ApiEnvelope<ReturnRequest>> {
    return request<unknown>(`/api/v1/returns/${encodeURIComponent(returnId)}`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizeReturnRequest(response.data),
    }));
  },

  uploadReturnEvidence(
    token: string,
    returnId: string,
    files: File[],
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

  createReturn(
    token: string,
    orderId: string,
    body: CreateReturnData,
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

  cancelOrder(token: string, orderId: string): Promise<ApiEnvelope<null>> {
    return request<null>(`/api/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "PUT",
      token,
    });
  },
};
