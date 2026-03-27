"use client";

import { useContext } from "react";

import { WishlistContext } from "@/providers/wishlist-provider";

export function useWishlist() {
  const context = useContext(WishlistContext);

  if (!context) {
    throw new Error("useWishlist must be used within WishlistProvider");
  }

  return context;
}

