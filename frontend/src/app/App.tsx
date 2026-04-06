import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./layout/app-layout";
import { ProtectedRoute } from "./router/protected-route";
import { ScrollToTop } from "./router/scroll-to-top";
import { AdminPage } from "@/pages/admin";
import { AddressesPage } from "@/pages/account";
import { AuthCallbackPage } from "@/pages/auth";
import { CartPage } from "@/pages/storefront";
import { CategoryPage } from "@/pages/storefront";
import { CatalogPage } from "@/pages/storefront";
import { CheckoutPage } from "@/pages/storefront";
import { ForgotPasswordPage } from "@/pages/auth";
import { HomePage } from "@/pages/storefront";
import { LoginPage } from "@/pages/auth";
import { NotificationsPage } from "@/pages/account";
import { OrderDetailPage } from "@/pages/account";
import { OrdersPage } from "@/pages/account";
import { PaymentHistoryPage } from "@/pages/account";
import { ProductDetailPage } from "@/pages/storefront";
import { ProfilePage } from "@/pages/account";
import { RegisterPage } from "@/pages/auth";
import { ResetPasswordPage } from "@/pages/auth";
import { SecurityPage } from "@/pages/account";
import { VerifyEmailPage } from "@/pages/auth";

import { AppProviders } from "./providers/app-providers";

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<LoginPage />} path="/login" />
          <Route element={<RegisterPage />} path="/register" />
          <Route element={<ForgotPasswordPage />} path="/forgot-password" />
          <Route element={<AuthCallbackPage />} path="/auth/callback" />
          <Route element={<VerifyEmailPage />} path="/verify-email" />
          <Route element={<ResetPasswordPage />} path="/reset-password" />

          <Route element={<AppLayout />} path="/">
            <Route element={<HomePage />} index />
            <Route element={<CatalogPage />} path="products" />
            <Route element={<ProductDetailPage />} path="products/:productId" />
            <Route element={<CategoryPage />} path="categories/:categoryName" />
            <Route element={<CartPage />} path="cart" />
            <Route element={<CheckoutPage />} path="checkout" />
            <Route
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
              path="profile"
            />
            <Route
              element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              }
              path="myorders"
            />
            <Route
              element={
                <ProtectedRoute>
                  <AddressesPage />
                </ProtectedRoute>
              }
              path="addresses"
            />
            <Route
              element={
                <ProtectedRoute>
                  <OrderDetailPage />
                </ProtectedRoute>
              }
              path="orders/:orderId"
            />
            <Route
              element={
                <ProtectedRoute>
                  <PaymentHistoryPage />
                </ProtectedRoute>
              }
              path="payments"
            />
            <Route
              element={
                <ProtectedRoute>
                  <SecurityPage />
                </ProtectedRoute>
              }
              path="security"
            />
            <Route
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
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
              element={
                <ProtectedRoute allowStaff>
                  <AdminPage />
                </ProtectedRoute>
              }
              path="admin"
            />
            <Route element={<Navigate replace to="/" />} path="*" />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}
