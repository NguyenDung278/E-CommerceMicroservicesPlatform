import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

type ProtectedRouteProps = {
  children: ReactNode;
  requireAdmin?: boolean;
  allowStaff?: boolean;
};

export function ProtectedRoute({ children, requireAdmin = false, allowStaff = false }: ProtectedRouteProps) {
  const location = useLocation();
  const { isAuthenticated, isAdmin, canAccessAdmin, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <div className="page-state">Đang xác thực phiên làm việc...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  if (allowStaff && !canAccessAdmin) {
    return <Navigate replace to="/" />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate replace to="/" />;
  }

  return <>{children}</>;
}
