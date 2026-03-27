"use client";

import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";

type WishlistContextValue = {
  wishlist: string[];
  wishlistCount: number;
  toggleWishlist: (productId: string) => void;
  isSaved: (productId: string) => boolean;
};

const STORAGE_KEY = "ecommerce_client_wishlist";

export const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string => typeof value === "string");
      }
    } catch {
      return [];
    }

    return [];
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
  }, [wishlist]);

  const value = useMemo<WishlistContextValue>(() => ({
    wishlist,
    wishlistCount: wishlist.length,
    toggleWishlist: (productId: string) => {
      setWishlist((current) =>
        current.includes(productId)
          ? current.filter((item) => item !== productId)
          : [...current, productId],
      );
    },
    isSaved: (productId: string) => wishlist.includes(productId),
  }), [wishlist]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
