import { createContext, startTransition, useEffect, useState, type ReactNode } from "react";

import { useAuth } from "../hooks/useAuth";
import { api, getErrorMessage } from "../lib/api";
import type { Cart } from "../types/api";

const emptyCart: Cart = {
  user_id: "",
  items: [],
  total: 0
};

type CartContextValue = {
  cart: Cart;
  itemCount: number;
  isLoading: boolean;
  error: string;
  refreshCart: () => Promise<Cart>;
  addItem: (item: {
    product_id: string;
    quantity: number;
  }) => Promise<Cart>;
  updateItem: (productId: string, quantity: number) => Promise<Cart>;
  removeItem: (productId: string) => Promise<Cart>;
  clearCart: () => Promise<void>;
  clearError: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(token));

  useEffect(() => {
    let active = true;

    if (!token) {
      startTransition(() => {
        setCart(emptyCart);
        setError("");
        setIsLoading(false);
      });
      return () => {
        active = false;
      };
    }

    setIsLoading(true);

    void api
      .getCart(token)
      .then((response) => {
        if (!active) {
          return;
        }

        startTransition(() => {
          setCart(response.data);
          setError("");
        });
      })
      .catch((reason) => {
        if (!active) {
          return;
        }

        startTransition(() => {
          setCart(emptyCart);
          setError(getErrorMessage(reason));
        });
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function refreshCart() {
    if (!token) {
      throw new Error("Missing JWT token");
    }

    setIsLoading(true);
    const response = await api.getCart(token);
    startTransition(() => {
      setCart(response.data);
      setError("");
    });
    setIsLoading(false);
    return response.data;
  }

  async function addItem(item: {
    product_id: string;
    quantity: number;
  }) {
    if (!token) {
      throw new Error("Missing JWT token");
    }

    const response = await api.addToCart(token, item);
    startTransition(() => {
      setCart(response.data);
      setError("");
    });
    return response.data;
  }

  async function updateItem(productId: string, quantity: number) {
    if (!token) {
      throw new Error("Missing JWT token");
    }

    const response = await api.updateCartItem(token, productId, quantity);
    startTransition(() => {
      setCart(response.data);
      setError("");
    });
    return response.data;
  }

  async function removeItem(productId: string) {
    if (!token) {
      throw new Error("Missing JWT token");
    }

    const response = await api.removeCartItem(token, productId);
    startTransition(() => {
      setCart(response.data);
      setError("");
    });
    return response.data;
  }

  async function clearCart() {
    if (!token) {
      throw new Error("Missing JWT token");
    }

    await api.clearCart(token);
    startTransition(() => {
      setCart(emptyCart);
      setError("");
    });
  }

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        isLoading,
        error,
        refreshCart,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        clearError: () => setError("")
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
