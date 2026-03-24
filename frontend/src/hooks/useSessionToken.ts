/**
 * Session Token Hook
 * Provides secure token management with React state integration
 */

import { useEffect, useState } from "react";
import {
  readInitialToken,
  saveToken,
  clearToken,
  type TokenState,
} from "../utils/auth/token";

/**
 * Session token hook result
 */
export type UseSessionTokenResult = {
  token: string;
  remember: boolean;
  setToken: (token: string, remember?: boolean) => void;
  clearToken: () => void;
};

/**
 * Custom hook for managing session tokens
 */
export function useSessionToken(): UseSessionTokenResult {
  const [state, setState] = useState<TokenState>(readInitialToken);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (state.token) {
      saveToken(state.token, state.remember);
      return;
    }

    clearToken();
  }, [state]);

  return {
    token: state.token,
    remember: state.remember,
    setToken: (token: string, remember = false) =>
      setState({ token, remember }),
    clearToken: () =>
      setState({
        token: "",
        remember: false,
      }),
  };
}

export default useSessionToken;
