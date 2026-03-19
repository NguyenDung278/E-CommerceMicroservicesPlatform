import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

type ProtectedRouteProps = {
  children: ReactNode;
  requireAdmin?: boolean;
};

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <div className="page-state">Đang xác thực phiên làm việc...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/auth" />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate replace to="/" />;
  }

  return <>{children}</>;
}
