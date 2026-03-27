import { request } from "@/lib/api/http-client";
import { normalizePayment, normalizePaymentList } from "@/lib/api/normalizers";
import type { ApiEnvelope, Payment } from "@/types/api";

export interface ProcessPaymentData {
  order_id: string;
  payment_method: "manual" | "momo" | "credit_card" | "digital_wallet" | "demo";
  amount?: number;
}

export const paymentApi = {
  processPayment(token: string, body: ProcessPaymentData): Promise<ApiEnvelope<Payment>> {
    return request<unknown>("/api/v1/payments", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizePayment(response.data),
    }));
  },

  listPaymentHistory(token: string): Promise<ApiEnvelope<Payment[]>> {
    return request<unknown>("/api/v1/payments/history", { token }).then((response) => ({
      ...response,
      data: normalizePaymentList(response.data),
    }));
  },

  getPaymentById(token: string, paymentId: string): Promise<ApiEnvelope<Payment>> {
    return request<unknown>(`/api/v1/payments/${encodeURIComponent(paymentId)}`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizePayment(response.data),
    }));
  },

  listPaymentsByOrder(token: string, orderId: string): Promise<ApiEnvelope<Payment[]>> {
    return request<unknown>(`/api/v1/payments/order/${encodeURIComponent(orderId)}/history`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizePaymentList(response.data),
    }));
  },
};

