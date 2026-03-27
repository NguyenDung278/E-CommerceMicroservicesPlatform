"use client";

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useReducer,
} from "react";

import {
  defaultCartLines,
  defaultShippingAddress,
  defaultWishlist,
  getProductById,
} from "@/data/storefront";
import { clampQuantity, getCartSubtotal, getOrderNumber } from "@/lib/utils";
import type { CartLine, PlacedOrder, ShippingAddress } from "@/lib/types";

const STORAGE_KEY = "nd-shop-storefront-v2";

type StorefrontState = {
  cartLines: CartLine[];
  wishlist: string[];
  lastOrder: PlacedOrder | null;
  shippingAddress: ShippingAddress;
  hydrated: boolean;
};

type AddToCartPayload = {
  productId: string;
  quantity?: number;
  selectedColor?: string;
  selectedSize?: string;
};

type Action =
  | { type: "hydrate"; payload: Partial<StorefrontState> }
  | { type: "add-to-cart"; payload: AddToCartPayload }
  | { type: "remove-from-cart"; payload: { productId: string } }
  | {
      type: "update-quantity";
      payload: { productId: string; quantity: number };
    }
  | { type: "toggle-wishlist"; payload: { productId: string } }
  | { type: "clear-cart" }
  | { type: "reset-demo" }
  | { type: "update-shipping-address"; payload: ShippingAddress }
  | {
      type: "place-order";
      payload: { shippingAddress: ShippingAddress; email: string };
    };

const initialState: StorefrontState = {
  cartLines: defaultCartLines,
  wishlist: defaultWishlist,
  lastOrder: null,
  shippingAddress: defaultShippingAddress,
  hydrated: false,
};

function reducer(state: StorefrontState, action: Action): StorefrontState {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        ...action.payload,
        hydrated: true,
      };
    case "add-to-cart": {
      const product = getProductById(action.payload.productId);

      if (!product) {
        return state;
      }

      const selectedColor =
        action.payload.selectedColor ?? product.colors[0]?.name ?? "Default";
      const selectedSize =
        action.payload.selectedSize ?? product.sizes[0]?.label ?? "One Size";
      const quantity = clampQuantity(action.payload.quantity ?? 1);
      const existingLine = state.cartLines.find(
        (line) =>
          line.productId === product.id &&
          line.selectedColor === selectedColor &&
          line.selectedSize === selectedSize,
      );

      const cartLines = existingLine
        ? state.cartLines.map((line) =>
            line === existingLine
              ? { ...line, quantity: clampQuantity(line.quantity + quantity) }
              : line,
          )
        : [
            ...state.cartLines,
            {
              productId: product.id,
              quantity,
              selectedColor,
              selectedSize,
            },
          ];

      return {
        ...state,
        cartLines,
      };
    }
    case "remove-from-cart":
      return {
        ...state,
        cartLines: state.cartLines.filter(
          (line) => line.productId !== action.payload.productId,
        ),
      };
    case "update-quantity":
      return {
        ...state,
        cartLines: state.cartLines.map((line) =>
          line.productId === action.payload.productId
            ? { ...line, quantity: clampQuantity(action.payload.quantity) }
            : line,
        ),
      };
    case "toggle-wishlist":
      return {
        ...state,
        wishlist: state.wishlist.includes(action.payload.productId)
          ? state.wishlist.filter((id) => id !== action.payload.productId)
          : [...state.wishlist, action.payload.productId],
      };
    case "clear-cart":
      return {
        ...state,
        cartLines: [],
      };
    case "reset-demo":
      return {
        ...state,
        cartLines: defaultCartLines,
        wishlist: defaultWishlist,
        lastOrder: null,
        shippingAddress: defaultShippingAddress,
      };
    case "update-shipping-address":
      return {
        ...state,
        shippingAddress: action.payload,
      };
    case "place-order": {
      const lines = state.cartLines.filter((line) => getProductById(line.productId));

      if (!lines.length) {
        return state;
      }

      const order: PlacedOrder = {
        orderNumber: getOrderNumber(),
        placedAt: new Date().toISOString(),
        etaLabel: "Arrives in 4-6 business days",
        email: action.payload.email,
        shippingAddress: action.payload.shippingAddress,
        lines,
      };

      return {
        ...state,
        lastOrder: order,
        cartLines: [],
        shippingAddress: action.payload.shippingAddress,
      };
    }
    default:
      return state;
  }
}

