import { useEffect, useState } from "react";

import { orderApi, paymentApi } from "../lib/api";
import { getErrorMessage } from "../lib/errors/handler";
import type { Order, Payment } from "../types/api";

type OrderPaymentsState = {
  orders: Order[];
  paymentsByOrder: Record<string, Payment[]>;
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

    void orderApi
      .listOrders(token)
      .then(async (response) => {
        const orders = (Array.isArray(response.data) ? response.data : [])
          .slice()
          .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));

        const paymentHistoryResponse = await paymentApi.listPaymentHistory(token);
        const paymentsByOrder: Record<string, Payment[]> = {};
        (Array.isArray(paymentHistoryResponse.data) ? paymentHistoryResponse.data : []).forEach((payment) => {
          if (!paymentsByOrder[payment.order_id]) {
            paymentsByOrder[payment.order_id] = [];
          }
          paymentsByOrder[payment.order_id].push(payment);
        });

        if (!active) {
          return;
        }

        setState({
          orders,
          paymentsByOrder,
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
