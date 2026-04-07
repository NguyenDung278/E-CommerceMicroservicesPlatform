const PENDING_POST_LOGIN_ACTION_KEY = "ecommerce_frontend_pending_post_login_action";
const PENDING_POST_LOGIN_ACTION_TTL_MS = 15 * 60 * 1000;

export type PendingProductDetailActionIntent = "add_to_cart" | "buy_now";

export type PendingProductDetailAction = {
  scope: "product_detail";
  intent: PendingProductDetailActionIntent;
  productId: string;
  redirectTo: string;
  quantity: number;
  createdAt: number;
};

type SavePendingProductDetailActionInput = {
  intent: PendingProductDetailActionIntent;
  productId: string;
  redirectTo: string;
  quantity: number;
};

export function savePendingProductDetailAction(
  input: SavePendingProductDetailActionInput
): PendingProductDetailAction | null {
  if (typeof window === "undefined") {
    return null;
  }

  const productId = input.productId.trim();
  const redirectTo = normalizeInternalRedirect(input.redirectTo);
  if (!productId || !redirectTo) {
    clearPendingPostLoginAction();
    return null;
  }

  const nextAction: PendingProductDetailAction = {
    scope: "product_detail",
    intent: input.intent,
    productId,
    redirectTo,
    quantity: normalizeQuantity(input.quantity),
    createdAt: Date.now(),
  };

  window.sessionStorage.setItem(PENDING_POST_LOGIN_ACTION_KEY, JSON.stringify(nextAction));
  return nextAction;
}

export function readPendingProductDetailAction(): PendingProductDetailAction | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(PENDING_POST_LOGIN_ACTION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingProductDetailAction>;
    if (parsed.scope !== "product_detail") {
      clearPendingPostLoginAction();
      return null;
    }

    const productId = typeof parsed.productId === "string" ? parsed.productId.trim() : "";
    const redirectTo =
      typeof parsed.redirectTo === "string" ? normalizeInternalRedirect(parsed.redirectTo) : "";
    const intent =
      parsed.intent === "buy_now" || parsed.intent === "add_to_cart" ? parsed.intent : null;
    const createdAt =
      typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt)
        ? parsed.createdAt
        : 0;

    if (
      !productId ||
      !redirectTo ||
      !intent ||
      createdAt <= 0 ||
      Date.now() - createdAt > PENDING_POST_LOGIN_ACTION_TTL_MS
    ) {
      clearPendingPostLoginAction();
      return null;
    }

    return {
      scope: "product_detail",
      intent,
      productId,
      redirectTo,
      quantity: normalizeQuantity(parsed.quantity),
      createdAt,
    };
  } catch {
    clearPendingPostLoginAction();
    return null;
  }
}

export function clearPendingPostLoginAction(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PENDING_POST_LOGIN_ACTION_KEY);
}

function normalizeInternalRedirect(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "";
  }

  return trimmed;
}

function normalizeQuantity(value: unknown): number {
  const quantity =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : 1;

  if (!Number.isInteger(quantity) || quantity < 1) {
    return 1;
  }

  return quantity;
}