type StorefrontContextValue = {
  cartLines: Array<CartLine & { product: NonNullable<ReturnType<typeof getProductById>> }>;
  wishlist: string[];
  wishlistProducts: NonNullable<ReturnType<typeof getProductById>>[];
  lastOrder: PlacedOrder | null;
  shippingAddress: ShippingAddress;
  cartCount: number;
  wishlistCount: number;
  subtotal: number;
  shippingFee: number;
  tax: number;
  total: number;
  hydrated: boolean;
  addToCart: (payload: AddToCartPayload) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  toggleWishlist: (productId: string) => void;
  clearCart: () => void;
  resetDemo: () => void;
  updateShippingAddress: (payload: ShippingAddress) => void;
  placeOrder: (payload: { shippingAddress: ShippingAddress; email: string }) => void;
};

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

export function StorefrontProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const persistState = useEffectEvent((nextState: StorefrontState) => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        cartLines: nextState.cartLines,
        wishlist: nextState.wishlist,
        lastOrder: nextState.lastOrder,
        shippingAddress: nextState.shippingAddress,
      }),
    );
  });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored) as Partial<StorefrontState>;
        dispatch({ type: "hydrate", payload: parsed });
        return;
      }
    } catch (error) {
      console.error("Failed to restore storefront state", error);
    }

    dispatch({ type: "hydrate", payload: {} });
  }, []);

  useEffect(() => {
    if (!state.hydrated) {
      return;
    }

    persistState(state);
  }, [state]);

  const cartLines = state.cartLines
    .map((line) => {
      const product = getProductById(line.productId);

      if (!product) {
        return null;
      }

      return {
        ...line,
        product,
      };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));

  const wishlistProducts = state.wishlist
    .map((productId) => getProductById(productId))
    .filter(
      (product): product is NonNullable<typeof product> => Boolean(product),
    );

  const subtotal = getCartSubtotal(cartLines);
  const shippingFee = subtotal > 1000 || subtotal === 0 ? 0 : 18;
  const tax = subtotal * 0.084;
  const total = subtotal + shippingFee + tax;
  const cartCount = cartLines.reduce((count, line) => count + line.quantity, 0);

  return (
    <StorefrontContext.Provider
      value={{
        cartLines,
        wishlist: state.wishlist,
        wishlistProducts,
        lastOrder: state.lastOrder,
        shippingAddress: state.shippingAddress,
        cartCount,
        wishlistCount: state.wishlist.length,
        subtotal,
        shippingFee,
        tax,
        total,
        hydrated: state.hydrated,
        addToCart: (payload) => dispatch({ type: "add-to-cart", payload }),
        removeFromCart: (productId) =>
          dispatch({ type: "remove-from-cart", payload: { productId } }),
        updateQuantity: (productId, quantity) =>
          dispatch({ type: "update-quantity", payload: { productId, quantity } }),
        toggleWishlist: (productId) =>
          dispatch({ type: "toggle-wishlist", payload: { productId } }),
        clearCart: () => dispatch({ type: "clear-cart" }),
        resetDemo: () => dispatch({ type: "reset-demo" }),
        updateShippingAddress: (payload) =>
          dispatch({ type: "update-shipping-address", payload }),
        placeOrder: (payload) => dispatch({ type: "place-order", payload }),
      }}
    >
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront() {
  const context = useContext(StorefrontContext);

  if (!context) {
    throw new Error("useStorefront must be used within StorefrontProvider");
  }

  return context;
}
