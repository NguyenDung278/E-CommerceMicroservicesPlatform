import type { ApiEnvelope, Payment } from "../../types/api";
import type { RequestOptions } from "../http-core";

export interface SharedProcessPaymentData<TPaymentMethod extends string = string> {
  order_id: string;
  payment_method: TPaymentMethod;
  amount?: number;
}

type RequestLike = <T>(
  path: string,
  options?: RequestOptions
) => Promise<ApiEnvelope<T>>;

interface CreatePaymentApiConfig {
  request: RequestLike;
  normalizePayment: (value: unknown) => Payment;
  normalizePaymentList: (value: unknown) => Payment[];
}

export function createPaymentApi<TPaymentMethod extends string = string>(
  config: CreatePaymentApiConfig
) {
  const { request, normalizePayment, normalizePaymentList } = config;

  return {
    processPayment(
      token: string,
      body: SharedProcessPaymentData<TPaymentMethod>
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

    listPaymentHistory(token: string): Promise<ApiEnvelope<Payment[]>> {
      return request<unknown>("/api/v1/payments/history", { token }).then(
        (response) => ({
          ...response,
          data: normalizePaymentList(response.data),
        })
      );
    },

    getPaymentById(
      token: string,
      paymentId: string
    ): Promise<ApiEnvelope<Payment>> {
      return request<unknown>(
        `/api/v1/payments/${encodeURIComponent(paymentId)}`,
        {
          token,
        }
      ).then((response) => ({
        ...response,
        data: normalizePayment(response.data),
      }));
    },

    listPaymentsByOrder(
      token: string,
      orderId: string
    ): Promise<ApiEnvelope<Payment[]>> {
      return request<unknown>(
        `/api/v1/payments/order/${encodeURIComponent(orderId)}/history`,
        {
          token,
        }
      ).then((response) => ({
        ...response,
        data: normalizePaymentList(response.data),
      }));
    },
  };
}
