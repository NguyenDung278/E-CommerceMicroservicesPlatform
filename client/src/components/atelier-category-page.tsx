"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown, Plus, ShoppingBag, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import {
  type AtelierFooterLink,
  type AtelierNavItem,
  type AtelierBadgeTone,
  type AtelierBottomSection,
  type AtelierCatalogItem,
  type AtelierCategoryId,
  type AtelierFilterGroup,
  type AtelierPageConfig,
} from "@/components/atelier-page-types";
import { atelierFooterLinks } from "@/components/atelier-page-chrome";
import { StorefrontImage } from "@/components/storefront-image";
import { useAuthState } from "@/hooks/useAuth";
import { useCartState } from "@/hooks/useCart";
import { cn } from "@/lib/utils";

const badgeToneClasses: Record<AtelierBadgeTone, string> = {
  forest: "bg-[#0d2115] text-white",
  terracotta: "bg-[#d5896a] text-white",
  surface: "border border-white/55 bg-[#f5f3ee]/92 text-[#1b1c19] backdrop-blur-md",
  ghost: "border border-[#d9d4cc] bg-white/84 text-[#1b1c19] backdrop-blur-md",
};

type AtelierCategoryPageProps = {
  config: AtelierPageConfig;
  navItems: AtelierNavItem[];
  footerLinks?: AtelierFooterLink[];
};

export function AtelierCategoryPage({
  config,
  navItems,
  footerLinks = atelierFooterLinks,
}: AtelierCategoryPageProps) {
  const { isAuthenticated } = useAuthState();
  const { itemCount } = useCartState();

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <AtelierHeader
        activeCategory={config.id}
        navItems={navItems}
        isAuthenticated={isAuthenticated}
        itemCount={itemCount}
      />

      <main>
        <AtelierHero hero={config.hero} />

        <section className="shell py-14 md:py-20 lg:py-24">
          <div
            className={cn(
              "grid gap-14 lg:gap-16",
              config.contentGridClassName ?? "lg:grid-cols-[220px_minmax(0,1fr)]",
            )}
          >
            <FilterSidebar filters={config.filters} />

            <div className="min-w-0">
              <CatalogToolbar showingLabel={config.showingLabel} sortLabel={config.sortLabel} />
              <CatalogGrid config={config} />
            </div>
          </div>
        </section>

        {config.bottomSection ? <AtelierBottomSectionPanel section={config.bottomSection} /> : null}
      </main>

      <AtelierFooter footerLinks={footerLinks} />
    </div>
  );
}

