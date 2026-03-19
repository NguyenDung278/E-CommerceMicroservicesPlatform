import { useEffect, useState } from "react";

import { api, getErrorMessage } from "../lib/api";
import type { Order, Payment } from "../types/api";

type OrderPaymentsState = {
  orders: Order[];
  paymentsByOrder: Record<string, Payment | null>;
  isLoading: boolean;
  error: string;
};

export function useOrderPayments(token: string) {
  const [state, setState] = useState<OrderPaymentsState>({
    orders: [],
    paymentsByOrder: {},
    isLoading: Boolean(token),
    error: ""
  });

  useEffect(() => {
    let active = true;

    if (!token) {
      setState({
        orders: [],
        paymentsByOrder: {},
        isLoading: false,
        error: ""
      });
      return () => {
        active = false;
      };
    }

    setState((current) => ({ ...current, isLoading: true, error: "" }));

    void api
      .listOrders(token)
      .then(async (response) => {
        const orders = response.data
          .slice()
          .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));

        const paymentResults = await Promise.all(
          orders.map(async (order) => {
            try {
              const paymentResponse = await api.getPaymentByOrder(token, order.id);
              return [order.id, paymentResponse.data] as const;
            } catch {
              return [order.id, null] as const;
            }
          })
        );

        if (!active) {
          return;
        }

        setState({
          orders,
          paymentsByOrder: Object.fromEntries(paymentResults),
          isLoading: false,
          error: ""
        });
      })
      .catch((reason) => {
        if (!active) {
          return;
        }

        setState({
          orders: [],
          paymentsByOrder: {},
          isLoading: false,
          error: getErrorMessage(reason)
        });
      });

    return () => {
      active = false;
    };
  }, [token]);

  return state;
}
