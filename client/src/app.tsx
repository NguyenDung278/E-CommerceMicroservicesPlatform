import { RouterProvider } from "react-router-dom";
import { router } from "./routes/app-routes";
import { AuthProvider } from "./state/auth-context";
import { CartProvider } from "./state/cart-context";
import { WishlistProvider } from "./state/wishlist-context";

export function App() {
  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          <RouterProvider router={router} />
        </CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}
