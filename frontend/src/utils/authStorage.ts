/**
 * Auth Storage Utilities - Backward Compatibility Layer
 * Maintains the existing interface while using the new token module
 */

import { sanitizeText } from "./sanitize";

const REMEMBERED_LOGIN_KEY = "ecommerce_frontend_saved_login";

type RememberedLogin = {
  identifier: string;
};

/**
 * Read remembered login from local storage
 */
export function readRememberedLogin(): { identifier: string } | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(REMEMBERED_LOGIN_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<RememberedLogin>;
    const identifier = sanitizeText(String(parsed.identifier ?? ""));

    if (!identifier) {
      return null;
    }

    return {
      identifier,
    };
  } catch {
    return null;
  }
}

/**
 * Save remembered login to local storage
 */
export function saveRememberedLogin(value: RememberedLogin): void {
  if (typeof window === "undefined") {
    return;
  }

  const identifier = sanitizeText(value.identifier);

  if (!identifier) {
    clearRememberedLogin();
    return;
  }

  try {
    window.localStorage.setItem(
      REMEMBERED_LOGIN_KEY,
      JSON.stringify({
        identifier,
      })
    );
  } catch {
    // Ignore storage write failures
  }
}

/**
 * Clear remembered login from local storage
 */
export function clearRememberedLogin(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(REMEMBERED_LOGIN_KEY);
  } catch {
    // Ignore storage delete failures
  }
}
