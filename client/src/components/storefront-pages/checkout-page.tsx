"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";

import {
  RecoveredEditorialFooter,
  RecoveredStorefrontHeader,
} from "@/components/storefront-shared/recovered-storefront-chrome";
import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
import {
  EmptyState,
  Field,
  InlineAlert,
  LoadingScreen,
  SurfaceCard,
  TextInput,
} from "@/components/storefront-shared/storefront-ui";
import { useAuthState } from "@/hooks/useAuth";
import { useCartActions, useCartState } from "@/hooks/useCart";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { orderApi, paymentApi } from "@/lib/api";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { invalidateOrderPaymentsResource } from "@/lib/resources/account-resources";
import { readProductResource } from "@/lib/resources/product-resources";
import { cn, fallbackImageForProduct } from "@/lib/utils";
import type { Address, OrderPreview, Product } from "@/types/api";
import { formatCurrency, formatShippingMethodLabel } from "@/utils/format";

type PaymentChoice = "manual" | "momo";
type ShippingChoice = "standard" | "express" | "pickup";

type CheckoutFormState = {
  fullName: string;
  location: string;
  phone: string;
};

const emptyForm: CheckoutFormState = {
  fullName: "",
  location: "",
  phone: "",
};

const paymentChoiceCards: Array<{
  value: PaymentChoice;
  label: string;
  description: string;
}> = [
  {
    value: "manual",
    label: "Instant Demo Payment",
    description: "Đánh dấu đơn là paid ngay để test local nhanh hơn.",
  },
  {
    value: "momo",
    label: "MoMo Hosted Checkout",
    description: "Tạo pending payment rồi nhận checkout URL từ payment-service.",
  },
];

