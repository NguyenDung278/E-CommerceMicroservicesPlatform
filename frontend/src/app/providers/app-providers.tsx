import type { ReactNode } from "react";

import { AuthProvider } from "@/features/auth/providers/auth-provider";
import { CartProvider } from "@/features/cart/providers/cart-provider";
import { WishlistProvider } from "@/features/wishlist";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>{children}</CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}
