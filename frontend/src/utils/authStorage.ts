import { sanitizeText } from "./sanitize";

const rememberedLoginKey = "ecommerce_frontend_saved_login";

type RememberedLogin = {
  identifier: string;
};

export function readRememberedLogin() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(rememberedLoginKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<RememberedLogin>;
    const identifier = sanitizeText(String(parsed.identifier ?? ""));

    if (!identifier) {
      return null;
    }

    return {
      identifier
    } satisfies RememberedLogin;
  } catch {
    return null;
  }
}

export function saveRememberedLogin(value: RememberedLogin) {
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
      rememberedLoginKey,
      JSON.stringify({
        identifier
      } satisfies RememberedLogin)
    );
  } catch {
    // Ignore storage write failures so the form still works normally.
  }
}

export function clearRememberedLogin() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(rememberedLoginKey);
  } catch {
    // Ignore storage delete failures so logout/login flows are unaffected.
  }
}
