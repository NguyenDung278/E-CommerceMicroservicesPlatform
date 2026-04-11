import { Suspense, lazy, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./router/protected-route";
import { ScrollToTop } from "./router/scroll-to-top";

import { AppProviders } from "./providers/app-providers";

const AppLayout = lazy(() =>
  import("./layout/app-layout").then((module) => ({ default: module.AppLayout }))
);
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
const HomePage = lazy(() =>
  import("@/pages/storefront/home-page").then((module) => ({ default: module.HomePage }))
);
const CatalogPage = lazy(() =>
  import("@/pages/storefront/catalog-page").then((module) => ({ default: module.CatalogPage }))
);
const ProductDetailPage = lazy(() =>
  import("@/pages/storefront/product-detail-page").then((module) => ({
    default: module.ProductDetailPage,
  }))
);
const CategoryPage = lazy(() =>
  import("@/pages/storefront/category-page").then((module) => ({ default: module.CategoryPage }))
);
const CartPage = lazy(() =>
  import("@/pages/storefront/cart-page").then((module) => ({ default: module.CartPage }))
);
const CheckoutPage = lazy(() =>
  import("@/pages/storefront/checkout-page").then((module) => ({
    default: module.CheckoutPage,
  }))
);
const ProfilePage = lazy(() =>
  import("@/pages/account/profile-page").then((module) => ({ default: module.ProfilePage }))
);
const OrdersPage = lazy(() =>
  import("@/pages/account/orders-page").then((module) => ({ default: module.OrdersPage }))
);
const AddressesPage = lazy(() =>
  import("@/pages/account/addresses-page").then((module) => ({
    default: module.AddressesPage,
  }))
);
const OrderDetailPage = lazy(() =>
  import("@/pages/account/order-detail-page").then((module) => ({
    default: module.OrderDetailPage,
  }))
);
const PaymentHistoryPage = lazy(() =>
  import("@/pages/account/payment-history-page").then((module) => ({
    default: module.PaymentHistoryPage,
  }))
);
const SecurityPage = lazy(() =>
  import("@/pages/account/security-page").then((module) => ({ default: module.SecurityPage }))
);
const NotificationsPage = lazy(() =>
  import("@/pages/account/notifications-page").then((module) => ({
    default: module.NotificationsPage,
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

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={withSuspense(<LoginPage />)} path="/login" />
          <Route element={withSuspense(<RegisterPage />)} path="/register" />
          <Route element={withSuspense(<ForgotPasswordPage />)} path="/forgot-password" />
          <Route element={withSuspense(<AuthCallbackPage />)} path="/auth/callback" />
          <Route element={withSuspense(<VerifyEmailPage />)} path="/verify-email" />
          <Route element={withSuspense(<ResetPasswordPage />)} path="/reset-password" />

          <Route element={withSuspense(<AppLayout />)} path="/">
            <Route element={withSuspense(<HomePage />)} index />
            <Route element={withSuspense(<CatalogPage />)} path="products" />
            <Route element={withSuspense(<ProductDetailPage />)} path="products/:productId" />
            <Route element={withSuspense(<CategoryPage />)} path="categories/:categoryName" />
            <Route element={withSuspense(<CartPage />)} path="cart" />
            <Route element={withSuspense(<CheckoutPage />)} path="checkout" />
            <Route
              element={<ProtectedRoute>{withSuspense(<ProfilePage />)}</ProtectedRoute>}
              path="profile"
            />
            <Route
              element={<ProtectedRoute>{withSuspense(<OrdersPage />)}</ProtectedRoute>}
              path="myorders"
            />
            <Route
              element={<ProtectedRoute>{withSuspense(<AddressesPage />)}</ProtectedRoute>}
              path="addresses"
            />
            <Route
              element={<ProtectedRoute>{withSuspense(<OrderDetailPage />)}</ProtectedRoute>}
              path="orders/:orderId"
            />
            <Route
              element={<ProtectedRoute>{withSuspense(<PaymentHistoryPage />)}</ProtectedRoute>}
              path="payments"
            />
            <Route
              element={<ProtectedRoute>{withSuspense(<SecurityPage />)}</ProtectedRoute>}
              path="security"
            />
            <Route
              element={<ProtectedRoute>{withSuspense(<NotificationsPage />)}</ProtectedRoute>}
              path="notifications"
            />
            <Route element={<Navigate replace to="/myorders" />} path="profile/orders" />
            <Route element={<Navigate replace to="/addresses" />} path="profile/addresses" />
            <Route element={<Navigate replace to="/payments" />} path="profile/payments" />
            <Route element={<Navigate replace to="/security" />} path="profile/security" />
            <Route
              element={<Navigate replace to="/notifications" />}
              path="profile/notifications"
            />
            <Route element={<Navigate replace to="/myorders" />} path="orders" />
            <Route
              element={<ProtectedRoute allowStaff>{withSuspense(<AdminPage />)}</ProtectedRoute>}
              path="admin"
            />
            <Route element={<Navigate replace to="/" />} path="*" />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}
