import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  addCartItem,
  clearCart as clearCartRequest,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../services/cart-service";
import type { Cart } from "../types/api";
import { useAuth } from "./auth-context";

type CartContextValue = {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  addItem: (productId: string, quantity?: number, sku?: string) => Promise<void>;
  updateItem: (productId: string, quantity: number, sku?: string) => Promise<void>;
  removeItem: (productId: string, sku?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshCart() {
    if (!token) {
      setCart(null);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCart(await getCart(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được giỏ hàng");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadCart() {
      if (!token) {
        setCart(null);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const nextCart = await getCart(token);
        if (active) {
          setCart(nextCart);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được giỏ hàng");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCart();

    return () => {
      active = false;
    };
  }, [token]);

  async function addItem(productId: string, quantity = 1, sku?: string) {
    if (!token) {
      setError("Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng");
      return;
    }

    setCart(await addCartItem(token, { product_id: productId, sku, quantity }));
  }

  async function updateItem(productId: string, quantity: number, sku?: string) {
    if (!token) {
      return;
    }

    setCart(await updateCartItem(token, productId, quantity, sku));
  }

  async function removeItem(productId: string, sku?: string) {
    if (!token) {
      return;
    }

    setCart(await removeCartItem(token, productId, sku));
  }

  async function clearCart() {
    if (!token) {
      return;
    }

    setCart(await clearCartRequest(token));
  }

  return (
    <CartContext.Provider
      value={{ cart, loading, error, addItem, updateItem, removeItem, clearCart, refreshCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
