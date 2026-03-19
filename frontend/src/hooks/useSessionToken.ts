import { useEffect, useState } from "react";

const sessionTokenKey = "ecommerce_frontend_session_token";

function readInitialToken() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.sessionStorage.getItem(sessionTokenKey) ?? "";
}

export function useSessionToken() {
  const [token, setToken] = useState(readInitialToken);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (token) {
      window.sessionStorage.setItem(sessionTokenKey, token);
      return;
    }

    window.sessionStorage.removeItem(sessionTokenKey);
  }, [token]);

  return {
    token,
    setToken,
    clearToken: () => setToken("")
  };
}
