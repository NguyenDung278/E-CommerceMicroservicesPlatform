import { Suspense, lazy, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";

import { ProtectedRoute } from "./router/protected-route";
import { ScrollToTop } from "./router/scroll-to-top";

import { AppProviders } from "./providers/app-providers";

const LoginPage = lazy(() =>
  import("@/pages/auth/login-page").then((module) => ({ default: module.LoginPage }))
);
const RegisterPage = lazy(() =>
  import("@/pages/auth/register-page").then((module) => ({ default: module.RegisterPage }))
);
const ForgotPasswordPage = lazy(() =>
  import("@/pages/auth/forgot-password-page").then((module) => ({
    default: module.ForgotPasswordPage,
  }))
);
const AuthCallbackPage = lazy(() =>
  import("@/pages/auth/auth-callback-page").then((module) => ({
    default: module.AuthCallbackPage,
  }))
);
const VerifyEmailPage = lazy(() =>
  import("@/pages/auth/verify-email-page").then((module) => ({
    default: module.VerifyEmailPage,
  }))
);
const ResetPasswordPage = lazy(() =>
  import("@/pages/auth/reset-password-page").then((module) => ({
    default: module.ResetPasswordPage,
  }))
);
const AdminPage = lazy(() =>
  import("@/pages/admin/admin-page").then((module) => ({ default: module.AdminPage }))
);

function RouteLoadingFallback() {
  return (
    <div className="page-stack">
      <div className="page-state">Loading page...</div>
    </div>
  );
}

function withSuspense(children: ReactNode) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>;
}

function DefaultRoute() {
  const { isAuthenticated, canAccessAdmin, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <RouteLoadingFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  if (!canAccessAdmin) {
    return <Navigate replace to="/forbidden" />;
  }

  return <Navigate replace to="/admin" />;
}

function AccessDeniedPage() {
  const { user, logout } = useAuth();
  const roleLabel = user?.role?.trim() || "unknown";

  return (
    <main className="page-stack">
      <section className="page-state">
        <h1>Access denied</h1>
        <p>
          Tài khoản hiện tại có role <strong>{roleLabel}</strong> và không được phép truy cập khu
          vực admin/workbook của `frontend`.
        </p>
        <div className="button-row">
          <button className="primary-button" type="button" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<DefaultRoute />} path="/" />
          <Route element={withSuspense(<LoginPage />)} path="/login" />
          <Route element={withSuspense(<RegisterPage />)} path="/register" />
          <Route element={withSuspense(<ForgotPasswordPage />)} path="/forgot-password" />
          <Route element={withSuspense(<AuthCallbackPage />)} path="/auth/callback" />
          <Route element={withSuspense(<VerifyEmailPage />)} path="/verify-email" />
          <Route element={withSuspense(<ResetPasswordPage />)} path="/reset-password" />
          <Route element={<AccessDeniedPage />} path="/forbidden" />
          <Route
            element={<ProtectedRoute allowStaff>{withSuspense(<AdminPage />)}</ProtectedRoute>}
            path="/admin"
          />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}
