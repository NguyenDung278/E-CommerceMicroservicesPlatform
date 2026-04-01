import { orderApi, paymentApi, userApi } from "@/lib/api";
import { invalidateCachedResource, peekCachedResource, readCachedResource } from "@/lib/resources/cache";
import type { Address, Order, Payment } from "@/types/api";

const SAVED_ADDRESSES_TTL_MS = 15_000;
const ORDER_PAYMENTS_TTL_MS = 15_000;

export type OrderPaymentsResource = {
  orders: Order[];
  paymentsByOrder: Record<string, Payment[]>;
};

function savedAddressesResourceKey(token: string) {
  return `account:addresses:${token}`;
}

function orderPaymentsResourceKey(token: string) {
  return `account:order-payments:${token}`;
}

export function peekSavedAddressesResource(token: string) {
  return peekCachedResource<Address[]>(savedAddressesResourceKey(token));
}

export function invalidateSavedAddressesResource(token: string) {
  invalidateCachedResource(savedAddressesResourceKey(token));
}

export async function readSavedAddressesResource(
  token: string,
  options?: { forceRefresh?: boolean },
) {
  return readCachedResource(
    savedAddressesResourceKey(token),
    async () => {
      const response = await userApi.listAddresses(token);
      return response.data;
    },
    {
      ttlMs: SAVED_ADDRESSES_TTL_MS,
      forceRefresh: options?.forceRefresh,
    },
  );
}

export function peekOrderPaymentsResource(token: string) {
  return peekCachedResource<OrderPaymentsResource>(orderPaymentsResourceKey(token));
}

export function invalidateOrderPaymentsResource(token: string) {
  invalidateCachedResource(orderPaymentsResourceKey(token));
}

export async function readOrderPaymentsResource(
  token: string,
  options?: { forceRefresh?: boolean },
) {
  return readCachedResource(
    orderPaymentsResourceKey(token),
    async () => {
      try {
        const summaryResponse = await orderApi.getOrderSummary(token);
        return summaryResponse.data;
      } catch {
        const [ordersResponse, paymentHistoryResponse] = await Promise.all([
          orderApi.listOrders(token),
          paymentApi.listPaymentHistory(token),
        ]);

        const orders = (Array.isArray(ordersResponse.data) ? ordersResponse.data : [])
          .slice()
          .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
        const paymentsByOrder: Record<string, Payment[]> = {};

        (Array.isArray(paymentHistoryResponse.data) ? paymentHistoryResponse.data : []).forEach((payment) => {
          if (!paymentsByOrder[payment.order_id]) {
            paymentsByOrder[payment.order_id] = [];
          }

          paymentsByOrder[payment.order_id].push(payment);
        });

        return {
          orders,
          paymentsByOrder,
        };
      }
    },
    {
      ttlMs: ORDER_PAYMENTS_TTL_MS,
      forceRefresh: options?.forceRefresh,
    },
  );
}
