import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { addWishlistItem, listWishlist, removeWishlistItem } from "../services/wishlist-service";
import type { WishlistItem } from "../types/api";
import { useAuth } from "./auth-context";

type WishlistContextValue = {
  items: WishlistItem[];
  loading: boolean;
  error: string | null;
  updatingProductIds: string[];
  isWishlisted: (productId: string) => boolean;
  addItem: (productId: string) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  toggleItem: (productId: string) => Promise<void>;
  refreshWishlist: () => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

function normalizeProductId(productId: string): string {
  return productId.trim();
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingProductIds, setUpdatingProductIds] = useState<string[]>([]);
  const safeItems = Array.isArray(items) ? items : [];

  function setProductUpdating(productId: string, updating: boolean) {
    setUpdatingProductIds((current) => {
      if (updating) {
        return current.includes(productId) ? current : [...current, productId];
      }
      return current.filter((id) => id !== productId);
    });
  }

  function isWishlisted(productId: string) {
    const normalized = normalizeProductId(productId);
    return safeItems.some((item) => item.product_id === normalized);
  }

  async function refreshWishlist() {
    if (!token) {
      setItems([]);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setItems(await listWishlist(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được wishlist");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadWishlist() {
      if (!token) {
        setItems([]);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const nextItems = await listWishlist(token);
        if (active) {
          setItems(nextItems);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được wishlist");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadWishlist();

    return () => {
      active = false;
    };
  }, [token]);

  async function addItem(productId: string) {
    const normalized = normalizeProductId(productId);
    if (!normalized) {
      return;
    }
    if (!token) {
      setError("Bạn cần đăng nhập để lưu sản phẩm yêu thích");
      return;
    }

    try {
      setProductUpdating(normalized, true);
      setError(null);
      const item = await addWishlistItem(token, normalized);
      setItems((current) => {
        const rest = current.filter((existing) => existing.product_id !== item.product_id);
        return [item, ...rest];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được sản phẩm yêu thích");
    } finally {
      setProductUpdating(normalized, false);
    }
  }

  async function removeItem(productId: string) {
    const normalized = normalizeProductId(productId);
    if (!normalized || !token) {
      return;
    }

    try {
      setProductUpdating(normalized, true);
      setError(null);
      await removeWishlistItem(token, normalized);
      setItems((current) => current.filter((item) => item.product_id !== normalized));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được sản phẩm yêu thích");
    } finally {
      setProductUpdating(normalized, false);
    }
  }

  async function toggleItem(productId: string) {
    if (isWishlisted(productId)) {
      await removeItem(productId);
      return;
    }

    await addItem(productId);
  }

  return (
    <WishlistContext.Provider
      value={{
        items: safeItems,
        loading,
        error,
        updatingProductIds,
        isWishlisted,
        addItem,
        removeItem,
        toggleItem,
        refreshWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);

  if (!context) {
    throw new Error("useWishlist must be used inside WishlistProvider");
  }

  return context;
}
