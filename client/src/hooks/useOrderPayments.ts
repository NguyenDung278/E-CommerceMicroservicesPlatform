"use client";

import { startTransition, useCallback, useEffect, useState } from "react";

import { getErrorMessage } from "@/lib/errors/handler";
import {
  peekOrderPaymentsResource,
  readOrderPaymentsResource,
} from "@/lib/resources/account-resources";
import type { Order, Payment } from "@/types/api";

type OrderPaymentsState = {
  orders: Order[];
  paymentsByOrder: Record<string, Payment[]>;
  isLoading: boolean;
  error: string;
};

const emptyOrderPaymentsState: OrderPaymentsState = {
  orders: [],
  paymentsByOrder: {},
  isLoading: false,
  error: "",
};

export function useOrderPayments(token: string) {
  const cachedOrderPayments = token ? peekOrderPaymentsResource(token) : undefined;
  const [state, setState] = useState<OrderPaymentsState>(() =>
    token
      ? {
          orders: cachedOrderPayments?.orders ?? [],
          paymentsByOrder: cachedOrderPayments?.paymentsByOrder ?? {},
          isLoading: !cachedOrderPayments,
          error: "",
        }
      : emptyOrderPaymentsState,
  );

  const refreshOrderPayments = useCallback(async (forceRefresh = false) => {
    if (!token) {
      startTransition(() => {
        setState(emptyOrderPaymentsState);
      });
      return emptyOrderPaymentsState;
    }

    startTransition(() => {
      setState((current) => ({ ...current, isLoading: true, error: "" }));
    });

    try {
      const resource = await readOrderPaymentsResource(token, { forceRefresh });
      startTransition(() => {
        setState({
          orders: resource.orders,
          paymentsByOrder: resource.paymentsByOrder,
          isLoading: false,
          error: "",
        });
      });
      return {
        orders: resource.orders,
        paymentsByOrder: resource.paymentsByOrder,
        isLoading: false,
        error: "",
      };
    } catch (reason) {
      const fallbackState: OrderPaymentsState = {
        orders: cachedOrderPayments?.orders ?? [],
        paymentsByOrder: cachedOrderPayments?.paymentsByOrder ?? {},
        isLoading: false,
        error: getErrorMessage(reason),
      };
      startTransition(() => {
        setState({
          ...fallbackState,
        });
      });
      return fallbackState;
    }
  }, [cachedOrderPayments, token]);

  useEffect(() => {
    if (!token) {
      startTransition(() => {
        setState(emptyOrderPaymentsState);
      });
      return;
    }

    if (cachedOrderPayments) {
      startTransition(() => {
        setState({
          orders: cachedOrderPayments.orders,
          paymentsByOrder: cachedOrderPayments.paymentsByOrder,
          isLoading: false,
          error: "",
        });
      });
      return;
    }

    startTransition(() => {
      setState({
        orders: [],
        paymentsByOrder: {},
        isLoading: true,
        error: "",
      });
    });
    void refreshOrderPayments();
  }, [cachedOrderPayments, refreshOrderPayments, token]);

  return token ? { ...state, refreshOrderPayments } : { ...emptyOrderPaymentsState, refreshOrderPayments };
}
