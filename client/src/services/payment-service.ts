import { request } from "./http";
import type { Payment } from "../types/api";

export type ProcessPaymentRequest = {
  order_id: string;
  payment_method: "manual" | "momo" | "credit_card" | "digital_wallet" | "demo";
  amount?: number;
};

export async function processPayment(token: string, body: ProcessPaymentRequest): Promise<Payment> {
  const response = await request<Payment>("/api/v1/payments", {
    method: "POST",
    token,
    body,
    headers: {
      "Idempotency-Key": crypto.randomUUID(),
    },
  });
  return response.data;
}
