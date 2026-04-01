"use client";

import { useContext } from "react";

import {
  CartActionsContext,
  CartContext,
  CartStateContext,
} from "@/providers/cart-provider";

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }

  return context;
}

export function useCartState() {
  const context = useContext(CartStateContext);

  if (!context) {
    throw new Error("useCartState must be used within CartProvider");
  }

  return context;
}

export function useCartActions() {
  const context = useContext(CartActionsContext);

  if (!context) {
    throw new Error("useCartActions must be used within CartProvider");
  }

  return context;
}
