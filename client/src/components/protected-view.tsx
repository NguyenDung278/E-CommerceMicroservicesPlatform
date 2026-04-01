"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { LoadingScreen } from "@/components/storefront-ui";
import { useAuthState } from "@/hooks/useAuth";

export function ProtectedView({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen label="Đang xác thực phiên làm việc..." />}>
      <ProtectedViewContent>{children}</ProtectedViewContent>
    </Suspense>
  );
}

function ProtectedViewContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, isBootstrapping } = useAuthState();

  useEffect(() => {
    if (isBootstrapping || isAuthenticated) {
      return;
    }

    const search = searchParams.toString();
    const redirectTarget = `${pathname}${search ? `?${search}` : ""}`;
    router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
  }, [isAuthenticated, isBootstrapping, pathname, router, searchParams]);

  if (isBootstrapping || !isAuthenticated) {
    return <LoadingScreen label="Đang xác thực phiên làm việc..." />;
  }

  return <>{children}</>;
}
