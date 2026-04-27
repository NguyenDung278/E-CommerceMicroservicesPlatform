"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { CheckoutOrderSummary } from "@/components/storefront/checkout/checkout-order-summary";
import { CheckoutPaymentSection } from "@/components/storefront/checkout/checkout-payment-section";
import { CheckoutRecipientSection } from "@/components/storefront/checkout/checkout-recipient-section";
import {
  buildCheckoutProductImage,
  buildCheckoutShippingAddress,
  buildCheckoutShippingOptions,
  emptyCheckoutForm,
  mapAddressToCheckoutForm,
  type CheckoutFormState,
  type DraftItem,
  type PaymentChoice,
  type ShippingChoice,
} from "@/components/storefront/checkout/checkout-shared";
import { CheckoutShippingSection } from "@/components/storefront/checkout/checkout-shipping-section";
import { storefrontSyncIntervalMs } from "@/components/storefront/storefront-shared";
import {
  RecoveredEditorialFooter,
  RecoveredStorefrontHeader,
} from "@/components/storefront-shared/recovered-storefront-chrome";
import { EmptyState, InlineAlert, LoadingScreen } from "@/components/storefront-shared/storefront-ui";
import { useAuthState } from "@/hooks/useAuth";
import { useCartActions, useCartState } from "@/hooks/useCart";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { orderApi, paymentApi } from "@/lib/api";
import { productApi } from "@/lib/api/product";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { invalidateOrderPaymentsResource } from "@/lib/resources/account-resources";
import type { Product } from "@/types/api";

export function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Đang chuẩn bị thanh toán..." />}>
      <CheckoutPageContent />
    </Suspense>
  );
}

function CheckoutPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, isAuthenticated } = useAuthState();
  const { cart } = useCartState();
  const { clearCart, refreshCart } = useCartActions();
  const { addresses, isLoading: isLoadingAddresses } = useSavedAddresses(token);

  const [form, setForm] = useState<CheckoutFormState>(emptyCheckoutForm);
  const [shippingMethod, setShippingMethod] = useState<ShippingChoice>("standard");
  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice>("manual");
  const [directProduct, setDirectProduct] = useState<Product | null>(null);
  const [cartProductMap, setCartProductMap] = useState<Record<string, Product>>({});
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const directProductId = searchParams.get("buy_now") ?? "";
  const directQuantity = Math.max(1, Number(searchParams.get("qty") || "1"));
  const redirectTarget = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const loginHref = `/login?redirect=${encodeURIComponent(redirectTarget)}`;

  const syncCheckoutData = useCallback(async () => {
    try {
      setIsSyncingProducts(true);

      if (directProductId) {
        const response = await productApi.getProductById(directProductId);
        setDirectProduct(response.data);
        setCartProductMap({});
      } else {
        setDirectProduct(null);
        let cartItems = cart.items;

        if (token) {
          const refreshedCart = await refreshCart();
          cartItems = refreshedCart.items;
        }

        const productIds = cartItems.map((item) => item.product_id).filter(Boolean);

        if (productIds.length > 0) {
          const response = await productApi.getProductsByIds(productIds);
          setCartProductMap(Object.fromEntries(response.data.map((product) => [product.id, product])));
        } else {
          setCartProductMap({});
        }
      }

      setLastSyncedAt(new Date());
      setFeedback("");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsSyncingProducts(false);
    }
  }, [cart.items, directProductId, refreshCart, token]);

  useEffect(() => {
    void syncCheckoutData();
    const intervalId = window.setInterval(() => void syncCheckoutData(), storefrontSyncIntervalMs);
    const handleFocus = () => void syncCheckoutData();

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [syncCheckoutData]);

  useEffect(() => {
    const defaultAddress = addresses.find((item) => item.is_default) ?? addresses[0];
    if (!defaultAddress) {
      return;
    }

    setForm((current) =>
      current.fullName || current.location || current.phone
        ? current
        : mapAddressToCheckoutForm(defaultAddress),
    );
  }, [addresses]);

  const draftItems = useMemo<DraftItem[]>(() => {
    if (directProduct) {
      return [
        {
          product_id: directProduct.id,
          quantity: directQuantity,
          name: directProduct.name,
          price: directProduct.price,
          stock: directProduct.stock,
          status: directProduct.status,
          imageUrl: buildCheckoutProductImage(directProduct, directProduct.name),
        },
      ];
    }

    return cart.items.map((item) => {
      const product = cartProductMap[item.product_id];

      return {
        product_id: item.product_id,
        quantity: item.quantity,
        name: product?.name || item.name,
        price: product?.price ?? item.price,
        stock: product?.stock ?? item.quantity,
        status: product?.status ?? "active",
        imageUrl: buildCheckoutProductImage(product ?? null, item.name),
      };
    });
  }, [cart.items, cartProductMap, directProduct, directQuantity]);

  const hasStockConflict = draftItems.some(
    (item) => item.status !== "active" || item.stock <= 0 || item.quantity > item.stock,
  );
  const subtotal = draftItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingOptions = buildCheckoutShippingOptions(subtotal);
  const selectedShipping =
    shippingOptions.find((option) => option.value === shippingMethod) ?? shippingOptions[0];
  const total = subtotal + selectedShipping.fee;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAuthenticated || !token) {
      router.push(loginHref);
      return;
    }

    if (draftItems.length === 0) {
      setFeedback("Không có sản phẩm để thanh toán.");
      return;
    }

    if (hasStockConflict) {
      setFeedback("Vui lòng xử lý các sản phẩm không còn đủ tồn kho trước khi đặt hàng.");
      return;
    }

    const shippingAddress = buildCheckoutShippingAddress(form);

    if (!shippingAddress.recipient_name || !shippingAddress.location || !shippingAddress.phone) {
      setFeedback("Vui lòng điền họ tên, số điện thoại và địa chỉ nhận hàng.");
      return;
    }

    try {
      setIsSubmitting(true);
      const orderResponse = await orderApi.createOrder(token, {
        items: draftItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        shipping_method: shippingMethod,
        shipping_address: shippingAddress,
      });
      invalidateOrderPaymentsResource(token);

      const paymentResponse = await paymentApi.processPayment(token, {
        order_id: orderResponse.data.id,
        payment_method: paymentMethod,
      });
      invalidateOrderPaymentsResource(token);

      if (!directProduct && cart.items.length > 0) {
        await clearCart();
      }

      if (paymentResponse.data.checkout_url) {
        window.location.assign(paymentResponse.data.checkout_url);
        return;
      }

      router.replace(`/orders/${orderResponse.data.id}?confirmation=1&paymentId=${paymentResponse.data.id}`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSyncingProducts && draftItems.length === 0 && cart.items.length === 0 && !directProductId) {
    return (
      <main className="min-h-screen bg-background">
        <RecoveredStorefrontHeader />
        <LoadingScreen label="Đang đồng bộ giỏ hàng..." />
      </main>
    );
  }

  if (draftItems.length === 0) {
    return (
      <main className="min-h-screen bg-background">
        <RecoveredStorefrontHeader />
        <section className="shell py-10">
          <EmptyState
            title="Không có sản phẩm để thanh toán"
            description="Chọn mua ngay từ trang sản phẩm hoặc thêm hàng vào giỏ trước khi checkout."
            action={
              <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                Xem catalog
              </Link>
            }
          />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <RecoveredStorefrontHeader />

      <form className="shell grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_380px]" onSubmit={handleSubmit}>
        <section className="grid gap-4">
          <div className="commerce-section">
            <p className="eyebrow">Thanh toán</p>
            <h1 className="mt-2 text-3xl font-semibold text-on-surface">Thông tin nhận hàng và thanh toán</h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              Mỗi 5 giây storefront sẽ đọc lại giá và tồn kho mới nhất trước khi tạo đơn.
            </p>
          </div>

          {feedback ? <InlineAlert tone="error">{feedback}</InlineAlert> : null}
          {!isAuthenticated ? <InlineAlert tone="info">Bạn cần đăng nhập trước khi tạo đơn hàng.</InlineAlert> : null}
          {hasStockConflict ? (
            <InlineAlert tone="error">
              Có sản phẩm không còn đủ tồn kho hoặc đã ngừng bán. Vui lòng chỉnh lại trước khi đặt hàng.
            </InlineAlert>
          ) : null}

          <CheckoutRecipientSection
            addresses={addresses}
            form={form}
            isLoadingAddresses={isLoadingAddresses}
            onSelectAddress={(address) => setForm(mapAddressToCheckoutForm(address))}
            onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
          />
          <CheckoutShippingSection
            shippingOptions={shippingOptions}
            shippingMethod={shippingMethod}
            onChange={setShippingMethod}
          />
          <CheckoutPaymentSection paymentMethod={paymentMethod} onChange={setPaymentMethod} />
        </section>

        <CheckoutOrderSummary
          draftItems={draftItems}
          isSyncingProducts={isSyncingProducts}
          lastSyncedAt={lastSyncedAt}
          selectedShipping={selectedShipping}
          subtotal={subtotal}
          total={total}
          isSubmitting={isSubmitting}
          hasStockConflict={hasStockConflict}
          isAuthenticated={isAuthenticated}
          loginHref={loginHref}
        />
      </form>

      <RecoveredEditorialFooter />
    </main>
  );
}
