import { createContext, startTransition, useEffect, useState, type ReactNode } from "react";

import { useAuth } from "../hooks/useAuth";
import { api, getErrorMessage } from "../lib/api";
import type { Cart } from "../types/api";
import { clearGuestCart, createEmptyGuestCart, readGuestCart, saveGuestCart } from "../utils/guestCart";

const emptyCart: Cart = createEmptyGuestCart();

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
      const guestCart = readGuestCart();
      startTransition(() => {
        setCart(guestCart);
        setError("");
        setIsLoading(false);
      });
      return () => {
        active = false;
      };
    }

    setIsLoading(true);

    void (async () => {
      let fallbackCart = emptyCart;

      try {
        let nextCart = (await api.getCart(token)).data;
        fallbackCart = nextCart;
        const guestCart = readGuestCart();

        if (guestCart.items.length > 0) {
          let remainingGuestItems = [...guestCart.items];

          for (const item of guestCart.items) {
            const response = await api.addToCart(token, {
              product_id: item.product_id,
              quantity: item.quantity
            });
            nextCart = response.data;
            fallbackCart = nextCart;
            remainingGuestItems = remainingGuestItems.filter(
              (guestItem) => guestItem.product_id !== item.product_id
            );
            saveGuestCart({
              user_id: "",
              items: remainingGuestItems,
              total: remainingGuestItems.reduce(
                (sum, guestItem) => sum + guestItem.price * guestItem.quantity,
                0
              )
            });
          }

          clearGuestCart();
        }

        if (!active) {
          return;
        }

        startTransition(() => {
          setCart(nextCart);
          setError("");
        });
      } catch (reason) {
        if (!active) {
          return;
        }

        startTransition(() => {
          setCart(fallbackCart.items.length > 0 ? fallbackCart : readGuestCart());
          setError(getErrorMessage(reason));
        });
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  async function refreshCart() {
    if (!token) {
      const guestCart = readGuestCart();
      startTransition(() => {
        setCart(guestCart);
        setError("");
      });
      return guestCart;
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
      const product = (await api.getProductById(item.product_id)).data;
      const nextCart = {
        ...cart,
        items: [...cart.items]
      };
      const existingItem = nextCart.items.find((cartItem) => cartItem.product_id === item.product_id);

      if (existingItem) {
        const nextQuantity = existingItem.quantity + item.quantity;
        if (nextQuantity > product.stock) {
          throw new Error(`Sản phẩm ${product.name} chỉ còn ${product.stock} item(s).`);
        }
        existingItem.quantity = nextQuantity;
        existingItem.price = product.price;
        existingItem.name = product.name;
      } else {
        if (item.quantity > product.stock) {
          throw new Error(`Sản phẩm ${product.name} chỉ còn ${product.stock} item(s).`);
        }
        nextCart.items.push({
          product_id: product.id,
          name: product.name,
          price: product.price,
          quantity: item.quantity
        });
      }

      nextCart.total = nextCart.items.reduce((sum, cartItem) => sum + cartItem.price * cartItem.quantity, 0);
      saveGuestCart(nextCart);
      startTransition(() => {
        setCart(nextCart);
        setError("");
      });
      return nextCart;
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
      const nextCart = {
        ...cart,
        items: [...cart.items]
      };
      const product = (await api.getProductById(productId)).data;
      const item = nextCart.items.find((cartItem) => cartItem.product_id === productId);

      if (!item) {
        throw new Error("Sản phẩm không còn trong giỏ guest.");
      }
      if (quantity > product.stock) {
        throw new Error(`Sản phẩm ${product.name} chỉ còn ${product.stock} item(s).`);
      }

      item.quantity = quantity;
      item.price = product.price;
      item.name = product.name;
      nextCart.total = nextCart.items.reduce((sum, cartItem) => sum + cartItem.price * cartItem.quantity, 0);
      saveGuestCart(nextCart);
      startTransition(() => {
        setCart(nextCart);
        setError("");
      });
      return nextCart;
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
      const nextCart = {
        ...cart,
        items: cart.items.filter((item) => item.product_id !== productId)
      };
      nextCart.total = nextCart.items.reduce((sum, cartItem) => sum + cartItem.price * cartItem.quantity, 0);
      saveGuestCart(nextCart);
      startTransition(() => {
        setCart(nextCart);
        setError("");
      });
      return nextCart;
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
      clearGuestCart();
      startTransition(() => {
        setCart(emptyCart);
        setError("");
      });
      return;
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
