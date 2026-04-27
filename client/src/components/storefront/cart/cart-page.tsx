"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CartItemsList } from "@/components/storefront/cart/cart-items-list";
import { CartSummary } from "@/components/storefront/cart/cart-summary";
import {
  formatStorefrontSyncLabel,
  storefrontSyncIntervalMs,
} from "@/components/storefront/storefront-shared";
import {
  RecoveredEditorialFooter,
  RecoveredStorefrontHeader,
} from "@/components/storefront-shared/recovered-storefront-chrome";
import { InlineAlert, LoadingScreen } from "@/components/storefront-shared/storefront-ui";
import { useAuthState } from "@/hooks/useAuth";
import { useCartActions, useCartState } from "@/hooks/useCart";
import { productApi } from "@/lib/api/product";
import { getErrorMessage } from "@/lib/errors/handler";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/api";

export function CartPage() {
  const { token } = useAuthState();
  const { cart, error, isLoading } = useCartState();
  const { clearCart, refreshCart, removeItem, updateItem } = useCartActions();
  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const productIds = useMemo(
    () => cart.items.map((item) => item.product_id).filter(Boolean),
    [cart.items],
  );
  const totalUnits = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const liveTotal = cart.items.reduce((sum, item) => {
    const product = productMap[item.product_id];
    return sum + (product?.price ?? item.price) * item.quantity;
  }, 0);

  const syncCart = useCallback(async () => {
    try {
      if (token) {
        await refreshCart();
      }

      if (productIds.length > 0) {
        const response = await productApi.getProductsByIds(productIds);
        setProductMap(Object.fromEntries(response.data.map((product) => [product.id, product])));
      } else {
        setProductMap({});
      }

      setLastSyncedAt(new Date());
      setFeedback("");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    }
  }, [productIds, refreshCart, token]);

  useEffect(() => {
    void syncCart();
    const intervalId = window.setInterval(() => void syncCart(), storefrontSyncIntervalMs);
    const handleFocus = () => void syncCart();

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [syncCart]);

  async function handleUpdateQuantity(productId: string, quantity: number) {
    try {
      setBusyProductId(productId);
      await updateItem(productId, quantity);
      setFeedback("");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }

  async function handleRemove(productId: string) {
    try {
      setBusyProductId(productId);
      await removeItem(productId);
      setFeedback("");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }

  if (isLoading && cart.items.length === 0) {
    return (
      <main className="min-h-screen bg-background">
        <RecoveredStorefrontHeader />
        <LoadingScreen label="Đang tải giỏ hàng..." />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <RecoveredStorefrontHeader />

      <section className="commerce-page-head">
        <div className="shell grid gap-4 py-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div>
            <p className="eyebrow">Giỏ hàng</p>
            <h1 className="mt-2 text-3xl font-semibold text-on-surface md:text-[2.5rem]">
              Chỉ còn các dòng hàng đang sẵn sàng đi tới thanh toán.
            </h1>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between gap-3 text-sm text-on-surface-variant">
              <span>Đồng bộ giá và tồn kho</span>
              <RefreshCw className={cn("h-4 w-4 text-primary", isLoading && "animate-spin")} />
            </div>
            <strong className="mt-3 block text-lg font-semibold text-on-surface">
              {formatStorefrontSyncLabel(lastSyncedAt)}
            </strong>
          </div>
        </div>
      </section>

      <section className="shell grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
          {feedback ? (
            <InlineAlert tone={feedback.startsWith("Đã") ? "success" : "info"}>{feedback}</InlineAlert>
          ) : null}

          <CartItemsList
            items={cart.items}
            productMap={productMap}
            busyProductId={busyProductId}
            onUpdateQuantity={handleUpdateQuantity}
            onRemove={handleRemove}
          />
        </div>

        <CartSummary
          itemCount={cart.items.length}
          totalUnits={totalUnits}
          liveTotal={liveTotal}
          onClearCart={clearCart}
        />
      </section>

      <RecoveredEditorialFooter />
    </main>
  );
}
