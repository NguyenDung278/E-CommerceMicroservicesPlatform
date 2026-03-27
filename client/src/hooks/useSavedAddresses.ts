"use client";

import { startTransition, useEffect, useState } from "react";

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

  useEffect(() => {
    let active = true;

    if (!token) {
      return () => {
        active = false;
      };
    }

    startTransition(() => {
      setState((current) => ({ ...current, isLoading: true }));
    });

    void userApi
      .listAddresses(token)
      .then((response) => {
        if (!active) {
          return;
        }

        setState({
          addresses: response.data,
          isLoading: false,
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setState({
          addresses: [],
          isLoading: false,
        });
      });

    return () => {
      active = false;
    };
  }, [token]);

  return token ? state : emptySavedAddressesState;
}
