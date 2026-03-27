/**
 * Payment API Module
 * Handles all payment-related API calls including
 * payment processing, history, and verification.
 */

import { request } from "../http/client";
import type { ApiEnvelope, Payment } from "../../types/api";
import { normalizePayment, normalizePaymentList } from "../normalizers";

/**
 * Process payment data
 */
export interface ProcessPaymentData {
  order_id: string;
  payment_method: "manual" | "momo";
  amount?: number;
}

/**
 * Payment API functions
 */
export const paymentApi = {
  /**
   * Process a payment for an order
   */
  processPayment(
    token: string,
    body: ProcessPaymentData
  ): Promise<ApiEnvelope<Payment>> {
    return request<unknown>("/api/v1/payments", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizePayment(response.data),
    }));
  },

  /**
   * Get current user's payments
   */
  listPayments(token: string): Promise<ApiEnvelope<Payment[]>> {
    return request<unknown>("/api/v1/payments/history", { token }).then(
      (response) => ({
        ...response,
        data: normalizePaymentList(response.data),
      })
    );
  },

  /**
   * Get current user's payments
   */
  listPaymentHistory(token: string): Promise<ApiEnvelope<Payment[]>> {
    return request<unknown>("/api/v1/payments/history", { token }).then(
      (response) => ({
        ...response,
        data: normalizePaymentList(response.data),
      })
    );
  },

  /**
   * Get payment by ID
   */
  getPaymentById(
    token: string,
    paymentId: string
  ): Promise<ApiEnvelope<Payment>> {
    return request<unknown>(`/api/v1/payments/${encodeURIComponent(paymentId)}`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizePayment(response.data),
    }));
  },

  /**
   * Get payments for a specific order
   */
  listPaymentsByOrder(
    token: string,
    orderId: string
  ): Promise<ApiEnvelope<Payment[]>> {
    return request<unknown>(`/api/v1/payments/order/${encodeURIComponent(orderId)}/history`, {
      token,
    }).then((response) => ({
      ...response,
      data: normalizePaymentList(response.data),
    }));
  },

  getPaymentsByOrderId(
    token: string,
    orderId: string
  ): Promise<ApiEnvelope<Payment[]>> {
    return paymentApi.listPaymentsByOrder(token, orderId);
  },

  /**
   * Verify payment signature (for webhook verification)
   */
  verifyPaymentSignature(
    token: string,
    paymentId: string
  ): Promise<ApiEnvelope<{ verified: boolean }>> {
    return request<{ verified: boolean }>(
      `/api/v1/payments/${encodeURIComponent(paymentId)}/verify`,
      { token }
    );
  },
};

export default paymentApi;
