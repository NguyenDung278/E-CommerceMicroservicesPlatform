/**
 * Token Management Module
 * Provides secure token storage and retrieval with
 * support for both session and persistent storage.
 */

const SESSION_TOKEN_KEY = "ecommerce_frontend_session_token";
const PERSISTENT_TOKEN_KEY = "ecommerce_frontend_persistent_token";

/**
 * Token storage state
 */
export type TokenState = {
  token: string;
  remember: boolean;
};

/**
 * Read initial token from storage
 */
export function readInitialToken(): TokenState {
  if (typeof window === "undefined") {
    return {
      token: "",
      remember: false,
    };
  }

  // Check persistent storage first
  const persistentToken = window.localStorage.getItem(PERSISTENT_TOKEN_KEY) ?? "";
  if (isStoredTokenUsable(persistentToken)) {
    return {
      token: persistentToken,
      remember: true,
    };
  }

  // Fall back to session storage
  const sessionToken = window.sessionStorage.getItem(SESSION_TOKEN_KEY) ?? "";
  if (isStoredTokenUsable(sessionToken)) {
    return {
      token: sessionToken,
      remember: false,
    };
  }

  clearToken();
  return {
    token: "",
    remember: false,
  };
}

/**
 * Save token to appropriate storage
 */
export function saveToken(token: string, remember: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!isStoredTokenUsable(token)) {
    clearToken();
    return;
  }

  if (remember) {
    window.localStorage.setItem(PERSISTENT_TOKEN_KEY, token);
    window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } else {
    window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    window.localStorage.removeItem(PERSISTENT_TOKEN_KEY);
  }
}

/**
 * Clear all token storage
 */
export function clearToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
  window.localStorage.removeItem(PERSISTENT_TOKEN_KEY);
}

/**
 * Check if token exists
 */
export function hasToken(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const { token } = readInitialToken();
  return Boolean(token);
}

/**
 * Validate token format (basic check)
 */
export function isValidTokenFormat(token: string): boolean {
  // JWT format: header.payload.signature
  if (!token || token.split(".").length !== 3) {
    return false;
  }

  // Check if it's a valid JWT format (base64 encoded parts)
  try {
    const parts = token.split(".");
    // Verify each part is valid base64
    parts.forEach((part) => {
      // Replace URL-safe characters and check if it's valid base64
      decodeBase64Url(part);
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Decode JWT payload (without verification)
 */
export function decodeJwtPayload(
  token: string
): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const decoded = decodeBase64Url(parts[1]);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);

  if (!payload || typeof payload.exp !== "number") {
    // If no expiration claim, assume token is valid
    return false;
  }

  const expirationTime = payload.exp * 1000; // Convert to milliseconds
  return Date.now() >= expirationTime;
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  const payload = decodeJwtPayload(token);

  if (!payload || typeof payload.exp !== "number") {
    return null;
  }

  return new Date(payload.exp * 1000);
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(`${normalized}${padding}`);
}

function isStoredTokenUsable(token: string): boolean {
  if (!token) {
    return false;
  }

  return isValidTokenFormat(token) && !isTokenExpired(token);
}

export default {
  readInitialToken,
  saveToken,
  clearToken,
  hasToken,
  isValidTokenFormat,
  decodeJwtPayload,
  isTokenExpired,
  getTokenExpiration,
};
