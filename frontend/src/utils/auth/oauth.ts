const OAUTH_PENDING_REMEMBER_KEY = "ecommerce_frontend_oauth_pending_remember";

export function savePendingOAuthRemember(remember: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(OAUTH_PENDING_REMEMBER_KEY, remember ? "1" : "0");
}

export function readPendingOAuthRemember(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(OAUTH_PENDING_REMEMBER_KEY) === "1";
}

export function clearPendingOAuthRemember(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(OAUTH_PENDING_REMEMBER_KEY);
}
