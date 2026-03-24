import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { AdminPage } from "./pages/AdminPage";
import { CartPage } from "./pages/CartPage";
import { CategoryPage } from "./pages/CategoryPage";
import { CatalogPage } from "./pages/CatalogPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { PaymentHistoryPage } from "./pages/PaymentHistoryPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<LoginPage />} path="/login" />
            <Route element={<RegisterPage />} path="/register" />
            <Route element={<ForgotPasswordPage />} path="/forgot-password" />
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
      </CartProvider>
    </AuthProvider>
  );
}
