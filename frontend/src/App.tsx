import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./layout/AppLayout";
import { AuthProvider } from "./providers/AuthContext";
import { CartProvider } from "./providers/CartContext";
import { ProtectedRoute } from "./router/ProtectedRoute";
import { AdminPage } from "./routes/AdminPage";
import { CartPage } from "./routes/CartPage";
import { CategoryPage } from "./routes/CategoryPage";
import { CatalogPage } from "./routes/CatalogPage";
import { CheckoutPage } from "./routes/CheckoutPage";
import { ForgotPasswordPage } from "./routes/ForgotPasswordPage";
import { HomePage } from "./routes/HomePage";
import { LoginPage } from "./routes/LoginPage";
import { OrderDetailPage } from "./routes/OrderDetailPage";
import { PaymentHistoryPage } from "./routes/PaymentHistoryPage";
import { ProductDetailPage } from "./routes/ProductDetailPage";
import { ProfilePage } from "./routes/ProfilePage";
import { RegisterPage } from "./routes/RegisterPage";
import { ResetPasswordPage } from "./routes/ResetPasswordPage";
import { VerifyEmailPage } from "./routes/VerifyEmailPage";

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
