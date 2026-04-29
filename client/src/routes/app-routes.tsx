import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { AccountPage } from "../pages/account-page";
import { CartPage } from "../pages/cart-page";
import { CategoryPage } from "../pages/category-page";
import { CheckoutPage } from "../pages/checkout-page";
import { HomePage } from "../pages/home-page";
import { NotFoundPage } from "../pages/not-found-page";
import { OAuthCallbackPage } from "../pages/oauth-callback-page";
import { OrderDetailPage } from "../pages/order-detail-page";
import { PaymentStatusPage } from "../pages/payment-status-page";
import { ProductDetailPage } from "../pages/product-detail-page";
import { ProductListPage } from "../pages/product-list-page";
import { ReturnDetailPage } from "../pages/return-detail-page";
import { ReturnsListPage } from "../pages/returns-list-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "categories/:identifier", element: <CategoryPage /> },
      { path: "products", element: <ProductListPage /> },
      { path: "products/:id", element: <ProductDetailPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "checkout", element: <CheckoutPage /> },
      { path: "account", element: <AccountPage /> },
      { path: "account/orders", element: <AccountPage /> },
      { path: "account/orders/:id", element: <OrderDetailPage /> },
      { path: "account/returns", element: <ReturnsListPage /> },
      { path: "account/returns/:returnId", element: <ReturnDetailPage /> },
      { path: "payments/:id", element: <PaymentStatusPage /> },
      { path: "payments/order/:orderId", element: <PaymentStatusPage /> },
      { path: "auth/callback", element: <OAuthCallbackPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
