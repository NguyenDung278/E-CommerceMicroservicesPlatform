/**
 * Cart Storage Module
 * Provides local storage management for guest carts
 */

import type { Cart } from "../../types/api";

const GUEST_CART_STORAGE_KEY = "nd-shop-guest-cart";

/**
 * Create an empty guest cart
 */
export function createEmptyGuestCart(): Cart {
  return {
    user_id: "",
    items: [],
    total: 0,
  };
}

/**
 * Read guest cart from local storage
 */
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
      total: parsed.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
    };
  } catch {
    return createEmptyGuestCart();
  }
}

/**
 * Save guest cart to local storage
 */
export function saveGuestCart(cart: Cart): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    GUEST_CART_STORAGE_KEY,
    JSON.stringify({
      user_id: "",
      items: cart.items,
      total: cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
    })
  );
}

/**
 * Clear guest cart from local storage
 */
export function clearGuestCart(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(GUEST_CART_STORAGE_KEY);
}

export default {
  createEmptyGuestCart,
  readGuestCart,
  saveGuestCart,
  clearGuestCart,
};
