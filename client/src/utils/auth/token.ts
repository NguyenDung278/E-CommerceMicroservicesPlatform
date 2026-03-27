const SESSION_ACCESS_TOKEN_KEY = "ecommerce_frontend_session_token";
const SESSION_REFRESH_TOKEN_KEY = "ecommerce_frontend_session_refresh_token";
const PERSISTENT_ACCESS_TOKEN_KEY = "ecommerce_frontend_persistent_token";
const PERSISTENT_REFRESH_TOKEN_KEY = "ecommerce_frontend_persistent_refresh_token";

export type TokenState = {
  token: string;
  refreshToken: string;
  remember: boolean;
};

type StoredPair = {
  accessToken: string;
  refreshToken: string;
  remember: boolean;
} | null;

export function readInitialTokens(): TokenState {
  if (typeof window === "undefined") {
    return {
      token: "",
      refreshToken: "",
      remember: false,
    };
  }

  const persistentTokens = readStoredPair(window.localStorage, true);
  if (persistentTokens) {
    return {
      token: persistentTokens.accessToken,
      refreshToken: persistentTokens.refreshToken,
      remember: persistentTokens.remember,
    };
  }

  const sessionTokens = readStoredPair(window.sessionStorage, false);
  if (sessionTokens) {
    return {
      token: sessionTokens.accessToken,
      refreshToken: sessionTokens.refreshToken,
      remember: sessionTokens.remember,
    };
  }

  clearTokens();
  return {
    token: "",
    refreshToken: "",
    remember: false,
  };
}

export function saveTokens(token: string, refreshToken: string, remember: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedAccessToken = normalizeStoredToken(token);
  const normalizedRefreshToken = normalizeStoredToken(refreshToken);

  if (!normalizedAccessToken && !normalizedRefreshToken) {
    clearTokens();
    return;
  }

  if (remember) {
    window.localStorage.setItem(PERSISTENT_ACCESS_TOKEN_KEY, normalizedAccessToken);
    window.localStorage.setItem(PERSISTENT_REFRESH_TOKEN_KEY, normalizedRefreshToken);
    window.sessionStorage.removeItem(SESSION_ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(SESSION_REFRESH_TOKEN_KEY);
    return;
  }

  window.sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, normalizedAccessToken);
  window.sessionStorage.setItem(SESSION_REFRESH_TOKEN_KEY, normalizedRefreshToken);
  window.localStorage.removeItem(PERSISTENT_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(PERSISTENT_REFRESH_TOKEN_KEY);
}

export function clearTokens(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(SESSION_ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(SESSION_REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(PERSISTENT_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(PERSISTENT_REFRESH_TOKEN_KEY);
}

export function isValidTokenFormat(token: string): boolean {
  if (!token || token.split(".").length !== 3) {
    return false;
  }

  try {
    const parts = token.split(".");
    parts.forEach((part) => {
      decodeBase64Url(part);
    });

    return true;
  } catch {
    return false;
  }
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    return JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);

  if (!payload || typeof payload.exp !== "number") {
    return false;
  }

  return Date.now() >= payload.exp * 1000;
}

function readStoredPair(storage: Storage, remember: boolean): StoredPair {
  const accessToken = normalizeStoredToken(
    storage.getItem(remember ? PERSISTENT_ACCESS_TOKEN_KEY : SESSION_ACCESS_TOKEN_KEY) ?? "",
  );
  const refreshToken = normalizeStoredToken(
    storage.getItem(remember ? PERSISTENT_REFRESH_TOKEN_KEY : SESSION_REFRESH_TOKEN_KEY) ?? "",
  );

  if (!accessToken && !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    remember,
  };
}

function normalizeStoredToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed || !isValidTokenFormat(trimmed) || isTokenExpired(trimmed)) {
    return "";
  }

  return trimmed;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(`${normalized}${padding}`);
}