function AtelierHeader({
  activeCategory,
  navItems,
  isAuthenticated,
  itemCount,
}: {
  activeCategory: AtelierCategoryId;
  navItems: AtelierNavItem[];
  isAuthenticated: boolean;
  itemCount: number;
}) {
  return (
    <header className="glass-nav sticky top-0 z-50 border-b border-black/6">
      <div className="shell py-4 sm:py-5">
        <div className="grid items-center gap-4 md:grid-cols-[minmax(180px,1fr)_auto_minmax(180px,1fr)]">
          <div className="flex items-center justify-between md:justify-start">
            <Link href="/" className="font-serif text-[2rem] tracking-[-0.05em] text-primary">
              ND Shop
            </Link>

            <div className="flex items-center gap-2 md:hidden">
              <HeaderActionLink href={isAuthenticated ? "/profile" : "/login"} label="Account">
                <UserRound className="h-4 w-4 stroke-[1.85]" />
              </HeaderActionLink>
              <BagActionLink itemCount={itemCount} />
            </div>
          </div>

          <nav
            aria-label="Atelier categories"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center md:flex-nowrap md:gap-x-9"
          >
            {navItems.map((item) => {
              const isActive = item.id === activeCategory;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "border-b border-transparent pb-1 text-[13px] font-medium tracking-[0.01em] text-[#6f716c] transition-colors duration-200 hover:text-primary",
                    isActive && "border-primary text-primary",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center justify-end gap-3 md:flex">
            <HeaderActionLink href={isAuthenticated ? "/profile" : "/login"} label="Account">
              <UserRound className="h-4 w-4 stroke-[1.85]" />
            </HeaderActionLink>
            <BagActionLink itemCount={itemCount} />
          </div>
        </div>
      </div>
    </header>
  );
}

function HeaderActionLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-primary transition-colors hover:bg-black/5"
    >
      {children}
    </Link>
  );
}

function BagActionLink({ itemCount }: { itemCount: number }) {
  return (
    <Link
      href="/cart"
      aria-label="Shopping bag"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-primary transition-colors hover:bg-black/5"
    >
      <ShoppingBag className="h-4 w-4 stroke-[1.85]" />
      {itemCount ? (
        <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-tertiary px-1 text-[10px] font-semibold text-white">
          {itemCount > 9 ? "9+" : itemCount}
        </span>
      ) : null}
    </Link>
  );
}

function AtelierHero({ hero }: { hero: AtelierPageConfig["hero"] }) {
  if (hero.variant === "dark-immersive") {
    return <DarkHero hero={hero} />;
  }

  if (hero.variant === "light-framed") {
    return <FramedHero hero={hero} />;
  }

  return <LightHero hero={hero} />;
}

function DarkHero({ hero }: { hero: AtelierPageConfig["hero"] }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-black/6">
      <div className="absolute inset-0">
        <StorefrontImage
          alt={hero.imageAlt}
          src={hero.imageUrl}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#061b0e]/88 via-[#061b0e]/58 to-[#061b0e]/10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_34%,rgba(6,27,14,0.3),transparent_35%)]" />

      <div className="shell relative flex min-h-[540px] items-end pb-14 pt-16 md:min-h-[620px] md:pb-20 lg:min-h-[650px] lg:pb-20">
        <div className="max-w-[44rem] text-white">
          {hero.badge ? (
            <span className="inline-flex rounded-full border border-white/18 bg-[#737593]/72 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white shadow-sm backdrop-blur-md">
              {hero.badge}
            </span>
          ) : null}
          <HeroTitle
            lines={hero.titleLines}
            className="mt-6 max-w-[40rem] font-serif text-[4rem] leading-[0.92] tracking-[-0.065em] text-white sm:text-[4.9rem] lg:text-[5.4rem]"
          />
          <p className="mt-6 max-w-[34rem] font-serif text-[1.55rem] italic leading-[1.28] tracking-[-0.025em] text-[#f3eee7] md:text-[2rem]">
            {hero.description}
          </p>
        </div>
      </div>
    </section>
  );
}

function LightHero({ hero }: { hero: AtelierPageConfig["hero"] }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-black/6 bg-surface-container-low">
      <div className="absolute inset-0">
        <StorefrontImage
          alt={hero.imageAlt}
          src={hero.imageUrl}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-65 mix-blend-multiply"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/58 to-transparent" />

      <div className="shell relative flex min-h-[500px] items-center py-16 md:min-h-[610px] md:py-20 lg:min-h-[640px]">
        <div className="max-w-[42rem]">
          {hero.eyebrow ? (
            <span className="block text-[11px] font-medium uppercase tracking-[0.26em] text-tertiary md:text-sm">
              {hero.eyebrow}
            </span>
          ) : null}
          {hero.badge ? (
            <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white shadow-sm">
              {hero.badge}
            </span>
          ) : null}
          <HeroTitle
            lines={hero.titleLines}
            className={cn(
              "font-serif leading-[0.95] tracking-[-0.065em] text-primary",
              hero.badge || hero.eyebrow ? "mt-6" : "",
              hero.titleLines.length > 1
                ? "text-[3.8rem] sm:text-[5rem] lg:text-[6rem]"
                : "text-[4rem] sm:text-[5.2rem] lg:text-[6.1rem]",
            )}
          />
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-on-surface-variant md:text-xl">
            {hero.description}
          </p>
        </div>
      </div>
    </section>
  );
}

function FramedHero({ hero }: { hero: AtelierPageConfig["hero"] }) {
  return (
    <section className="shell py-6 md:py-8 lg:py-10">
      <header className="relative isolate overflow-hidden rounded-[1.9rem] border border-black/6 bg-surface-container-low">
        <div className="absolute inset-0">
          <StorefrontImage
            alt={hero.imageAlt}
            src={hero.imageUrl}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1440px"
            className="object-cover opacity-68"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/72 to-transparent" />

        <div className="relative min-h-[420px] px-6 py-12 sm:px-8 md:min-h-[500px] md:px-12 md:py-14 lg:min-h-[540px] lg:px-16">
          <div className="max-w-[40rem]">
            <HeroTitle
              lines={hero.titleLines}
              className="font-serif text-[3.8rem] leading-[0.94] tracking-[-0.06em] text-primary sm:text-[4.8rem] lg:text-[5.4rem]"
            />
            <p className="mt-6 max-w-[33rem] text-base leading-relaxed text-on-surface-variant md:text-lg">
              {hero.description}
            </p>
          </div>
        </div>
      </header>
    </section>
  );
}

