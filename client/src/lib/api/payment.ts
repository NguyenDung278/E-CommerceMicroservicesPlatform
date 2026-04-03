import { request } from "@/lib/api/http-client";
import { normalizePayment, normalizePaymentList } from "@/lib/api/normalizers";
import {
  createPaymentApi,
  type SharedProcessPaymentData,
} from "../../../../shared/web-sdk/api/payment";

export type ProcessPaymentData = SharedProcessPaymentData<
  "manual" | "momo" | "credit_card" | "digital_wallet" | "demo"
>;

export const paymentApi = createPaymentApi<
  "manual" | "momo" | "credit_card" | "digital_wallet" | "demo"
>({
  request,
  normalizePayment,
  normalizePaymentList,
});
