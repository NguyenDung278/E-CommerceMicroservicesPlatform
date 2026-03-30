import { startTransition, useCallback, useEffect, useState } from "react";

import { userApi } from "../../../shared/api/modules/userApi";
import type { Address } from "../../../shared/types/api";

type SavedAddressesState = {
  addresses: Address[];
  isLoading: boolean;
};

export function useSavedAddresses(token: string) {
  const [state, setState] = useState<SavedAddressesState>({
    addresses: [],
    isLoading: Boolean(token)
  });

  const refreshAddresses = useCallback(async () => {
    if (!token) {
      startTransition(() => {
        setState({
          addresses: [],
          isLoading: false
        });
      });
      return [];
    }

    startTransition(() => {
      setState((current) => ({ ...current, isLoading: true }));
    });

    try {
      const response = await userApi.listAddresses(token);
      startTransition(() => {
        setState({
          addresses: response.data,
          isLoading: false
        });
      });
      return response.data;
    } catch {
      startTransition(() => {
        setState({
          addresses: [],
          isLoading: false
        });
      });
      return [];
    }
  }, [token]);

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

    void refreshAddresses()
      .then((addresses) => {
        if (!active) {
          return;
        }

        setState({
          addresses,
          isLoading: false
        });
      })

    return () => {
      active = false;
    };
  }, [refreshAddresses, token]);

  return token ? { ...state, refreshAddresses } : { addresses: [], isLoading: false, refreshAddresses };
}
