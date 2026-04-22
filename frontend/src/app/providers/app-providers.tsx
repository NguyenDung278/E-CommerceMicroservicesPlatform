import type { ReactNode } from "react";

import { AuthProvider } from "@/features/auth/providers/auth-provider";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return <AuthProvider>{children}</AuthProvider>;
}
