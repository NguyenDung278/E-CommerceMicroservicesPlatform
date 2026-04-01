"use client";

import { startTransition, useCallback, useEffect, useState } from "react";

import {
  peekSavedAddressesResource,
  readSavedAddressesResource,
} from "@/lib/resources/account-resources";
import type { Address } from "@/types/api";
import { getErrorMessage } from "@/lib/errors/handler";

type SavedAddressesState = {
  addresses: Address[];
  isLoading: boolean;
  error: string;
};

const emptySavedAddressesState: SavedAddressesState = {
  addresses: [],
  isLoading: false,
  error: "",
};

export function useSavedAddresses(token: string) {
  const cachedAddresses = token ? peekSavedAddressesResource(token) : undefined;
  const [state, setState] = useState<SavedAddressesState>(() =>
    token
      ? {
          addresses: cachedAddresses ?? [],
          isLoading: !cachedAddresses,
          error: "",
        }
      : emptySavedAddressesState,
  );

  const refreshAddresses = useCallback(async (forceRefresh = false) => {
    if (!token) {
      startTransition(() => {
        setState(emptySavedAddressesState);
      });
      return emptySavedAddressesState.addresses;
    }

    startTransition(() => {
      setState((current) => ({ ...current, isLoading: true, error: "" }));
    });

    try {
      const addresses = await readSavedAddressesResource(token, { forceRefresh });
      startTransition(() => {
        setState({
          addresses,
          isLoading: false,
          error: "",
        });
      });
      return addresses;
    } catch (reason) {
      startTransition(() => {
        setState({
          addresses: cachedAddresses ?? [],
          isLoading: false,
          error: getErrorMessage(reason),
        });
      });
      return [];
    }
  }, [cachedAddresses, token]);

  useEffect(() => {
    if (!token) {
      startTransition(() => {
        setState(emptySavedAddressesState);
      });
      return;
    }

    if (cachedAddresses) {
      startTransition(() => {
        setState({
          addresses: cachedAddresses,
          isLoading: false,
          error: "",
        });
      });
      return;
    }

    startTransition(() => {
      setState({
        addresses: [],
        isLoading: true,
        error: "",
      });
    });
    void refreshAddresses();
  }, [cachedAddresses, refreshAddresses, token]);

  return token ? { ...state, refreshAddresses } : { ...emptySavedAddressesState, refreshAddresses };
}
