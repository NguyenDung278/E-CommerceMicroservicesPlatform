import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./layout/AppLayout";
import { ProtectedRoute } from "./router/ProtectedRoute";
import { ScrollToTop } from "./router/ScrollToTop";
import { AdminPage } from "../routes/AdminPage";
import { AddressesPage } from "../routes/AddressesPage";
import { AuthCallbackPage } from "../routes/AuthCallbackPage";
import { CartPage } from "../routes/CartPage";
import { CategoryPage } from "../routes/CategoryPage";
import { CatalogPage } from "../routes/CatalogPage";
import { CheckoutPage } from "../routes/CheckoutPage";
import { ForgotPasswordPage } from "../routes/ForgotPasswordPage";
import { HomePage } from "../routes/HomePage";
import { LoginPage } from "../routes/LoginPage";
import { NotificationsPage } from "../routes/NotificationsPage";
import { OrderDetailPage } from "../routes/OrderDetailPage";
import { OrdersPage } from "../routes/OrdersPage";
import { PaymentHistoryPage } from "../routes/PaymentHistoryPage";
import { ProductDetailPage } from "../routes/ProductDetailPage";
import { ProfilePage } from "../routes/ProfilePage";
import { RegisterPage } from "../routes/RegisterPage";
import { ResetPasswordPage } from "../routes/ResetPasswordPage";
import { SecurityPage } from "../routes/SecurityPage";
import { VerifyEmailPage } from "../routes/VerifyEmailPage";

import { AppProviders } from "./providers/AppProviders";

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
              <Route element={<Navigate replace to="/notifications" />} path="profile/notifications" />
              <Route
                element={<Navigate replace to="/myorders" />}
                path="orders"
              />
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
