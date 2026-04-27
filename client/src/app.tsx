import { RouterProvider } from "react-router-dom";
import { router } from "./routes/app-routes";
import { AuthProvider } from "./state/auth-context";
import { CartProvider } from "./state/cart-context";

export function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </AuthProvider>
  );
}
