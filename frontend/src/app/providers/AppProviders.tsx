import type { ReactNode } from "react";

import { AuthProvider } from "../../features/auth/providers/AuthProvider";
import { CartProvider } from "../../features/cart/providers/CartProvider";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}
