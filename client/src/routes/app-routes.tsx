import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { AccountPage } from "../pages/account-page";
import { CartPage } from "../pages/cart-page";
import { CheckoutPage } from "../pages/checkout-page";
import { HomePage } from "../pages/home-page";
import { NotFoundPage } from "../pages/not-found-page";
import { ProductDetailPage } from "../pages/product-detail-page";
import { ProductListPage } from "../pages/product-list-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "products", element: <ProductListPage /> },
      { path: "products/:id", element: <ProductDetailPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "checkout", element: <CheckoutPage /> },
      { path: "account", element: <AccountPage /> },
      { path: "account/orders", element: <AccountPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
