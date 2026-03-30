/**
 * Cart Context Module
 * Provides centralized cart state management with support
 * for both authenticated users and guest users.
 */

import { createContext, startTransition, useEffect, useState, type ReactNode } from "react";

import { productApi } from "../../../shared/api/modules/productApi";
import { cartApi } from "../../../shared/api/modules/cartApi";
import { getErrorMessage } from "../../../shared/api/error-handler";
import type { Cart } from "../../../shared/types/api";
import { useAuth } from "../../auth/hooks/useAuth";
import { createEmptyGuestCart, readGuestCart, saveGuestCart, clearGuestCart } from "../storage/guestCartStorage";

const emptyCart: Cart = createEmptyGuestCart();

type CartItemInput = {
  product_id: string;
  quantity: number;
};

type CartContextValue = {
  cart: Cart;
  itemCount: number;
  isLoading: boolean;
  error: string;
  refreshCart: () => Promise<Cart>;
  addItem: (item: CartItemInput) => Promise<Cart>;
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

  // Fetch cart when auth state changes
  useEffect(() => {
    let active = true;

    if (!token) {
      // Guest user - use local storage cart
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

    // Authenticated user - fetch cart from API
    void (async () => {
      let fallbackCart = emptyCart;

      try {
        let nextCart = (await cartApi.getCart(token)).data;
        fallbackCart = nextCart;
        const guestCart = readGuestCart();

        // Merge guest cart items
        if (guestCart.items.length > 0) {
          let remainingGuestItems = [...guestCart.items];

          for (const item of guestCart.items) {
            const response = await cartApi.addToCart(token, {
              product_id: item.product_id,
              quantity: item.quantity,
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
              ),
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

  /**
   * Refresh cart from server
   */
  async function refreshCart(): Promise<Cart> {
    if (!token) {
      const guestCart = readGuestCart();
      startTransition(() => {
        setCart(guestCart);
        setError("");
      });
      return guestCart;
    }

    setIsLoading(true);
    const response = await cartApi.getCart(token);
    startTransition(() => {
      setCart(response.data);
      setError("");
    });
    setIsLoading(false);
    return response.data;
  }

  /**
   * Add item to cart
   */
  async function addItem(item: CartItemInput): Promise<Cart> {
    if (!token) {
      // Guest cart - add locally
      const product = (await productApi.getProductById(item.product_id)).data;
      const nextCart = {
        ...cart,
        items: [...cart.items],
      };
      const existingItem = nextCart.items.find(
        (cartItem) => cartItem.product_id === item.product_id
      );

      if (existingItem) {
        const nextQuantity = existingItem.quantity + item.quantity;
        if (nextQuantity > product.stock) {
          throw new Error(
            `Sản phẩm ${product.name} chỉ còn ${product.stock} item(s).`
          );
        }
        existingItem.quantity = nextQuantity;
        existingItem.price = product.price;
        existingItem.name = product.name;
      } else {
        if (item.quantity > product.stock) {
          throw new Error(
            `Sản phẩm ${product.name} chỉ còn ${product.stock} item(s).`
          );
        }
        nextCart.items.push({
          product_id: product.id,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
        });
      }

      nextCart.total = nextCart.items.reduce(
        (sum, cartItem) => sum + cartItem.price * cartItem.quantity,
        0
      );
      saveGuestCart(nextCart);
      startTransition(() => {
        setCart(nextCart);
        setError("");
      });
      return nextCart;
    }

    // Authenticated user - use API
    const response = await cartApi.addToCart(token, item);
    startTransition(() => {
      setCart(response.data);
      setError("");
    });
    return response.data;
  }

  /**
   * Update item quantity
   */
  async function updateItem(productId: string, quantity: number): Promise<Cart> {
    if (!token) {
      // Guest cart - update locally
      const nextCart = {
        ...cart,
        items: [...cart.items],
      };
      const product = (await productApi.getProductById(productId)).data;
      const item = nextCart.items.find(
        (cartItem) => cartItem.product_id === productId
      );

      if (!item) {
        throw new Error("Sản phẩm không còn trong giỏ guest.");
      }
      if (quantity > product.stock) {
        throw new Error(
          `Sản phẩm ${product.name} chỉ còn ${product.stock} item(s).`
        );
      }

      item.quantity = quantity;
      item.price = product.price;
      item.name = product.name;
      nextCart.total = nextCart.items.reduce(
        (sum, cartItem) => sum + cartItem.price * cartItem.quantity,
        0
      );
      saveGuestCart(nextCart);
      startTransition(() => {
        setCart(nextCart);
        setError("");
      });
      return nextCart;
    }

    // Authenticated user - use API
    const response = await cartApi.updateCartItem(token, productId, quantity);
    startTransition(() => {
      setCart(response.data);
      setError("");
    });
    return response.data;
  }

  /**
   * Remove item from cart
   */
  async function removeItem(productId: string): Promise<Cart> {
    if (!token) {
      // Guest cart - remove locally
      const nextCart = {
        ...cart,
        items: cart.items.filter((item) => item.product_id !== productId),
      };
      nextCart.total = nextCart.items.reduce(
        (sum, cartItem) => sum + cartItem.price * cartItem.quantity,
        0
      );
      saveGuestCart(nextCart);
      startTransition(() => {
        setCart(nextCart);
        setError("");
      });
      return nextCart;
    }

    // Authenticated user - use API
    const response = await cartApi.removeCartItem(token, productId);
    startTransition(() => {
      setCart(response.data);
      setError("");
    });
    return response.data;
  }

  /**
   * Clear all items from cart
   */
  async function clearCart(): Promise<void> {
    if (!token) {
      clearGuestCart();
      startTransition(() => {
        setCart(emptyCart);
        setError("");
      });
      return;
    }

    await cartApi.clearCart(token);
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
        clearError: () => setError(""),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export default CartProvider;
