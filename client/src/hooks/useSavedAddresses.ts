"use client";

import { startTransition, useCallback, useEffect, useState } from "react";

import { userApi } from "@/lib/api";
import type { Address } from "@/types/api";

type SavedAddressesState = {
  addresses: Address[];
  isLoading: boolean;
};

const emptySavedAddressesState: SavedAddressesState = {
  addresses: [],
  isLoading: false,
};

export function useSavedAddresses(token: string) {
  const [state, setState] = useState<SavedAddressesState>(() =>
    token ? { ...emptySavedAddressesState, isLoading: true } : emptySavedAddressesState,
  );

  const refreshAddresses = useCallback(async () => {
    if (!token) {
      startTransition(() => {
        setState(emptySavedAddressesState);
      });
      return emptySavedAddressesState.addresses;
    }

    startTransition(() => {
      setState((current) => ({ ...current, isLoading: true }));
    });

    try {
      const response = await userApi.listAddresses(token);
      startTransition(() => {
        setState({
          addresses: response.data,
          isLoading: false,
        });
      });
      return response.data;
    } catch {
      startTransition(() => {
        setState({
          addresses: [],
          isLoading: false,
        });
      });
      return [];
    }
  }, [token]);

  useEffect(() => {
    let active = true;

    if (!token) {
      return () => {
        active = false;
      };
    }

    void refreshAddresses().then((addresses) => {
        if (!active) {
          return;
        }

        setState({
          addresses,
          isLoading: false,
        });
      });

    return () => {
      active = false;
    };
  }, [refreshAddresses, token]);

  return token ? { ...state, refreshAddresses } : { ...emptySavedAddressesState, refreshAddresses };
}
