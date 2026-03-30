import { useState, type ReactNode, type SVGProps } from "react";

import {
  shopMenCategoryFilters,
  shopMenProducts,
  shopMenSizeFilters,
  type ShopMenFilterOption,
  type ShopMenProduct
} from "./shopMenData";
import "./ShopMenPage.css";

type IconProps = SVGProps<SVGSVGElement>;

const MIN_PRICE = 150;
const MAX_PRICE = 2500;

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

function FilterHeading({ children }: { children: ReactNode }) {
  return <h2 className="shop-men-filter-heading">{children}</h2>;
}

function FilterList({
  options,
  onSelect
}: {
  options: ShopMenFilterOption[];
  onSelect: (label: string) => void;
}) {
  return (
    <ul className="shop-men-filter-list">
      {options.map((option) => (
        <li key={option.label}>
          <button
            aria-pressed={option.active}
            className={option.active ? "shop-men-filter-button shop-men-filter-button-active" : "shop-men-filter-button"}
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
    <div className="shop-men-size-grid">
      {options.map((option) => (
        <button
          aria-pressed={option.active}
          className={option.active ? "shop-men-size-button shop-men-size-button-active" : "shop-men-size-button"}
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
  const priceProgress = ((priceValue - MIN_PRICE) / (MAX_PRICE - MIN_PRICE)) * 100;

  function selectCategory(label: string) {
    setCategories((current) => current.map((item) => ({ ...item, active: item.label === label })));
  }

  function selectSize(label: string) {
    setSizes((current) => current.map((item) => ({ ...item, active: item.label === label })));
  }

  return (
    <aside aria-label="Category filters" className="shop-men-sidebar">
      <section className="shop-men-sidebar-section">
        <FilterHeading>Category</FilterHeading>
        <FilterList onSelect={selectCategory} options={categories} />
      </section>

      <section className="shop-men-sidebar-section">
        <FilterHeading>Size</FilterHeading>
        <SizeGrid onSelect={selectSize} options={sizes} />
      </section>

      <section className="shop-men-sidebar-section">
        <FilterHeading>Price Range</FilterHeading>
        <div className="shop-men-range-shell">
          <input
            aria-label="Price range"
            className="shop-men-range"
            max={MAX_PRICE}
            min={MIN_PRICE}
            step={50}
            style={{
              background: `linear-gradient(90deg, #061b0e 0%, #061b0e ${priceProgress}%, #ddd8d1 ${priceProgress}%, #ddd8d1 100%)`
            }}
            type="range"
            value={priceValue}
            onChange={(event) => setPriceValue(Number.parseInt(event.target.value, 10))}
          />
          <div className="shop-men-range-values">
            <span>$150</span>
            <span>$2,500</span>
          </div>
        </div>
      </section>
    </aside>
  );
}

function ProductBadge({ badge }: { badge: ShopMenProduct["badge"] }) {
  if (!badge) {
    return null;
  }

  return (
    <div className="shop-men-product-badge">
      <span className={badge.tone === "accent" ? "shop-men-badge shop-men-badge-accent" : "shop-men-badge shop-men-badge-forest"}>
        {badge.label}
      </span>
    </div>
  );
}

function ProductCard({ product }: { product: ShopMenProduct }) {
  return (
    <article className="shop-men-product-card">
      <div className="shop-men-product-image-shell">
        <img alt={product.imageAlt} className="shop-men-product-image" loading="lazy" src={product.imageUrl} />
        <ProductBadge badge={product.badge} />
      </div>

      <div className="shop-men-product-copy">
        <h3 className="shop-men-product-title">{product.name}</h3>
        <p className="shop-men-product-material">{product.material}</p>
        <p className="shop-men-product-price">{product.price}</p>
      </div>
    </article>
  );
}

function ProductSection() {
  return (
    <section className="shop-men-products">
      <div className="shop-men-toolbar">
        <div className="shop-men-results-count">Showing 12 results</div>
        <button aria-label="Sort products by relevance" className="shop-men-sort-button" type="button">
          <span>Sort by: Relevance</span>
          <ChevronDownIcon className="shop-men-sort-icon" />
        </button>
      </div>

      <div className="shop-men-grid">
        {shopMenProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

export function ShopMenPage() {
  return (
    <div className="shop-men-surface">
      <div className="shop-men-page">
        <div className="shop-men-layout">
          <EditorialSidebar />
          <ProductSection />
        </div>
      </div>
    </div>
  );
}
