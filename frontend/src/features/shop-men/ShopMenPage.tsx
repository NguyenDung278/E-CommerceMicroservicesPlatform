import { useState, type ReactNode, type SVGProps } from "react";

import {
  shopMenCategoryFilters,
  shopMenHeroImage,
  shopMenProducts,
  shopMenSizeFilters,
  type ShopMenFilterOption,
  type ShopMenProduct
} from "./shopMenData";

type IconProps = SVGProps<SVGSVGElement>;

function ChevronDownIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="m7 10 5 5 5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function EditorialSurface({ children }: { children: ReactNode }) {
  return <div className="bg-nd-surface font-body text-nd-ink">{children}</div>;
}

function EditorialHero() {
  return (
    <section className="relative flex min-h-[420px] items-end overflow-hidden sm:min-h-[450px] lg:min-h-[500px]">
      <img
        alt="Close-up of high-quality dark wool fabric texture with subtle lighting highlighting the weave of a tailored suit"
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        src={shopMenHeroImage}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,27,14,0.12)_0%,rgba(6,27,14,0.22)_28%,rgba(6,27,14,0.62)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,27,14,0.8)_0%,rgba(6,27,14,0.46)_34%,rgba(6,27,14,0.1)_62%,rgba(6,27,14,0)_100%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-screen-2xl px-5 py-16 md:px-6 lg:px-8 xl:px-12">
        <div className="max-w-[620px]">
          <span className="mb-5 inline-flex items-center rounded-full border border-white/20 bg-[#5b617d]/90 px-[10px] py-[5px] text-[9px] font-semibold uppercase tracking-[0.22em] text-white">
            DEV ONLY
          </span>
          <h1 className="font-display text-[3.25rem] leading-[0.94] tracking-[-0.06em] text-white sm:text-[4.3rem] lg:text-[5rem]">
            Men&apos;s Atelier
          </h1>
          <p className="mt-5 max-w-[510px] font-display text-[1.05rem] italic leading-[1.26] text-white/95 sm:text-[1.28rem]">
            An architectural study in silhouette and structure. Crafted for the modern artisan.
          </p>
        </div>
      </div>
    </section>
  );
}

function FilterHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-6 text-[11px] font-medium uppercase tracking-[0.28em] text-[#1b1c19]">{children}</h2>;
}

function FilterList({
  options,
  onSelect
}: {
  options: ShopMenFilterOption[];
  onSelect: (label: string) => void;
}) {
  return (
    <ul className="space-y-4">
      {options.map((option) => (
        <li key={option.label}>
          <button
            className={
              option.active
                ? "w-full text-left text-[14px] font-medium text-[#1b1c19]"
                : "w-full text-left text-[14px] text-stone-500 transition-colors hover:text-nd-forest"
            }
            type="button"
            onClick={() => onSelect(option.label)}
          >
            {option.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function SizeGrid({
  options,
  onSelect
}: {
  options: ShopMenFilterOption[];
  onSelect: (label: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-[8px]">
      {options.map((option) => (
        <button
          className={
            option.active
              ? "border border-nd-forest bg-nd-forest px-4 py-[10px] text-[13px] text-white transition-all"
              : "border border-black/10 px-4 py-[10px] text-[13px] text-nd-ink transition-all hover:border-nd-forest"
          }
          key={option.label}
          type="button"
          onClick={() => onSelect(option.label)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function EditorialSidebar() {
  const [categories, setCategories] = useState(shopMenCategoryFilters);
  const [sizes, setSizes] = useState(shopMenSizeFilters);
  const [priceValue, setPriceValue] = useState(650);

  function selectCategory(label: string) {
    setCategories((current) => current.map((item) => ({ ...item, active: item.label === label })));
  }

  function selectSize(label: string) {
    setSizes((current) => current.map((item) => ({ ...item, active: item.label === label })));
  }

  return (
    <aside className="max-w-[160px] space-y-[42px]">
      <section>
        <FilterHeading>Category</FilterHeading>
        <FilterList onSelect={selectCategory} options={categories} />
      </section>

      <section>
        <FilterHeading>Size</FilterHeading>
        <SizeGrid onSelect={selectSize} options={sizes} />
      </section>

      <section>
        <FilterHeading>Price Range</FilterHeading>
        <input
          className="h-1 w-full cursor-pointer appearance-none rounded-full border-none bg-[#e4e2dd] focus:outline-none focus:ring-0"
          max={2500}
          min={150}
          step={50}
          type="range"
          value={priceValue}
          style={{ accentColor: "#061b0e" }}
          onChange={(event) => setPriceValue(Number.parseInt(event.target.value, 10))}
        />
        <div className="mt-3 flex justify-between text-[11px] font-medium text-stone-500">
          <span>$150</span>
          <span>$2,500</span>
        </div>
      </section>
    </aside>
  );
}

function ProductBadge({ badge }: { badge: ShopMenProduct["badge"] }) {
  if (!badge) {
    return null;
  }

  const badgeClasses = badge.tone === "accent" ? "bg-[#d07d63] text-white" : "bg-nd-forest text-white";

  return (
    <div className="absolute left-4 top-4">
      <span className={`px-3 py-[5px] text-[9px] font-semibold uppercase tracking-[0.18em] ${badgeClasses}`}>
        {badge.label}
      </span>
    </div>
  );
}

function ProductCard({ product }: { product: ShopMenProduct }) {
  return (
    <article className="group cursor-pointer">
      <div className="relative mb-4 aspect-[3/4] overflow-hidden bg-nd-low">
        <img
          alt={product.imageAlt}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
          loading="lazy"
          src={product.imageUrl}
        />
        <ProductBadge badge={product.badge} />
      </div>

      <div className="space-y-1">
        <h3 className="font-display text-[1.08rem] font-normal leading-[1.22] tracking-[-0.02em] text-[#1b1c19] sm:text-[1.15rem]">
          {product.name}
        </h3>
        <p className="text-[12px] italic text-stone-500">{product.material}</p>
        <p className="pt-[6px] text-[1.02rem] font-normal text-[#d06f53]">{product.price}</p>
      </div>
    </article>
  );
}

function ProductSection() {
  return (
    <section className="min-w-0">
      <div className="mb-12 flex items-start justify-between gap-4">
        <div className="pt-[2px] text-[13px] italic text-stone-400">Showing 12 results</div>
        <button className="flex items-center gap-1.5 text-[13px] font-medium text-[#1b1c19]" type="button">
          <span>Sort by: Relevance</span>
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 min-[820px]:grid-cols-3 xl:gap-x-10 xl:gap-y-20">
        {shopMenProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

export function ShopMenPage() {
  return (
    <EditorialSurface>
      <EditorialHero />

      <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-12 px-5 py-12 md:px-6 min-[820px]:grid-cols-[160px_minmax(0,1fr)] min-[820px]:gap-[42px] lg:px-8 lg:py-16 xl:px-12">
        <EditorialSidebar />
        <ProductSection />
      </div>
    </EditorialSurface>
  );
}