function HeroTitle({
  lines,
  className,
}: {
  lines: AtelierPageConfig["hero"]["titleLines"];
  className?: string;
}) {
  return (
    <h1 className={className}>
      {lines.map((line) => (
        <span key={line.text} className={cn("block", line.italic && "font-normal italic")}>
          {line.text}
        </span>
      ))}
    </h1>
  );
}

function FilterSidebar({ filters }: { filters: AtelierFilterGroup[] }) {
  return (
    <aside aria-label="Product filters" className="lg:pt-3">
      <div className="space-y-10 lg:sticky lg:top-24">
        {filters.map((group, index) => (
          <FilterGroup key={group.kind === "quote-card" ? `${group.kind}-${index}` : `${group.kind}-${group.title}`} group={group} />
        ))}
      </div>
    </aside>
  );
}

function FilterGroup({ group }: { group: AtelierFilterGroup }) {
  if (group.kind === "quote-card") {
    return (
      <section
        className={cn(
          "rounded-[1.5rem] p-7",
          group.tone === "light" ? "bg-surface-container text-primary" : "bg-primary-container text-surface",
        )}
      >
        <p className="font-serif text-lg italic leading-relaxed">“{group.quote}”</p>
        <p
          className={cn(
            "mt-4 text-[10px] uppercase tracking-[0.24em]",
            group.tone === "light" ? "text-primary/65" : "text-white/60",
          )}
        >
          {group.attribution}
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-serif text-[1.35rem] leading-tight text-primary">{group.title}</h2>

      {group.kind === "list" ? <ListFilterGroup group={group} /> : null}
      {group.kind === "sizes" ? <SizeFilterGroup group={group} /> : null}
      {group.kind === "palette" ? <PaletteFilterGroup group={group} /> : null}
      {group.kind === "chips" ? <ChipFilterGroup group={group} /> : null}
      {group.kind === "checkboxes" ? <CheckboxFilterGroup group={group} /> : null}
      {group.kind === "price" ? <PriceFilterGroup group={group} /> : null}
    </section>
  );
}

function ListFilterGroup({ group }: { group: Extract<AtelierFilterGroup, { kind: "list" }> }) {
  return (
    <ul className="mt-5 space-y-3.5">
      {group.options.map((option) => {
        const activeClassName =
          group.activeStyle === "underline"
            ? "text-primary underline decoration-primary/30 underline-offset-8"
            : group.activeStyle === "bold" || !group.activeStyle
              ? "font-semibold text-primary"
              : "text-primary";

        return (
          <li key={option.label}>
            <button
              type="button"
              aria-pressed={option.active}
              className={cn(
                "flex w-full items-center justify-between gap-4 text-left transition-colors hover:text-primary",
                group.uppercase
                  ? "text-[11px] uppercase tracking-[0.28em] text-[#7a7b76]"
                  : "text-[15px] text-[#6d6d68]",
                option.active ? activeClassName : "",
              )}
            >
              <span>{option.label}</span>
              {group.showCounts && option.count ? (
                <span className="text-[11px] tracking-[0.16em] text-outline">{option.count}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SizeFilterGroup({ group }: { group: Extract<AtelierFilterGroup, { kind: "sizes" }> }) {
  const columnsClassName =
    group.columns === 5 ? "grid-cols-5" : group.columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={cn("mt-5 grid gap-2.5", columnsClassName, group.columns === 2 && "max-w-[11rem]")}>
      {group.options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={option.active}
          className={cn(
            "flex items-center justify-center border text-[12px] font-medium transition-all duration-200 hover:border-primary hover:text-primary",
            group.compact ? "h-10" : "h-11",
            option.active ? "border-primary bg-primary text-white hover:text-white" : "border-black/10 text-[#5d5f5a]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PaletteFilterGroup({ group }: { group: Extract<AtelierFilterGroup, { kind: "palette" }> }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-4">
      {group.options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-label={option.label}
          aria-pressed={option.active}
          className={cn(
            "relative inline-flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-105",
            option.active && "ring-2 ring-primary/18 ring-offset-2 ring-offset-background",
          )}
        >
          <span
            className={cn(
              "block h-6 w-6 rounded-full",
              option.bordered && "border border-black/12",
              option.active && "ring-1 ring-primary/25 ring-inset",
            )}
            style={{ backgroundColor: option.color }}
          />
        </button>
      ))}
    </div>
  );
}

function ChipFilterGroup({ group }: { group: Extract<AtelierFilterGroup, { kind: "chips" }> }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2.5">
      {group.options.map((option) => (
        <button
          key={option}
          type="button"
          className="rounded-full bg-surface-container-high px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-primary transition-colors hover:bg-surface-container-highest"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function CheckboxFilterGroup({ group }: { group: Extract<AtelierFilterGroup, { kind: "checkboxes" }> }) {
  return (
    <div className="mt-5 space-y-3.5">
      {group.options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={option.active}
          className="group flex items-center gap-3 text-left"
        >
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-[2px] border transition-colors",
              option.active ? "border-primary bg-primary" : "border-black/16 bg-transparent group-hover:border-primary",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full bg-white", !option.active && "hidden")} />
          </span>
          <span className="text-[15px] text-[#6d6d68] transition-colors group-hover:text-primary">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function PriceFilterGroup({ group }: { group: Extract<AtelierFilterGroup, { kind: "price" }> }) {
  return (
    <div className="mt-6 max-w-[12rem]">
      <div className="relative h-5">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[#ddd8d0]" />
        <div
          className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-primary"
          style={{ width: `${group.valuePercent}%` }}
        />
        <span
          className="absolute top-1/2 block h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${group.valuePercent}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px] text-[#7f7f79]">
        <span>{group.minLabel}</span>
        <span>{group.maxLabel}</span>
      </div>
    </div>
  );
}

function CatalogToolbar({
  showingLabel,
  sortLabel,
}: {
  showingLabel: string;
  sortLabel: string;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-black/8 pb-5 md:flex-row md:items-end md:justify-between">
      <p className="font-serif text-[15px] italic text-[#b0aca5]">{showingLabel}</p>
      <button
        type="button"
        className="inline-flex items-center gap-1 self-start text-[13px] font-medium uppercase tracking-[0.18em] text-primary transition-colors hover:text-primary-container md:self-auto"
      >
        <span>{sortLabel}</span>
        <ChevronDown className="h-4 w-4 stroke-[1.7]" />
      </button>
    </div>
  );
}

function CatalogGrid({ config }: { config: AtelierPageConfig }) {
  return (
    <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 xl:grid-cols-3">
      {config.products.map((item) =>
        item.type === "feature" ? (
          <FeatureCard key={item.id} item={item} />
        ) : (
          <ProductCard key={item.id} item={item} pageId={config.id} />
        ),
      )}
    </div>
  );
}

function ProductCard({
  item,
  pageId,
}: {
  item: Extract<AtelierCatalogItem, { type: "product" }>;
  pageId: AtelierCategoryId;
}) {
  const splitVariant = item.variant === "split";
  const badgeClassName = item.badge ? badgeToneClasses[item.badge.tone] : "";

  return (
    <article className={cn("group", item.offsetClassName, pageId === "accessories" && "xl:even:translate-y-8")}>
      <Link href={item.href} className="block">
        <div className="relative overflow-hidden rounded-[1.5rem] bg-surface-container-low shadow-[0_24px_52px_-32px_rgba(27,28,25,0.22)]">
          {item.badge ? (
            <span
              className={cn(
                "absolute left-4 top-4 z-10 inline-flex rounded-[999px] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
                badgeClassName,
              )}
            >
              {item.badge.label}
            </span>
          ) : null}

          <div className={cn("relative overflow-hidden", splitVariant ? "aspect-[3/4]" : "aspect-[4/5]")}>
            <StorefrontImage
              alt={item.imageAlt}
              src={item.imageUrl}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
            />
          </div>

          {item.showQuickAction ? (
            <span className="absolute bottom-4 right-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white opacity-100 shadow-lg transition-transform duration-300 group-hover:scale-95 md:opacity-0 md:group-hover:opacity-100">
              <Plus className="h-4 w-4 stroke-[2]" />
            </span>
          ) : null}
        </div>

        {splitVariant ? (
          <div className="mt-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-serif text-[1.28rem] leading-tight tracking-[-0.03em] text-primary">{item.name}</h3>
              <p className="mt-1.5 text-[11px] uppercase tracking-[0.26em] text-outline">{item.meta}</p>
            </div>
            <p className="shrink-0 text-[1rem] font-semibold text-tertiary-container">{item.price}</p>
          </div>
        ) : (
          <div className="space-y-1.5 pt-5">
            <h3 className="font-serif text-[1.85rem] leading-[1.06] tracking-[-0.04em] text-primary">{item.name}</h3>
            <p className="font-serif text-[15px] italic text-[#7b7a73]">{item.meta}</p>
            <p className="pt-2 text-[1.35rem] font-medium tracking-[-0.02em] text-tertiary">{item.price}</p>
          </div>
        )}
      </Link>
    </article>
  );
}

function FeatureCard({ item }: { item: Extract<AtelierCatalogItem, { type: "feature" }> }) {
  return (
    <article
      className={cn(
        "group relative flex min-h-[380px] overflow-hidden rounded-[1.75rem] bg-primary p-8 md:p-10",
        item.spanClassName,
      )}
    >
      <div className="absolute inset-0">
        <StorefrontImage
          alt={item.imageAlt}
          src={item.imageUrl}
          fill
          sizes="(max-width: 768px) 100vw, 66vw"
          className="object-cover opacity-34 transition-transform duration-1000 group-hover:scale-[1.04]"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#061b0e] via-[#061b0e]/72 to-[#061b0e]/26" />

      <div className="relative z-10 mt-auto max-w-[25rem] text-white">
        <h3 className="font-serif text-[2.5rem] leading-[1.02] tracking-[-0.045em] text-white">{item.title}</h3>
        <p className="mt-4 text-base leading-relaxed text-white/82">{item.description}</p>
        <Link
          href={item.href}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.24em] text-primary transition-colors hover:bg-[#e9e5dc]"
        >
          {item.ctaLabel}
          <ArrowUpRight className="h-4 w-4 stroke-[1.8]" />
        </Link>
      </div>
    </article>
  );
}

function AtelierBottomSectionPanel({ section }: { section: AtelierBottomSection }) {
  if (section.kind === "quote-band") {
    return (
      <section className="bg-surface-container-low py-20 md:py-28">
        <div className="shell">
          <div className="mx-auto max-w-4xl text-center">
            <p className="font-serif text-[2.2rem] italic leading-[1.18] tracking-[-0.03em] text-primary md:text-[3.3rem]">
              “{section.quote}”
            </p>
            <div className="mx-auto mt-8 h-px w-24 bg-black/12" />
            <p className="mt-6 text-[11px] uppercase tracking-[0.28em] text-on-surface-variant">{section.attribution}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-surface-container-low py-20 md:py-28">
      <div className="shell">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.78fr)]">
          <article className="group relative min-h-[420px] overflow-hidden rounded-[1.8rem] bg-primary">
            <StorefrontImage
              alt={section.imageAlt}
              src={section.imageUrl}
              fill
              sizes="(max-width: 1024px) 100vw, 66vw"
              className="object-cover opacity-82 grayscale transition-transform duration-1000 group-hover:scale-[1.035]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/72 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 text-white md:bottom-10 md:left-10 md:right-10">
              <h3 className="font-serif text-[2.4rem] leading-[1.05] tracking-[-0.04em]">{section.storyHeading}</h3>
              <p className="mt-4 max-w-[26rem] text-sm leading-relaxed text-[#d9ddd8] md:text-base">
                {section.storyDescription}
              </p>
              <Link
                href={section.storyHref}
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.24em] text-primary transition-colors hover:bg-[#e9e5dc]"
              >
                {section.storyCtaLabel}
                <ArrowUpRight className="h-4 w-4 stroke-[1.8]" />
              </Link>
            </div>
          </article>

          <article className="flex flex-col justify-center rounded-[1.6rem] border border-black/8 bg-background p-8 md:p-10">
            <p className="text-[11px] uppercase tracking-[0.26em] text-tertiary">{section.panelEyebrow}</p>
            <h3 className="mt-4 font-serif text-[2.3rem] leading-[1.06] tracking-[-0.04em] text-primary">
              {section.panelTitle}
            </h3>
            <p className="mt-5 text-sm leading-7 text-on-surface-variant">{section.panelDescription}</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function AtelierFooter({ footerLinks }: { footerLinks: AtelierFooterLink[] }) {
  return (
    <footer className="mt-20 border-t border-black/6 bg-[#f5f3ee]">
      <div className="shell flex flex-col items-center py-16 text-center md:py-20">
        <Link href="/" className="font-serif text-[2rem] italic tracking-[-0.045em] text-primary">
          ND Shop
        </Link>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[11px] uppercase tracking-[0.24em] text-[#686963] transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mt-10 h-px w-full max-w-lg bg-black/8" />
        <p className="mt-10 text-[10px] uppercase tracking-[0.28em] text-[#7b7a73]">
          © 2024 ND Shop. The Digital Atelier.
        </p>
      </div>
    </footer>
  );
}
