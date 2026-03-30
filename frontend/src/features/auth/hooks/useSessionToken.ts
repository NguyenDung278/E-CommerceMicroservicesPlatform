import { useCallback, useEffect, useState } from "react";

import {
  clearTokens,
  readInitialTokens,
  saveTokens,
  type TokenState,
} from "../storage/sessionTokenStorage";

export type UseSessionTokenResult = {
  token: string;
  refreshToken: string;
  remember: boolean;
  hasSession: boolean;
  setTokens: (token: string, refreshToken: string, remember?: boolean) => void;
  clearTokens: () => void;
};

export function useSessionToken(): UseSessionTokenResult {
  const [state, setState] = useState<TokenState>(readInitialTokens);
  const setTokens = useCallback((token: string, refreshToken: string, remember = false) => {
    setState({ token, refreshToken, remember });
  }, []);
  const clearAllTokens = useCallback(() => {
    setState({
      token: "",
      refreshToken: "",
      remember: false,
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (state.token || state.refreshToken) {
      saveTokens(state.token, state.refreshToken, state.remember);
      return;
    }

    clearTokens();
  }, [state]);

  return {
    token: state.token,
    refreshToken: state.refreshToken,
    remember: state.remember,
    hasSession: Boolean(state.token || state.refreshToken),
    setTokens,
    clearTokens: clearAllTokens,
  };
}

export default useSessionToken;
