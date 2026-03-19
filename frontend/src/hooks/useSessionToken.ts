import { useEffect, useState } from "react";

const sessionTokenKey = "ecommerce_frontend_session_token";
const persistentTokenKey = "ecommerce_frontend_persistent_token";

type StoredTokenState = {
  token: string;
  remember: boolean;
};

function readInitialToken() {
  if (typeof window === "undefined") {
    return {
      token: "",
      remember: false
    } satisfies StoredTokenState;
  }

  const persistentToken = window.localStorage.getItem(persistentTokenKey) ?? "";
  if (persistentToken) {
    return {
      token: persistentToken,
      remember: true
    } satisfies StoredTokenState;
  }

  return {
    token: window.sessionStorage.getItem(sessionTokenKey) ?? "",
    remember: false
  } satisfies StoredTokenState;
}

export function useSessionToken() {
  const [state, setState] = useState(readInitialToken);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (state.token) {
      if (state.remember) {
        window.localStorage.setItem(persistentTokenKey, state.token);
        window.sessionStorage.removeItem(sessionTokenKey);
        return;
      }

      window.sessionStorage.setItem(sessionTokenKey, state.token);
      window.localStorage.removeItem(persistentTokenKey);
      return;
    }

    window.sessionStorage.removeItem(sessionTokenKey);
    window.localStorage.removeItem(persistentTokenKey);
  }, [state]);

  return {
    token: state.token,
    remember: state.remember,
    setToken: (token: string, remember = false) => setState({ token, remember }),
    clearToken: () =>
      setState({
        token: "",
        remember: false
      })
  };
}
