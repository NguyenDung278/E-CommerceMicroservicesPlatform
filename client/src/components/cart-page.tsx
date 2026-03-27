"use client";

import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Trash2, Truck, WandSparkles } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonStyles } from "@/lib/button-styles";
import {
  Badge,
  Button,
  EmptyState,
  ProductCard,
  QuantityStepper,
  SectionHeading,
} from "@/components/storefront-ui";
import { formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import { useStorefront } from "@/store/storefront-provider";

export function CartPage() {
  const {
    cartLines,
    subtotal,
    shippingFee,
    tax,
    total,
    removeFromCart,
    updateQuantity,
    wishlist,
    wishlistProducts,
    toggleWishlist,
    addToCart,
    resetDemo,
  } = useStorefront();

  return (
    <>
      <SiteHeader />
      <main className="shell section-spacing">
        <div className="mb-10">
          <h1 className="font-serif text-4xl font-semibold tracking-[-0.04em] text-primary md:text-6xl">
            Shopping Bag
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-outline">
              ND editorial collection
            </p>
            <Badge>Dev note: cart microservice active</Badge>
          </div>
        </div>

        {!cartLines.length ? (
          <EmptyState
            title="Your bag is empty"
            description="The empty state is ready for QA. Reset the seeded demo cart, browse the catalog again, or drag items into the bag from the archive page to repopulate it."
            action={
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/catalog" className={buttonStyles({ size: "lg" })}>
                  Browse the archive
                </Link>
                <Button variant="secondary" size="lg" onClick={resetDemo}>
                  Restore demo cart
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              {cartLines.map((line) => (
                <article
                  key={`${line.product.id}-${line.selectedColor}-${line.selectedSize}`}
                  className="grid gap-5 rounded-[1.9rem] bg-white/45 p-5 shadow-[0_10px_40px_-28px_rgba(27,28,25,0.35)] md:grid-cols-[180px_minmax(0,1fr)] md:p-6"
                >
                  <div className="relative overflow-hidden rounded-[1.5rem] bg-surface-container-low">
                    <div className="relative aspect-[0.8]">
                      <Image
                        src={line.product.image}
                        alt={line.product.name}
                        fill
                        sizes="180px"
                        className="object-cover"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
                          {line.product.category}
                        </p>
                        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                          {line.product.name}
                        </h2>
                        <p className="mt-2 text-sm text-on-surface-variant">
                          {line.selectedColor} / Size {line.selectedSize}
                        </p>
                      </div>
                      <p className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                        {formatCurrency(line.product.price * line.quantity)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <QuantityStepper
                        quantity={line.quantity}
                        onDecrease={() =>
                          updateQuantity(line.product.id, Math.max(1, line.quantity - 1))
                        }
                        onIncrease={() =>
                          updateQuantity(line.product.id, Math.min(9, line.quantity + 1))
                        }
                      />

                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-sm font-medium text-secondary transition hover:text-error"
                        onClick={() => removeFromCart(line.product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-[1.9rem] bg-surface-container-low p-6 md:p-8">
                <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                  Order Summary
                </h2>

                <div className="mt-8 space-y-4 text-sm">
                  <div className="flex items-center justify-between text-on-surface-variant">
                    <span>Subtotal</span>
                    <span className="text-primary">{formatCurrencyPrecise(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-on-surface-variant">
                    <span>Shipping</span>
                    <span className="text-primary">
                      {shippingFee === 0 ? "Free" : formatCurrencyPrecise(shippingFee)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-on-surface-variant">
                    <span>Estimated tax</span>
                    <span className="text-primary">{formatCurrencyPrecise(tax)}</span>
                  </div>
                </div>

                <div className="mt-8 border-t border-outline-variant/25 pt-6">
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                      Total
                    </span>
                    <span className="font-serif text-4xl font-semibold tracking-[-0.04em] text-primary">
                      {formatCurrencyPrecise(total)}
                    </span>
                  </div>
                </div>

                <Link
                  href="/checkout"
                  className={buttonStyles({ size: "lg", className: "mt-8 w-full" })}
                >
                  Proceed to checkout
                </Link>

                <div className="mt-8 space-y-4 text-sm text-on-surface-variant">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Secure encrypted payment processing
                  </div>
                  <div className="flex items-center gap-3">
                    <Truck className="h-4 w-4 text-primary" />
                    Complimentary shipping on orders above $1,000
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[1.7rem] bg-white/55 p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-outline">
                  Exclusive offer
                </p>
                <h3 className="mt-4 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  Join the inner circle
                </h3>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                  Early access, higher-contrast order updates and launch previews for the next drop.
                </p>
                <button
                  type="button"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary underline decoration-tertiary underline-offset-8"
                >
                  <WandSparkles className="h-4 w-4" />
                  Join now
                </button>
              </div>
            </aside>
          </div>
        )}

        {wishlistProducts.length ? (
          <section id="saved" className="mt-20">
            <SectionHeading
              eyebrow="Saved for later"
              title="Wishlist items stay persistent across routes."
              description="This section gives you a second stateful surface to test save/remove flows without adding a separate wishlist route."
            />
            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {wishlistProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  wishlisted={wishlist.includes(product.id)}
                  onToggleWishlist={toggleWishlist}
                  onAddToCart={(selectedProduct) =>
                    addToCart({ productId: selectedProduct.id })
                  }
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
