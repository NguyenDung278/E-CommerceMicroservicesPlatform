"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuthState } from "@/hooks/useAuth";
import { cartApi, productApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors/handler";
import type { Cart } from "@/types/api";
import {
  clearGuestCart,
  createEmptyGuestCart,
  readGuestCart,
  saveGuestCart,
} from "@/utils/cart/storage";

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

type CartStateValue = Pick<CartContextValue, "cart" | "itemCount" | "isLoading" | "error">;
type CartActionsValue = Pick<
  CartContextValue,
  "refreshCart" | "addItem" | "updateItem" | "removeItem" | "clearCart" | "clearError"
>;

export const CartContext = createContext<CartContextValue | null>(null);
export const CartStateContext = createContext<CartStateValue | null>(null);
export const CartActionsContext = createContext<CartActionsValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { token } = useAuthState();
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const cartRef = useRef(cart);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    let active = true;

    if (!token) {
      const guestCart = readGuestCart();
      cartRef.current = guestCart;
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
        let nextCart = (await cartApi.getCart(token)).data;
        fallbackCart = nextCart;
        const guestCart = readGuestCart();

        if (guestCart.items.length > 0) {
          let remainingGuestItems = [...guestCart.items];

          for (const item of guestCart.items) {
            const response = await cartApi.addToCart(token, {
              product_id: item.product_id,
              quantity: item.quantity,
            });

            nextCart = response.data;
            fallbackCart = nextCart;
            remainingGuestItems = remainingGuestItems.filter((guestItem) => guestItem.product_id !== item.product_id);
            saveGuestCart({
              user_id: "",
              items: remainingGuestItems,
              total: remainingGuestItems.reduce((sum, guestItem) => sum + guestItem.price * guestItem.quantity, 0),
            });
          }

          clearGuestCart();
        }

        if (!active) {
          return;
        }

        cartRef.current = nextCart;
        startTransition(() => {
          setCart(nextCart);
          setError("");
        });
      } catch (reason) {
        if (!active) {
          return;
        }

        cartRef.current = fallbackCart.items.length > 0 ? fallbackCart : readGuestCart();
        startTransition(() => {
          setCart(cartRef.current);
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

  const refreshCart = useCallback(async (): Promise<Cart> => {
    if (!token) {
      const guestCart = readGuestCart();
      cartRef.current = guestCart;
      startTransition(() => {
        setCart(guestCart);
        setError("");
      });
      return guestCart;
    }

    setIsLoading(true);
    const response = await cartApi.getCart(token);
    cartRef.current = response.data;
    startTransition(() => {
      setCart(response.data);
      setError("");
    });
    setIsLoading(false);
    return response.data;
  }, [token]);

  const addItem = useCallback(async (item: CartItemInput): Promise<Cart> => {
    if (!token) {
      const product = (await productApi.getProductById(item.product_id)).data;
      const currentCart = cartRef.current;
      const nextCart = {
        ...currentCart,
        items: [...currentCart.items],
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
          quantity: item.quantity,
        });
      }

      nextCart.total = nextCart.items.reduce((sum, cartItem) => sum + cartItem.price * cartItem.quantity, 0);
      saveGuestCart(nextCart);
      cartRef.current = nextCart;
      startTransition(() => {
        setCart(nextCart);
        setError("");
      });
      return nextCart;
    }

    const response = await cartApi.addToCart(token, item);
    cartRef.current = response.data;
    startTransition(() => {
      setCart(response.data);
      setError("");
    });
    return response.data;
  }, [token]);

  const updateItem = useCallback(async (productId: string, quantity: number): Promise<Cart> => {
    if (!token) {
      const currentCart = cartRef.current;
      const nextCart = {
        ...currentCart,
        items: [...currentCart.items],
      };
      const product = (await productApi.getProductById(productId)).data;
      const item = nextCart.items.find((cartItem) => cartItem.product_id === productId);

      if (!item) {
        throw new Error("Sản phẩm không còn trong giỏ khách.");
      }

      if (quantity > product.stock) {
        throw new Error(`Sản phẩm ${product.name} chỉ còn ${product.stock} item(s).`);
      }

      item.quantity = quantity;
      item.price = product.price;
      item.name = product.name;
      nextCart.total = nextCart.items.reduce((sum, cartItem) => sum + cartItem.price * cartItem.quantity, 0);
      saveGuestCart(nextCart);
      cartRef.current = nextCart;
      startTransition(() => {
        setCart(nextCart);
        setError("");
      });
      return nextCart;
    }

    const response = await cartApi.updateCartItem(token, productId, quantity);
    cartRef.current = response.data;
    startTransition(() => {
      setCart(response.data);
      setError("");
    });
    return response.data;
  }, [token]);

  const removeItem = useCallback(async (productId: string): Promise<Cart> => {
    if (!token) {
      const currentCart = cartRef.current;
      const nextCart = {
        ...currentCart,
        items: currentCart.items.filter((item) => item.product_id !== productId),
      };
      nextCart.total = nextCart.items.reduce((sum, cartItem) => sum + cartItem.price * cartItem.quantity, 0);
      saveGuestCart(nextCart);
      cartRef.current = nextCart;
      startTransition(() => {
        setCart(nextCart);
        setError("");
      });
      return nextCart;
    }

    const response = await cartApi.removeCartItem(token, productId);
    cartRef.current = response.data;
    startTransition(() => {
      setCart(response.data);
      setError("");
    });
    return response.data;
  }, [token]);

  const clearCart = useCallback(async (): Promise<void> => {
    if (!token) {
      clearGuestCart();
      cartRef.current = emptyCart;
      startTransition(() => {
        setCart(emptyCart);
        setError("");
      });
      return;
    }

    await cartApi.clearCart(token);
    cartRef.current = emptyCart;
    startTransition(() => {
      setCart(emptyCart);
      setError("");
    });
  }, [token]);

  const clearError = useCallback(() => {
    setError("");
  }, []);

  const itemCount = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.quantity, 0),
    [cart.items],
  );

  const cartState = useMemo<CartStateValue>(
    () => ({
      cart,
      itemCount,
      isLoading,
      error,
    }),
    [cart, itemCount, isLoading, error],
  );

  const cartActions = useMemo<CartActionsValue>(
    () => ({
      refreshCart,
      addItem,
      updateItem,
      removeItem,
      clearCart,
      clearError,
    }),
    [refreshCart, addItem, updateItem, removeItem, clearCart, clearError],
  );

  const cartContextValue = useMemo<CartContextValue>(
    () => ({
      ...cartState,
      ...cartActions,
    }),
    [cartState, cartActions],
  );

  return (
    <CartStateContext.Provider value={cartState}>
      <CartActionsContext.Provider value={cartActions}>
        <CartContext.Provider value={cartContextValue}>
          {children}
        </CartContext.Provider>
      </CartActionsContext.Provider>
    </CartStateContext.Provider>
  );
}
