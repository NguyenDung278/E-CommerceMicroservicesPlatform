import {
  createContext,
  startTransition,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { userApi } from "@/services/api/modules/user-api";
import { getErrorMessage } from "@/services/api/error-handler";
import { useAuth } from "@/features/auth/hooks/use-auth";

const WISHLIST_STORAGE_KEY = "ecommerce_frontend_wishlist";

type WishlistContextValue = {
  wishlist: string[];
  wishlistCount: number;
  isLoading: boolean;
  error: string;
  toggleWishlist: (productId: string) => Promise<void>;
  isSaved: (productId: string) => boolean;
  clearWishlist: () => Promise<void>;
  refreshWishlist: () => Promise<string[]>;
};

export const WishlistContext = createContext<WishlistContextValue | null>(null);

function readWishlistFromStorage() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return Array.from(
      new Set(parsed.filter((value): value is string => typeof value === "string").map((value) => value.trim()))
    ).filter(Boolean);
  } catch {
    return [];
  }
}

function saveWishlistToStorage(wishlist: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
}

function clearWishlistStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(WISHLIST_STORAGE_KEY);
}

function normalizeWishlistIds(productIds: string[]) {
  return Array.from(new Set(productIds.map((value) => value.trim()).filter(Boolean)));
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [wishlist, setWishlist] = useState<string[]>(() => readWishlistFromStorage());
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(token));

  useEffect(() => {
    let active = true;

    if (!token) {
      const guestWishlist = readWishlistFromStorage();
      startTransition(() => {
        setWishlist(guestWishlist);
        setError("");
        setIsLoading(false);
      });
      return () => {
        active = false;
      };
    }

    setIsLoading(true);

    void (async () => {
      try {
        const guestWishlist = readWishlistFromStorage();
        const response =
          guestWishlist.length > 0
            ? await userApi.syncWishlist(token, {
                product_ids: guestWishlist,
              })
            : await userApi.listWishlist(token);

        if (!active) {
          return;
        }

        clearWishlistStorage();
        startTransition(() => {
          setWishlist(response.data.map((item) => item.product_id));
          setError("");
        });
      } catch (reason) {
        if (!active) {
          return;
        }

        startTransition(() => {
          setWishlist(readWishlistFromStorage());
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

  async function refreshWishlist() {
    if (!token) {
      const guestWishlist = readWishlistFromStorage();
      startTransition(() => {
        setWishlist(guestWishlist);
        setError("");
      });
      return guestWishlist;
    }

    const response = await userApi.listWishlist(token);
    const nextWishlist = normalizeWishlistIds(response.data.map((item) => item.product_id));
    startTransition(() => {
      setWishlist(nextWishlist);
      setError("");
    });
    return nextWishlist;
  }

  async function toggleWishlist(productId: string) {
    const normalizedProductId = productId.trim();
    if (!normalizedProductId) {
      return;
    }

    const wasSaved = wishlist.includes(normalizedProductId);
    const nextWishlist = wasSaved
      ? wishlist.filter((item) => item !== normalizedProductId)
      : [...wishlist, normalizedProductId];

    startTransition(() => {
      setWishlist(nextWishlist);
      setError("");
    });

    if (!token) {
      saveWishlistToStorage(nextWishlist);
      return;
    }

    try {
      if (wasSaved) {
        await userApi.removeWishlistItem(token, normalizedProductId);
      } else {
        await userApi.addWishlistItem(token, { product_id: normalizedProductId });
      }
    } catch (reason) {
      startTransition(() => {
        setWishlist(wishlist);
        setError(getErrorMessage(reason));
      });
    }
  }

  async function clearWishlist() {
    if (!token) {
      clearWishlistStorage();
      startTransition(() => {
        setWishlist([]);
        setError("");
      });
      return;
    }

    const previousWishlist = wishlist;
    startTransition(() => {
      setWishlist([]);
      setError("");
    });

    try {
      await Promise.all(previousWishlist.map((productId) => userApi.removeWishlistItem(token, productId)));
    } catch (reason) {
      startTransition(() => {
        setWishlist(previousWishlist);
        setError(getErrorMessage(reason));
      });
    }
  }

  const value = useMemo<WishlistContextValue>(
    () => ({
      wishlist,
      wishlistCount: wishlist.length,
      isLoading,
      error,
      toggleWishlist,
      isSaved: (productId: string) => wishlist.includes(productId),
      clearWishlist,
      refreshWishlist,
    }),
    [error, isLoading, wishlist]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
