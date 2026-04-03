import { request } from "../http-client";
import { normalizePayment, normalizePaymentList } from "../normalizers";
import {
  createPaymentApi,
  type SharedProcessPaymentData,
} from "../../../../../shared/web-sdk/api/payment";

export type ProcessPaymentData = SharedProcessPaymentData<"manual" | "momo">;

const basePaymentApi = createPaymentApi<"manual" | "momo">({
  request,
  normalizePayment,
  normalizePaymentList,
});

export const paymentApi = {
  ...basePaymentApi,
  listPayments: basePaymentApi.listPaymentHistory,

  getPaymentsByOrderId(
    token: string,
    orderId: string
  ) {
    return basePaymentApi.listPaymentsByOrder(token, orderId);
  },
};

export default paymentApi;
