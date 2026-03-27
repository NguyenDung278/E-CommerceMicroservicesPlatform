"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { CreditCard, Lock, ShieldCheck, Wallet } from "lucide-react";
import { useState, useTransition } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button, EmptyState } from "@/components/storefront-ui";
import type { ShippingAddress } from "@/lib/types";
import { formatCurrencyPrecise } from "@/lib/utils";
import { useStorefront } from "@/store/storefront-provider";

type PaymentMethod = "card" | "wallet";

export function CheckoutPage() {
  const router = useRouter();
  const [isSubmitting, startTransition] = useTransition();
  const {
    cartLines,
    shippingAddress,
    updateShippingAddress,
    placeOrder,
    subtotal,
    shippingFee,
    tax,
    total,
  } = useStorefront();

  const [formState, setFormState] = useState<ShippingAddress>(shippingAddress);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");

  const isFormComplete = Object.values(formState).every(Boolean);

  function updateField<Key extends keyof ShippingAddress>(
    field: Key,
    value: ShippingAddress[Key],
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handlePlaceOrder() {
    if (!isFormComplete || !cartLines.length) {
      return;
    }

    startTransition(() => {
      updateShippingAddress(formState);
      placeOrder({
        shippingAddress: formState,
        email: formState.email,
      });
      router.push("/order-confirmation");
    });
  }

  return (
    <>
      <SiteHeader />
      <main className="shell section-spacing">
        {!cartLines.length ? (
          <EmptyState
            title="There’s nothing to check out yet"
            description="The checkout layout is ready, but it needs line items in the bag. Add products from the catalog or restore the seeded cart from the bag page."
          />
        ) : (
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section>
              <p className="eyebrow">Checkout</p>
              <h1 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary md:text-6xl">
                Complete your order
              </h1>
              <p className="mt-4 max-w-xl text-base leading-8 text-on-surface-variant">
                The form follows the same warm editorial system, but with stronger
                contrast, clearer labels and safer focus treatment than the
                original mockup.
              </p>

              <div className="mt-10 space-y-10">
                <section className="rounded-[1.8rem] bg-white/55 p-6 md:p-8">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">
                      1
                    </span>
                    <h2 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                      Shipping address
                    </h2>
                  </div>

                  <div className="mt-8 grid gap-6 md:grid-cols-2">
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">
                        Full name
                      </span>
                      <input
                        value={formState.fullName}
                        className="minimal-input"
                        onChange={(event) => updateField("fullName", event.target.value)}
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">
                        Email
                      </span>
                      <input
                        value={formState.email}
                        type="email"
                        className="minimal-input"
                        onChange={(event) => updateField("email", event.target.value)}
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">
                        Street address
                      </span>
                      <input
                        value={formState.streetAddress}
                        className="minimal-input"
                        onChange={(event) =>
                          updateField("streetAddress", event.target.value)
                        }
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">
                        City
                      </span>
                      <input
                        value={formState.city}
                        className="minimal-input"
                        onChange={(event) => updateField("city", event.target.value)}
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">
                        Postcode
                      </span>
                      <input
                        value={formState.postcode}
                        className="minimal-input"
                        onChange={(event) => updateField("postcode", event.target.value)}
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">
                        Country
                      </span>
                      <input
                        value={formState.country}
                        className="minimal-input"
                        onChange={(event) => updateField("country", event.target.value)}
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">
                        Phone
                      </span>
                      <input
                        value={formState.phone}
                        className="minimal-input"
                        onChange={(event) => updateField("phone", event.target.value)}
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-[1.8rem] bg-white/55 p-6 md:p-8">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">
                      2
                    </span>
                    <h2 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                      Payment method
                    </h2>
                  </div>

                  <div className="mt-8 space-y-4">
                    <label className="flex cursor-pointer items-center justify-between rounded-[1.4rem] bg-surface-container-low px-4 py-4">
                      <div className="flex items-center gap-3">
                        <input
                          checked={paymentMethod === "card"}
                          type="radio"
                          name="payment"
                          className="accent-primary"
                          onChange={() => setPaymentMethod("card")}
                        />
                        <div>
                          <p className="font-medium text-primary">Credit Card</p>
                          <p className="text-sm text-on-surface-variant">
                            Visa, Mastercard, Amex
                          </p>
                        </div>
                      </div>
                      <CreditCard className="h-4 w-4 text-primary" />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between rounded-[1.4rem] bg-surface-container-low px-4 py-4">
                      <div className="flex items-center gap-3">
                        <input
                          checked={paymentMethod === "wallet"}
                          type="radio"
                          name="payment"
                          className="accent-primary"
                          onChange={() => setPaymentMethod("wallet")}
                        />
                        <div>
                          <p className="font-medium text-primary">Digital Wallet</p>
                          <p className="text-sm text-on-surface-variant">
                            Apple Pay, Google Pay
                          </p>
                        </div>
                      </div>
                      <Wallet className="h-4 w-4 text-primary" />
                    </label>
                  </div>

                  {paymentMethod === "card" ? (
                    <div className="mt-8 grid gap-6 md:grid-cols-2">
                      <label className="block md:col-span-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">
                          Card number
                        </span>
                        <input
                          value={cardNumber}
                          placeholder="0000 0000 0000 0000"
                          className="minimal-input"
                          onChange={(event) => setCardNumber(event.target.value)}
                        />
                      </label>

                      <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">
                          Expiry date
                        </span>
                        <input
                          value={expiryDate}
                          placeholder="MM/YY"
                          className="minimal-input"
                          onChange={(event) => setExpiryDate(event.target.value)}
                        />
                      </label>

                      <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">
                          CVV
                        </span>
                        <input
                          value={cvv}
                          placeholder="123"
                          className="minimal-input"
                          onChange={(event) => setCvv(event.target.value)}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="mt-8 rounded-[1.4rem] bg-surface-container-low p-5 text-sm leading-7 text-on-surface-variant">
                      Wallet checkout keeps the same visual rhythm but shortens the form considerably for returning buyers.
                    </div>
                  )}
                </section>
              </div>
            </section>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-[1.9rem] bg-surface-container-low p-6 md:p-8">
                <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                  Order Summary
                </h2>

                <div className="mt-8 space-y-4">
                  {cartLines.map((line) => (
                    <div key={`${line.product.id}-${line.selectedSize}`} className="flex gap-4">
                      <div className="relative h-20 w-16 overflow-hidden rounded-2xl bg-background">
                        <Image
                          src={line.product.image}
                          alt={line.product.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-primary">{line.product.name}</p>
                        <p className="text-sm text-on-surface-variant">
                          {line.selectedColor} / {line.selectedSize}
                        </p>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          Qty {line.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-primary">
                        {formatCurrencyPrecise(line.product.price * line.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 border-t border-outline-variant/25 pt-6 text-sm">
                  <div className="flex items-center justify-between text-on-surface-variant">
                    <span>Subtotal</span>
                    <span>{formatCurrencyPrecise(subtotal)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-on-surface-variant">
                    <span>Shipping</span>
                    <span>
                      {shippingFee === 0 ? "Free" : formatCurrencyPrecise(shippingFee)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-on-surface-variant">
                    <span>Tax</span>
                    <span>{formatCurrencyPrecise(tax)}</span>
                  </div>
                  <div className="mt-5 flex items-baseline justify-between">
                    <span className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                      Total
                    </span>
                    <span className="font-serif text-4xl font-semibold tracking-[-0.04em] text-primary">
                      {formatCurrencyPrecise(total)}
                    </span>
                  </div>
                </div>

                <Button
                  size="lg"
                  className="mt-8 w-full"
                  disabled={!isFormComplete || isSubmitting}
                  onClick={handlePlaceOrder}
                >
                  {isSubmitting ? "Placing order..." : "Place order"}
                </Button>

                <div className="mt-6 space-y-3 text-sm text-on-surface-variant">
                  <div className="flex items-center gap-3">
                    <Lock className="h-4 w-4 text-primary" />
                    Secure SSL encrypted checkout
                  </div>
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Privacy-safe payment details
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
