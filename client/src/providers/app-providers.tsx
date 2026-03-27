"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/providers/auth-provider";
import { CartProvider } from "@/providers/cart-provider";
import { WishlistProvider } from "@/providers/wishlist-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>{children}</WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

