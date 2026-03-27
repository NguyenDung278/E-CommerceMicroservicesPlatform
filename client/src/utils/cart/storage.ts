import type { Cart } from "@/types/api";

const GUEST_CART_STORAGE_KEY = "ecommerce_client_guest_cart";

export function createEmptyGuestCart(): Cart {
  return {
    user_id: "",
    items: [],
    total: 0,
  };
}

export function readGuestCart(): Cart {
  if (typeof window === "undefined") {
    return createEmptyGuestCart();
  }

  try {
    const raw = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);

    if (!raw) {
      return createEmptyGuestCart();
    }

    const parsed = JSON.parse(raw) as Cart;
    if (!Array.isArray(parsed.items)) {
      return createEmptyGuestCart();
    }

    return {
      user_id: "",
      items: parsed.items,
      total: parsed.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    };
  } catch {
    return createEmptyGuestCart();
  }
}

export function saveGuestCart(cart: Cart): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    GUEST_CART_STORAGE_KEY,
    JSON.stringify({
      user_id: "",
      items: cart.items,
      total: cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }),
  );
}

export function clearGuestCart(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(GUEST_CART_STORAGE_KEY);
}

