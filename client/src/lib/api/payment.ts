import { request } from "@/lib/api/http-client";
import { normalizePayment, normalizePaymentList } from "@/lib/api/normalizers";
import {
  createPaymentApi,
  type SharedProcessPaymentData,
} from "@shared/web-sdk/api/payment";

export type ProcessPaymentData = SharedProcessPaymentData<
  "manual" | "momo"
>;

export const paymentApi = createPaymentApi<
  "manual" | "momo"
>({
  request,
  normalizePayment,
  normalizePaymentList,
});
