"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { defaultCartLines, defaultShippingAddress, getProductById } from "@/data/storefront";
import { buttonStyles } from "@/lib/button-styles";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/storefront-ui";
import { formatCurrencyPrecise } from "@/lib/utils";
import { useStorefront } from "@/store/storefront-provider";

export function ConfirmationPage() {
  const { lastOrder } = useStorefront();
  const fallbackLines = defaultCartLines
    .map((line) => {
      const product = getProductById(line.productId);
      return product ? { ...line, product } : null;
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));

  const orderLines = lastOrder
    ? lastOrder.lines
        .map((line) => {
          const product = getProductById(line.productId);
          return product ? { ...line, product } : null;
        })
        .filter((line): line is NonNullable<typeof line> => Boolean(line))
    : fallbackLines;

  const subtotal = orderLines.reduce(
    (total, line) => total + line.product.price * line.quantity,
    0,
  );
  const shipping = subtotal > 1000 || subtotal === 0 ? 0 : 18;
  const tax = subtotal * 0.084;
  const total = subtotal + shipping + tax;
  const shippingAddress = lastOrder?.shippingAddress ?? defaultShippingAddress;

  return (
    <>
      <SiteHeader />
      <main className="shell section-spacing">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-[2rem] bg-white/55 px-6 py-12 text-center shadow-[0_20px_70px_-45px_rgba(27,28,25,0.38)] md:px-10">
            <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/8">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <h1 className="mt-8 font-serif text-5xl font-semibold tracking-[-0.04em] text-primary md:text-6xl">
              Thank you
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-8 text-on-surface-variant">
              Your order has been placed successfully and is now being prepared
              with care in the atelier.
            </p>
            {!lastOrder ? (
              <div className="mt-6 flex justify-center">
                <Badge>Showing seeded confirmation preview</Badge>
              </div>
            ) : null}
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.8rem] bg-surface-container-low p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-outline">
                Order number
              </p>
              <p className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                {lastOrder?.orderNumber ?? "ND-Preview"}
              </p>
              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-outline">
                Estimated arrival
              </p>
              <p className="mt-3 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                {lastOrder?.etaLabel ?? "Arrives in 4-6 business days"}
              </p>
            </div>

            <div className="rounded-[1.8rem] bg-surface-container-low p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-outline">
                Shipping to
              </p>
              <address className="mt-3 not-italic text-base leading-8 text-primary">
                <strong>{shippingAddress.fullName}</strong>
                <br />
                {shippingAddress.streetAddress}
                <br />
                {shippingAddress.city}, {shippingAddress.postcode}
                <br />
                {shippingAddress.country}
              </address>
            </div>
          </div>

          <section className="mt-10 rounded-[2rem] bg-white/55 p-6 md:p-8">
            <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
              Order summary
            </h2>

            <div className="mt-8 space-y-6">
              {orderLines.map((line) => (
                <div key={`${line.product.id}-${line.selectedSize}`} className="flex gap-4">
                  <div className="relative h-28 w-20 overflow-hidden rounded-[1.2rem] bg-surface-container-low">
                    <Image
                      src={line.product.image}
                      alt={line.product.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif text-xl font-semibold tracking-[-0.03em] text-primary">
                      {line.product.name}
                    </h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {line.selectedColor} / Size {line.selectedSize}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-sm text-on-surface-variant">
                      <span>Quantity: {line.quantity}</span>
                      <span className="font-medium text-primary">
                        {formatCurrencyPrecise(line.product.price * line.quantity)}
                      </span>
                    </div>
                  </div>
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
                <span>{shipping === 0 ? "Free" : formatCurrencyPrecise(shipping)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-on-surface-variant">
                <span>Tax</span>
                <span>{formatCurrencyPrecise(tax)}</span>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  Total paid
                </span>
                <span className="font-serif text-4xl font-semibold tracking-[-0.04em] text-primary">
                  {formatCurrencyPrecise(total)}
                </span>
              </div>
            </div>
          </section>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/catalog" className={buttonStyles({ size: "lg" })}>
              Continue shopping
            </Link>
            <Link
              href="/product/archive-chelsea-boot"
              className={buttonStyles({ variant: "secondary", size: "lg" })}
            >
              Explore hero product
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
