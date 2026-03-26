import { useEffect, useState } from "react";

import { api } from "../lib/api";
import type { Address } from "../types/api";

type SavedAddressesState = {
  addresses: Address[];
  isLoading: boolean;
};

export function useSavedAddresses(token: string) {
  const [state, setState] = useState<SavedAddressesState>({
    addresses: [],
    isLoading: Boolean(token)
  });

  useEffect(() => {
    let active = true;

    if (!token) {
      setState({
        addresses: [],
        isLoading: false
      });
      return () => {
        active = false;
      };
    }

    setState((current) => ({ ...current, isLoading: true }));

    void api
      .listAddresses(token)
      .then((response) => {
        if (!active) {
          return;
        }

        setState({
          addresses: response.data,
          isLoading: false
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setState({
          addresses: [],
          isLoading: false
        });
      });

    return () => {
      active = false;
    };
  }, [token]);

  return state;
}
