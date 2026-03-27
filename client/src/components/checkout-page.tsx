"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  EmptyState,
  Field,
  InlineAlert,
  LoadingScreen,
  SectionHeading,
  Select,
  SurfaceCard,
  TextInput,
} from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { orderApi, paymentApi, productApi } from "@/lib/api";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { cn, fallbackImageForProduct } from "@/lib/utils";
import type { Address, OrderPreview, Product } from "@/types/api";
import { formatCurrency, formatShippingMethodLabel } from "@/utils/format";

type PaymentChoice = "manual" | "momo" | "credit_card" | "demo";

type CheckoutFormState = {
  fullName: string;
  street: string;
  city: string;
  district: string;
  ward: string;
  phone: string;
};

const emptyForm: CheckoutFormState = {
  fullName: "",
  street: "",
  city: "",
  district: "",
  ward: "",
  phone: "",
};

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
  const { token, isAuthenticated } = useAuth();
  const { cart, clearCart } = useCart();
  const { addresses, isLoading: isLoadingAddresses } = useSavedAddresses(token);

  const [form, setForm] = useState<CheckoutFormState>(emptyForm);
  const [shippingMethod, setShippingMethod] = useState("standard");
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
    void productApi
      .getProductById(directProductId)
      .then((response) => {
        if (active) {
          setDirectProduct(response.data);
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
      current.fullName || current.street || current.city || current.phone
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

    if (!shippingAddress.recipient_name || !shippingAddress.street || !shippingAddress.city || !shippingAddress.phone) {
      setFeedback("Vui lòng điền đủ họ tên, địa chỉ, thành phố và số điện thoại.");
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

      const paymentResponse = await paymentApi.processPayment(token, {
        order_id: orderResponse.data.id,
        payment_method: paymentMethod,
      });

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
        <SiteHeader />
        <LoadingScreen label="Đang chuẩn bị đơn mua ngay..." />
        <SiteFooter />
      </>
    );
  }

  if (draftItems.length === 0) {
    return (
      <>
        <SiteHeader />
        <main className="shell section-spacing">
          <EmptyState
            title="Không có sản phẩm để thanh toán"
            description="Hãy thêm sản phẩm vào giỏ hoặc chọn Mua ngay từ trang chi tiết."
            action={
              <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                Quay lại catalog
              </Link>
            }
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="shell section-spacing space-y-10">
        <SectionHeading
          eyebrow="Checkout"
          title="Tạo order thật trên order-service rồi chuyển thẳng sang payment-service."
          description="Checkout này dùng cùng contract backend hiện có, hỗ trợ địa chỉ đã lưu, preview tổng tiền và nhiều phương thức thanh toán."
        />

        {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}
        {!isAuthenticated ? (
          <InlineAlert tone="info">
            Checkout cần tài khoản hợp lệ vì order-service và payment-service đều yêu cầu JWT. Bạn vẫn có thể xem trước tóm tắt đơn hàng ở đây.
          </InlineAlert>
        ) : null}

        <form className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]" onSubmit={handleSubmit}>
          <div className="space-y-6">
            <SurfaceCard className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">Shipping</p>
                  <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                    Địa chỉ giao hàng
                  </h2>
                </div>
                {isLoadingAddresses ? <span className="text-sm text-on-surface-variant">Đang tải địa chỉ...</span> : null}
              </div>

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
                        {address.street}
                        <br />
                        {[address.ward, address.district, address.city].filter(Boolean).join(", ")}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field htmlFor="checkout-full-name" label="Họ tên" required>
                  <TextInput id="checkout-full-name" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
                </Field>
                <Field htmlFor="checkout-phone" label="Số điện thoại" required>
                  <TextInput id="checkout-phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                </Field>
                <div className="md:col-span-2">
                  <Field htmlFor="checkout-street" label="Địa chỉ" required>
                    <TextInput id="checkout-street" value={form.street} onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))} />
                  </Field>
                </div>
                <Field htmlFor="checkout-ward" label="Phường / xã">
                  <TextInput id="checkout-ward" value={form.ward} onChange={(event) => setForm((current) => ({ ...current, ward: event.target.value }))} />
                </Field>
                <Field htmlFor="checkout-district" label="Quận / huyện" required>
                  <TextInput id="checkout-district" value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} />
                </Field>
                <div className="md:col-span-2">
                  <Field htmlFor="checkout-city" label="Tỉnh / thành phố" required>
                    <TextInput id="checkout-city" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
                  </Field>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-6">
              <p className="eyebrow">Delivery & payment</p>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field htmlFor="shipping-method" label="Phương thức giao hàng" required>
                  <Select id="shipping-method" value={shippingMethod} onChange={(event) => setShippingMethod(event.target.value)}>
                    <option value="standard">Giao tiêu chuẩn</option>
                    <option value="express">Giao nhanh</option>
                    <option value="pickup">Nhận tại quầy</option>
                  </Select>
                </Field>

                <Field htmlFor="payment-method" label="Phương thức thanh toán" required>
                  <Select id="payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentChoice)}>
                    <option value="manual">Manual</option>
                    <option value="momo">MoMo</option>
                    <option value="credit_card">Credit card</option>
                    <option value="demo">Demo</option>
                  </Select>
                </Field>
              </div>

              <div className="mt-6 flex flex-col gap-3 md:flex-row">
                <TextInput className="flex-1" placeholder="Mã giảm giá" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} />
                <button type="button" className={cn(buttonStyles({ variant: "secondary" }), "w-full md:w-auto")} disabled={isPreviewing} onClick={() => void handlePreview()}>
                  {isPreviewing ? "Đang tính..." : "Xem trước tổng tiền"}
                </button>
              </div>
            </SurfaceCard>
          </div>

          <aside className="space-y-5">
            <SurfaceCard className="p-6">
              <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                Tóm tắt đơn
              </h2>
              <div className="mt-6 space-y-4">
                {draftItems.map((item) => {
                  const image = directProduct?.id === item.product_id
                    ? directProduct.image_urls[0] || directProduct.image_url
                    : undefined;
                  return (
                    <div key={item.product_id} className="flex items-center gap-3 rounded-[1.25rem] bg-surface p-3">
                      <div className="h-16 w-16 overflow-hidden rounded-[1rem] bg-surface-container-low">
                        <img alt={item.name} src={image || fallbackImageForProduct(item.name)} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-primary">{item.name}</p>
                        <p className="mt-1 text-sm text-on-surface-variant">x{item.quantity}</p>
                      </div>
                      <strong className="text-sm text-primary">{formatCurrency(item.price * item.quantity)}</strong>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 space-y-3 text-sm text-on-surface-variant">
                <div className="flex items-center justify-between">
                  <span>Tạm tính</span>
                  <strong className="text-primary">{formatCurrency(summary.subtotal_price)}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Giảm giá</span>
                  <strong className="text-primary">-{formatCurrency(summary.discount_amount)}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>{formatShippingMethodLabel(summary.shipping_method)}</span>
                  <strong className="text-primary">{formatCurrency(summary.shipping_fee)}</strong>
                </div>
                <div className="flex items-center justify-between border-t border-outline-variant/20 pt-3">
                  <span>Tổng cộng</span>
                  <strong className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                    {formatCurrency(summary.total_price)}
                  </strong>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <button type="submit" className={cn(buttonStyles({ size: "lg" }), "w-full")} disabled={isSubmitting}>
                  {isSubmitting ? "Đang tạo đơn..." : "Đặt hàng và thanh toán"}
                </button>
                {!isAuthenticated ? (
                  <Link href={`/login?redirect=${encodeURIComponent(`${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`)}`} className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")}>
                    Đăng nhập để tiếp tục
                  </Link>
                ) : null}
              </div>
            </SurfaceCard>
          </aside>
        </form>
      </main>
      <SiteFooter />
    </>
  );
}

function mapAddressToForm(address: Address): CheckoutFormState {
  return {
    fullName: address.recipient_name,
    street: address.street,
    city: address.city,
    district: address.district,
    ward: address.ward || "",
    phone: address.phone,
  };
}

function buildShippingAddress(form: CheckoutFormState) {
  return {
    recipient_name: form.fullName.trim(),
    phone: form.phone.trim(),
    street: form.street.trim(),
    ward: form.ward.trim() || undefined,
    district: form.district.trim(),
    city: form.city.trim(),
  };
}
