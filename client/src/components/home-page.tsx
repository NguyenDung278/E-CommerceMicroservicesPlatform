"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MoveRight, ShieldCheck, TimerReset, WandSparkles } from "lucide-react";

import {
  categoryShowcase,
  featuredProductSlugs,
  getProductBySlug,
  homeStats,
  products,
  serviceHighlights,
} from "@/data/storefront";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  MicroHighlight,
  ProductCard,
  SectionHeading,
} from "@/components/storefront-ui";
import { buttonStyles } from "@/lib/button-styles";
import { useStorefront } from "@/store/storefront-provider";

const heroImage = products[0]?.gallery[2];

export function HomePage() {
  const { addToCart, toggleWishlist, wishlist } = useStorefront();
  const featuredProducts = featuredProductSlugs
    .map((slug) => getProductBySlug(slug))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative min-h-[88svh] overflow-hidden">
          <div className="absolute inset-0 bg-primary-container">
            <Image
              src={heroImage ?? categoryShowcase[0].image}
              alt="Forest editorial campaign background"
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-85"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/20 to-transparent" />

          <div className="shell relative grid min-h-[88svh] items-end gap-10 pb-14 pt-24 lg:grid-cols-[minmax(0,1fr)_320px] lg:pb-20">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="max-w-3xl"
            >
              <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#f9d7cd]">
                Winter 2026 collection
              </p>
              <h1 className="headline-display max-w-3xl text-surface text-balance">
                Forest &amp; Hearth
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-surface/84 md:text-xl">
                A tactile storefront rebuilt from the referenced Stitch system:
                calmer typography, smarter spacing, faster product search and a
                shopping flow that still feels like an editorial lookbook.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link href="/catalog" className={buttonStyles({ size: "lg" })}>
                  Explore collection
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/product/archive-chelsea-boot"
                  className={buttonStyles({
                    variant: "secondary",
                    size: "lg",
                    className:
                      "border-white/20 bg-white/8 text-surface hover:bg-white/14 hover:text-surface",
                  })}
                >
                  View hero product
                </Link>
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.7, ease: "easeOut" }}
              className="rounded-[1.8rem] border border-white/10 bg-white/8 p-6 text-surface backdrop-blur-md"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-surface/70">
                The technical edge
              </p>
              <p className="mt-4 font-serif text-2xl font-semibold leading-tight tracking-[-0.03em]">
                Real inventory sync and tactile product storytelling can coexist.
              </p>
              <div className="mt-8 grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
                {homeStats.map((item) => (
                  <div key={item.label}>
                    <p className="font-serif text-3xl font-semibold tracking-[-0.03em]">
                      {item.value}
                    </p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-surface/70">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </motion.aside>
          </div>
        </section>

        <section className="shell section-spacing">
          <SectionHeading
            eyebrow="Curated departments"
            title="An asymmetrical grid that keeps the original rhythm, but scans better on real devices."
            description="We preserved the Stitch mood: warm cream surfaces, oversized serif headlines and image-led category blocks. The spacing and tap targets are adjusted so mobile and tablet feel intentional rather than squeezed."
          />

          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-12 md:auto-rows-[220px] lg:auto-rows-[280px]">
            {categoryShowcase.map((category, index) => {
              const layoutClass =
                index === 0
                  ? "md:col-span-7 md:row-span-1"
                  : index === 1
                    ? "md:col-span-5 md:row-span-2"
                    : index === 2
                      ? "md:col-span-4"
                      : "md:col-span-3";

              return (
                <motion.div
                  key={category.title}
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 260, damping: 24 }}
                  className={layoutClass}
                >
                  <Link
                    href={category.href}
                    className="group relative flex h-full min-h-[280px] overflow-hidden rounded-[2rem] bg-surface-container-low"
                  >
                    <Image
                      src={category.image}
                      alt={category.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition duration-700 group-hover:scale-[1.04]"
                    />
                    <div
                      className={
                        category.tone === "dark"
                          ? "absolute inset-0 bg-gradient-to-t from-primary/75 to-transparent"
                          : "absolute inset-0 bg-gradient-to-t from-white/45 via-transparent to-transparent"
                      }
                    />
                    <div className="relative flex h-full w-full flex-col justify-end p-8 md:p-10">
                      <p
                        className={
                          category.tone === "dark"
                            ? "eyebrow text-surface/70"
                            : "eyebrow text-tertiary-container"
                        }
                      >
                        {index === 0
                          ? "Tailoring"
                          : index === 1
                            ? "Fluid layers"
                            : index === 2
                              ? "Grip & patina"
                              : "Objects & details"}
                      </p>
                      <h3
                        className={
                          category.tone === "dark"
                            ? "mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-surface md:text-4xl"
                            : "mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary md:text-4xl"
                        }
                      >
                        {category.title}
                      </h3>
                      <div
                        className={
                          category.tone === "dark"
                            ? "mt-4 flex items-center gap-2 text-sm font-medium text-surface/80"
                            : "mt-4 flex items-center gap-2 text-sm font-medium text-primary/80"
                        }
                      >
                        <span>{category.description}</span>
                        <MoveRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section id="system" className="bg-surface-container-low py-16 md:py-24">
          <div className="shell grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
            <div className="order-2 lg:order-1">
              <p className="eyebrow">Digital precision, analogue soul</p>
              <h2 className="headline-section mt-4 text-primary">
                Stronger hierarchy and clearer affordances without losing the editorial calm.
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-on-surface-variant md:text-lg">
                The original Stitch direction was beautiful but occasionally too
                understated for live shopping. Here the same tonal layering
                remains, but CTA contrast, focus treatment and loading feedback
                are clearer. That means the interface stays premium while being
                easier to use under pressure.
              </p>
              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <MicroHighlight
                  icon={<TimerReset className="h-5 w-5" />}
                  title="Quicker search feel"
                  copy="Debounced query updates and lightweight skeletons make the catalog feel responsive without jarring jumps."
                />
                <MicroHighlight
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Clearer affordances"
                  copy="Hover, focus and active states are stronger than the mock while still living inside the same palette."
                />
                <MicroHighlight
                  icon={<WandSparkles className="h-5 w-5" />}
                  title="Safer scaling"
                  copy="Shared components, typed data and route structure make future product work much easier to extend."
                />
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, rotate: 2 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7 }}
              className="order-1 overflow-hidden rounded-[2rem] shadow-editorial lg:order-2"
            >
              <Image
                src={serviceHighlights[0] ? products[4].gallery[1] : categoryShowcase[3].image}
                alt="Atelier desk still life"
                width={1200}
                height={900}
                className="h-full w-full object-cover"
              />
            </motion.div>
          </div>
        </section>

        <section className="section-spacing">
          <div className="shell">
            <SectionHeading
              eyebrow="Seasonal essentials"
              title="Featured products stay image-led, but each card now exposes enough data to make a quick buying decision."
              description="Stock state, discount, rating and save/add actions are available directly in the grid. It is still visually quiet, but no longer makes users guess."
              action={
                <Link href="/catalog" className={buttonStyles({ variant: "tertiary" })}>
                  Browse full archive
                </Link>
              }
            />
          </div>

          <div className="no-scrollbar mt-12 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:px-6 lg:px-10 xl:px-12">
            {featuredProducts.map((product, index) => (
              <div
                key={product.id}
                className="min-w-[320px] snap-start md:min-w-[360px] lg:min-w-[380px]"
              >
                <ProductCard
                  product={product}
                  priority={index < 2}
                  wishlisted={wishlist.includes(product.id)}
                  onToggleWishlist={toggleWishlist}
                  onAddToCart={(selectedProduct) =>
                    addToCart({ productId: selectedProduct.id })
                  }
                />
              </div>
            ))}
          </div>
        </section>

        <section className="shell pb-6 md:pb-10">
          <div className="grid gap-5 lg:grid-cols-3">
            {serviceHighlights.map((item) => (
              <MicroHighlight key={item.title} title={item.title} copy={item.copy} />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