export function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Đang chuẩn bị checkout..." />}>
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
  const { clearCart } = useCartActions();
  const { addresses, isLoading: isLoadingAddresses } = useSavedAddresses(token);

  const [form, setForm] = useState<CheckoutFormState>(emptyForm);
  const [shippingMethod, setShippingMethod] = useState<ShippingChoice>("standard");
  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice>("manual");
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<OrderPreview | null>(null);
  const [feedback, setFeedback] = useState("");
  const [directProduct, setDirectProduct] = useState<Product | null>(null);
  const [isLoadingDirectProduct, setIsLoadingDirectProduct] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const directProductId = searchParams.get("buy_now") ?? "";
  const directQuantity = Math.max(1, Number(searchParams.get("qty") || "1"));

  useEffect(() => {
    let active = true;

    if (!directProductId) {
      setDirectProduct(null);
      return () => {
        active = false;
      };
    }

    setIsLoadingDirectProduct(true);
    void readProductResource(directProductId)
      .then((product) => {
        if (active) {
          setDirectProduct(product);
        }
      })
      .catch((reason) => {
        if (active) {
          setDirectProduct(null);
          setFeedback(getErrorMessage(reason));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingDirectProduct(false);
        }
      });

    return () => {
      active = false;
    };
  }, [directProductId]);

  useEffect(() => {
    const defaultAddress = addresses.find((item) => item.is_default) ?? addresses[0];
    if (!defaultAddress) {
      return;
    }

    setForm((current) =>
      current.fullName || current.location || current.phone
        ? current
        : mapAddressToForm(defaultAddress),
    );
  }, [addresses]);

  const draftItems = useMemo(
    () =>
      directProduct
        ? [
            {
              product_id: directProduct.id,
              quantity: directQuantity,
              name: directProduct.name,
              price: directProduct.price,
            },
          ]
        : cart.items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            name: item.name,
            price: item.price,
          })),
    [cart.items, directProduct, directQuantity],
  );

  const subtotal = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [draftItems],
  );
  const summary = couponPreview ?? {
    subtotal_price: subtotal,
    discount_amount: 0,
    shipping_method: shippingMethod,
    shipping_fee: shippingMethod === "express" ? 12 : shippingMethod === "pickup" ? 0 : subtotal > 120 ? 0 : 8,
    total_price: subtotal,
    coupon_code: undefined,
    coupon_description: undefined,
  };
  summary.total_price = summary.subtotal_price - summary.discount_amount + summary.shipping_fee;
  const shippingChoiceCards = useMemo(() => buildShippingChoiceCards(subtotal), [subtotal]);
  const selectedShippingChoice =
    shippingChoiceCards.find((option) => option.value === shippingMethod) ?? shippingChoiceCards[0];

  async function handlePreview() {
    if (!token) {
      setFeedback("Bạn cần đăng nhập để xem trước tổng tiền từ order-service.");
      return;
    }

    if (draftItems.length === 0) {
      setFeedback("Không có sản phẩm nào để thanh toán.");
      return;
    }

    try {
      setIsPreviewing(true);
      const response = await orderApi.previewOrder(token, {
        items: draftItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        coupon_code: couponCode.trim() || undefined,
        shipping_method: shippingMethod,
        shipping_address: buildShippingAddress(form),
      });
      setCouponPreview(response.data);
      setFeedback("");
    } catch (reason) {
      setCouponPreview(null);
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAuthenticated || !token) {
      const redirectTarget = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
      return;
    }

    if (draftItems.length === 0) {
      setFeedback("Không có sản phẩm nào để checkout.");
      return;
    }

    const shippingAddress = buildShippingAddress(form);

    if (!shippingAddress.recipient_name || !shippingAddress.location || !shippingAddress.phone) {
      setFeedback("Vui lòng điền đủ họ tên, địa chỉ và số điện thoại.");
      return;
    }

    try {
      setIsSubmitting(true);

      const orderResponse = await orderApi.createOrder(token, {
        items: draftItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        coupon_code: couponCode.trim() || undefined,
        shipping_method: shippingMethod,
        shipping_address: shippingAddress,
      });
      // A new order changes the account summary even if the payment request later fails.
      invalidateOrderPaymentsResource(token);

      const paymentResponse = await paymentApi.processPayment(token, {
        order_id: orderResponse.data.id,
        payment_method: paymentMethod,
      });
      invalidateOrderPaymentsResource(token);

      if (!directProduct && cart.items.length > 0) {
        await clearCart();
      }

      const confirmationQuery = new URLSearchParams({
        confirmation: "1",
        paymentId: paymentResponse.data.id,
      });

      router.replace(`/orders/${orderResponse.data.id}?${confirmationQuery.toString()}`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingDirectProduct) {
    return (
      <>
        <main>
          <section className="shell pt-6 md:pt-8">
            <RecoveredStorefrontHeader navigation="fallback" tone="light" />
          </section>
          <LoadingScreen label="Đang chuẩn bị đơn mua ngay..." />
          <section className="shell pb-12">
            <RecoveredEditorialFooter />
          </section>
        </main>
      </>
    );
  }

  if (draftItems.length === 0) {
    return (
      <>
        <main>
          <section className="shell pt-6 md:pt-8">
            <RecoveredStorefrontHeader navigation="fallback" tone="light" />
          </section>
          <section className="shell section-spacing">
            <EmptyState
              title="Không có sản phẩm để thanh toán"
              description="Hãy thêm sản phẩm vào giỏ hoặc chọn Mua ngay từ trang chi tiết."
              action={
                <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                  Quay lại catalog
                </Link>
              }
            />
          </section>
          <section className="shell pb-12">
            <RecoveredEditorialFooter />
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <main>
        <section className="shell pt-6 md:pt-8">
          <RecoveredStorefrontHeader navigation="fallback" tone="light" />
        </section>

        <section className="shell section-spacing checkout-shell space-y-10">
          <section className="checkout-shell-heading grid gap-6 rounded-[2rem] border border-[#d9d2c9] bg-white/72 px-6 py-7 shadow-editorial backdrop-blur md:px-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="eyebrow">Checkout</p>
              <h1 className="mt-4 max-w-4xl font-serif text-5xl font-semibold tracking-[-0.05em] text-primary md:text-[4.25rem]">
                Complete your order details below.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-on-surface-variant md:text-lg">
                Checkout này đang port lại layout editorial cũ hơn, nhưng vẫn dùng cùng flow thật:
                preview tổng tiền, tạo order, rồi chuyển payment-service xử lý thanh toán.
              </p>
            </div>

            <div className="grid content-start gap-4">
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Items ready
                </p>
                <p className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                  {draftItems.length}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Shipping lane
                </p>
                <p className="mt-3 text-sm font-medium leading-7 text-primary">
                  {selectedShippingChoice.label}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Payment lane
                </p>
                <p className="mt-3 text-sm font-medium leading-7 text-primary">
                  {paymentChoiceCards.find((option) => option.value === paymentMethod)?.label || paymentMethod}
                </p>
              </div>
            </div>
          </section>

          {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}
          {!isAuthenticated ? (
            <InlineAlert tone="info">
              Checkout cần tài khoản hợp lệ vì order-service và payment-service đều yêu cầu JWT. Bạn vẫn có thể xem trước tóm tắt đơn hàng ở đây.
            </InlineAlert>
          ) : null}

          <form className="checkout-editorial-grid grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]" onSubmit={handleSubmit}>
            <div className="checkout-editorial-main space-y-6">
              <SurfaceCard className="checkout-editorial-section p-6 md:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="checkout-section-title flex items-center gap-3">
                      <span className="checkout-step-badge inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
                        1
                      </span>
                      <div>
                        <p className="eyebrow">Delivery contact</p>
                        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                          Địa chỉ giao hàng
                        </h2>
                      </div>
                    </div>
                  </div>
                  {isLoadingAddresses ? (
                    <span className="text-sm text-on-surface-variant">Đang tải địa chỉ...</span>
                  ) : null}
                </div>

                <p className="checkout-section-note mt-5 text-sm leading-7 text-on-surface-variant">
                  {shippingMethod === "pickup"
                    ? "Pickup order chỉ cần thông tin liên hệ để xác nhận lượt nhận tại quầy."
                    : addresses.length > 0
                      ? "Địa chỉ đã lưu có thể được chọn lại ngay tại đây để quay về luồng checkout nhanh."
                      : "Điền đầy đủ họ tên, địa chỉ và số điện thoại để order-service ghi nhận shipping snapshot."}
                </p>

                {addresses.length > 0 ? (
                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {addresses.map((address) => (
                      <button
                        key={address.id}
                        type="button"
                        className="rounded-[1.5rem] bg-surface px-4 py-4 text-left transition hover:bg-surface-container-high"
                        onClick={() => setForm(mapAddressToForm(address))}
                      >
                        <p className="text-sm font-semibold text-primary">{address.recipient_name}</p>
                        <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                          {address.location}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="checkout-field-grid mt-6 grid gap-5 md:grid-cols-2">
                  <div className="checkout-field">
                    <Field htmlFor="checkout-full-name" label="Họ tên" required>
                      <TextInput
                        id="checkout-full-name"
                        value={form.fullName}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, fullName: event.target.value }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="checkout-field">
                    <Field htmlFor="checkout-phone" label="Số điện thoại" required>
                      <TextInput
                        id="checkout-phone"
                        value={form.phone}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, phone: event.target.value }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="checkout-field checkout-field-full md:col-span-2">
                    <Field htmlFor="checkout-location" label="Địa chỉ" required>
                      <TextInput
                        id="checkout-location"
                        value={form.location}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, location: event.target.value }))
                        }
                      />
                    </Field>
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard className="checkout-editorial-section p-6 md:p-7">
                <div className="checkout-section-title flex items-center gap-3">
                  <span className="checkout-step-badge inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
                    2
                  </span>
                  <div>
                    <p className="eyebrow">Shipping method</p>
                    <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                      Chọn nhịp giao hàng
                    </h2>
                  </div>
                </div>

                <div className="checkout-choice-list mt-6 space-y-4">
                  {shippingChoiceCards.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "checkout-choice-card block rounded-[1.5rem] border px-5 py-5 transition",
                        shippingMethod === option.value
                          ? "checkout-choice-card-active border-primary/35 bg-white"
                          : "border-outline-variant/20 bg-surface hover:border-primary/20 hover:bg-surface-container-high",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="checkout-choice-card-copy flex gap-4">
                          <input
                            checked={shippingMethod === option.value}
                            name="shipping-method"
                            type="radio"
                            value={option.value}
                            onChange={() => setShippingMethod(option.value)}
                          />
                          <div>
                            <strong className="block text-base font-semibold text-primary">
                              {option.label}
                            </strong>
                            <span className="mt-2 block text-sm leading-7 text-on-surface-variant">
                              {option.description}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-sm text-on-surface-variant">
                          <p className="font-medium text-primary">
                            {option.fee === 0 ? "Free" : formatCurrency(option.fee)}
                          </p>
                          <p className="mt-1">{option.eta}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </SurfaceCard>

              <SurfaceCard className="checkout-editorial-section p-6 md:p-7">
                <div className="checkout-section-title flex items-center gap-3">
                  <span className="checkout-step-badge inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
                    3
                  </span>
                  <div>
                    <p className="eyebrow">Payment method</p>
                    <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                      Chọn payment lane
                    </h2>
                  </div>
                </div>

                <div className="checkout-choice-list mt-6 space-y-4">
                  {paymentChoiceCards.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "checkout-choice-card block rounded-[1.5rem] border px-5 py-5 transition",
                        paymentMethod === option.value
                          ? "checkout-choice-card-active border-primary/35 bg-white"
                          : "border-outline-variant/20 bg-surface hover:border-primary/20 hover:bg-surface-container-high",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="checkout-choice-card-copy flex items-start gap-4">
                          <input
                            checked={paymentMethod === option.value}
                            name="payment-method"
                            type="radio"
                            value={option.value}
                            onChange={() => setPaymentMethod(option.value)}
                          />
                          <div>
                            <strong className="block text-base font-semibold text-primary">
                              {option.label}
                            </strong>
                            <span className="mt-2 block text-sm leading-7 text-on-surface-variant">
                              {option.description}
                            </span>
                          </div>
                        </div>
                        <span className="checkout-method-pill">
                          {option.value === "momo" ? "Hosted" : "Instant"}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </SurfaceCard>
            </div>

            <aside className="checkout-summary-panel space-y-5">
              <SurfaceCard className="checkout-summary-card p-6">
                <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                  Order Summary
                </h2>
                <div className="checkout-summary-items mt-6 space-y-4">
                  {draftItems.map((item) => {
                    const image =
                      directProduct?.id === item.product_id
                        ? directProduct.image_urls[0] || directProduct.image_url
                        : undefined;
                    return (
                      <div
                        key={item.product_id}
                        className="checkout-summary-item flex items-center gap-3 rounded-[1.25rem] bg-surface p-3"
                      >
                        <div className="checkout-summary-thumb relative h-16 w-16 overflow-hidden rounded-[1rem] bg-surface-container-low">
                          <StorefrontImage
                            alt={item.name}
                            src={image || fallbackImageForProduct(item.name)}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                        <div className="checkout-summary-copy min-w-0 flex-1">
                          <h4 className="truncate text-sm font-semibold text-primary">{item.name}</h4>
                          <p>Archive item ready for order creation.</p>
                          <div className="checkout-summary-meta">
                            <span>Qty {item.quantity}</span>
                            <strong className="text-sm text-primary">
                              {formatCurrency(item.price * item.quantity)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="checkout-voucher-panel mt-6 space-y-3">
                  <span className="checkout-voucher-label">Voucher preview</span>
                  <div className="checkout-voucher-row">
                    <TextInput
                      placeholder="Nhập mã voucher"
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value)}
                    />
                    <button
                      type="button"
                      className={cn(buttonStyles({ variant: "secondary" }), "checkout-voucher-action")}
                      disabled={isPreviewing}
                      onClick={() => void handlePreview()}
                    >
                      {isPreviewing ? "Đang tính..." : "Xem trước tổng tiền"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      className={cn(buttonStyles({ variant: "ghost" }), "w-full")}
                      onClick={() => {
                        setCouponCode("");
                        setCouponPreview(null);
                      }}
                    >
                      Gỡ voucher
                    </button>
                  </div>
                  {couponPreview?.coupon_description ? (
                    <div className="rounded-[1.25rem] bg-surface px-4 py-4 text-sm leading-7 text-on-surface-variant">
                      <p className="font-medium text-primary">
                        {couponPreview.coupon_code || "Voucher applied"}
                      </p>
                      <p className="mt-2">{couponPreview.coupon_description}</p>
                    </div>
                  ) : null}
                </div>

                <div className="checkout-summary-totals mt-6 space-y-3 text-sm text-on-surface-variant">
                  <div className="checkout-summary-line flex items-center justify-between">
                    <span>Method</span>
                    <strong className="text-primary">
                      {formatShippingMethodLabel(summary.shipping_method)}
                    </strong>
                  </div>
                  <div className="checkout-summary-line flex items-center justify-between">
                    <span>ETA</span>
                    <strong className="text-primary">{selectedShippingChoice.eta}</strong>
                  </div>
                  <div className="checkout-summary-line flex items-center justify-between">
                    <span>Tạm tính</span>
                    <strong className="text-primary">{formatCurrency(summary.subtotal_price)}</strong>
                  </div>
                  <div className="checkout-summary-line flex items-center justify-between">
                    <span>Giảm giá</span>
                    <strong className="text-primary">
                      -{formatCurrency(summary.discount_amount)}
                    </strong>
                  </div>
                  <div className="checkout-summary-line flex items-center justify-between">
                    <span>{formatShippingMethodLabel(summary.shipping_method)}</span>
                    <strong className="text-primary">{formatCurrency(summary.shipping_fee)}</strong>
                  </div>
                  <div className="checkout-summary-line checkout-summary-line-total flex items-center justify-between border-t border-outline-variant/20 pt-3">
                    <span>Tổng cộng</span>
                    <strong className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                      {formatCurrency(summary.total_price)}
                    </strong>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="submit"
                    className={cn(buttonStyles({ size: "lg" }), "checkout-place-order")}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Đang tạo đơn..." : "Đặt hàng và thanh toán"}
                  </button>
                  {!isAuthenticated ? (
                    <Link
                      href={`/login?redirect=${encodeURIComponent(
                        `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
                      )}`}
                      className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")}
                    >
                      Đăng nhập để tiếp tục
                    </Link>
                  ) : null}
                </div>

                <p className="checkout-summary-caption">
                  Order được tạo trước, sau đó payment-service xử lý lane tương ứng của bạn.
                </p>
                <div className="checkout-summary-trust">
                  <span>order-service</span>
                  <span>payment-service</span>
                  <span>returns ready</span>
                </div>
              </SurfaceCard>

              <SurfaceCard className="bg-[#f6f1ea] p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Checkout note
                </p>
                <p className="mt-4 text-sm leading-7 text-on-surface-variant">
                  {paymentMethod === "momo"
                    ? "MoMo sẽ trả về payment record và hosted checkout URL sau khi order đã được tạo."
                    : "Manual payment lane phù hợp cho demo local khi bạn muốn order chuyển sang trạng thái paid ngay."}
                </p>
              </SurfaceCard>
            </aside>
          </form>
        </section>

        <section className="shell pb-12">
          <RecoveredEditorialFooter />
        </section>
      </main>
    </>
  );
}

function mapAddressToForm(address: Address): CheckoutFormState {
  return {
    fullName: address.recipient_name,
    location: address.location,
    phone: address.phone,
  };
}

function buildShippingAddress(form: CheckoutFormState) {
  return {
    recipient_name: form.fullName.trim(),
    phone: form.phone.trim(),
    location: form.location.trim(),
  };
}

function buildShippingChoiceCards(subtotal: number) {
  return [
    {
      value: "standard" as const,
      label: "Giao tiêu chuẩn",
      description: "Best value cho đơn hàng thường ngày và đồng bộ đúng luồng shipping cơ bản.",
      eta: "3-5 ngày",
      fee: subtotal > 120 ? 0 : 8,
    },
    {
      value: "express" as const,
      label: "Giao nhanh",
      description: "Ưu tiên xử lý sớm hơn cho các đơn cần nhận gấp.",
      eta: "1-2 ngày",
      fee: 12,
    },
    {
      value: "pickup" as const,
      label: "Nhận tại quầy",
      description: "Không cần địa chỉ giao hàng chi tiết, chỉ cần thông tin liên hệ.",
      eta: "Same day",
      fee: 0,
    },
  ];
}
