import { useState, type SVGProps } from "react";

import {
  shopWomenCategoryFilters,
  shopWomenEditorial,
  shopWomenHero,
  shopWomenPaletteFilters,
  shopWomenProducts,
  shopWomenSizeFilters,
  type ShopWomenCategoryOption,
  type ShopWomenPaletteOption,
  type ShopWomenProduct,
  type ShopWomenSizeOption
} from "./shopWomenData";
import "./ShopWomenPage.css";

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

function ArrowLeftIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function ArrowRightIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function PlusIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function WomenHero() {
  return (
    <section className="shop-women-hero">
      <div className="shop-women-hero-overlay" />
      <img
        alt={shopWomenHero.imageAlt}
        className="shop-women-hero-image"
        loading="eager"
        src={shopWomenHero.imageUrl}
      />

      <div className="shop-women-hero-copy">
        <span className="shop-women-hero-pill">{shopWomenHero.label}</span>
        <h1 className="shop-women-hero-title">{shopWomenHero.title}</h1>
        <p className="shop-women-hero-description">{shopWomenHero.description}</p>
      </div>
    </section>
  );
}

function WomenCategoryList({
  items,
  onSelect
}: {
  items: ShopWomenCategoryOption[];
  onSelect: (label: string) => void;
}) {
  return (
    <ul className="shop-women-category-list">
      {items.map((item) => (
        <li key={item.label}>
          <button
            aria-pressed={item.active}
            className={item.active ? "shop-women-category-button is-active" : "shop-women-category-button"}
            type="button"
            onClick={() => onSelect(item.label)}
          >
            <span>{item.label}</span>
            <span className="shop-women-category-count">{item.count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function WomenSizeGrid({
  items,
  onSelect
}: {
  items: ShopWomenSizeOption[];
  onSelect: (label: string) => void;
}) {
  return (
    <div className="shop-women-size-grid">
      {items.map((item) => (
        <button
          aria-pressed={item.active}
          className={item.active ? "shop-women-size-button is-active" : "shop-women-size-button"}
          key={item.label}
          type="button"
          onClick={() => onSelect(item.label)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function WomenPaletteRow({
  items,
  onSelect
}: {
  items: ShopWomenPaletteOption[];
  onSelect: (label: string) => void;
}) {
  return (
    <div className="shop-women-palette-row">
      {items.map((item) => (
        <button
          aria-label={item.label}
          aria-pressed={item.active}
          className={item.active ? "shop-women-palette-swatch is-active" : "shop-women-palette-swatch"}
          key={item.label}
          style={{ backgroundColor: item.color }}
          type="button"
          onClick={() => onSelect(item.label)}
        >
          {item.light ? <span className="shop-women-palette-inner-ring" /> : null}
        </button>
      ))}
    </div>
  );
}

function WomenSidebar() {
  const [categories, setCategories] = useState(shopWomenCategoryFilters);
  const [sizes, setSizes] = useState(shopWomenSizeFilters);
  const [palettes, setPalettes] = useState(shopWomenPaletteFilters);

  function selectCategory(label: string) {
    setCategories((current) => current.map((item) => ({ ...item, active: item.label === label })));
  }

  function selectSize(label: string) {
    setSizes((current) => current.map((item) => ({ ...item, active: item.label === label })));
  }

  function selectPalette(label: string) {
    setPalettes((current) => current.map((item) => ({ ...item, active: item.label === label })));
  }

  return (
    <aside className="shop-women-sidebar" aria-label="Women atelier filters">
      <div className="shop-women-filter-block">
        <h2 className="shop-women-filter-title">Categories</h2>
        <WomenCategoryList items={categories} onSelect={selectCategory} />
      </div>

      <div className="shop-women-filter-block">
        <h2 className="shop-women-filter-title">Size</h2>
        <WomenSizeGrid items={sizes} onSelect={selectSize} />
      </div>

      <div className="shop-women-filter-block">
        <h2 className="shop-women-filter-title">Palette</h2>
        <WomenPaletteRow items={palettes} onSelect={selectPalette} />
      </div>
    </aside>
  );
}

function WomenProductCard({ product }: { product: ShopWomenProduct }) {
  const offsetClass =
    product.offset === "up"
      ? "shop-women-product-card is-raised"
      : product.offset === "down"
        ? "shop-women-product-card is-lowered"
        : "shop-women-product-card";

  return (
    <article className={offsetClass}>
      <div className="shop-women-product-image-shell">
        <img alt={product.imageAlt} className="shop-women-product-image" loading="lazy" src={product.imageUrl} />

        {product.badge ? <span className="shop-women-product-badge">{product.badge.label}</span> : null}

        {product.showQuickAdd ? (
          <button aria-label={`Quick add ${product.name}`} className="shop-women-quick-add" type="button">
            <PlusIcon className="shop-women-quick-add-icon" />
          </button>
        ) : null}
      </div>

      <div className="shop-women-product-meta">
        <div className="shop-women-product-copy">
          <h3 className="shop-women-product-name">{product.name}</h3>
          <p className="shop-women-product-label">{product.categoryLabel}</p>
        </div>
        <span className="shop-women-product-price">{product.price}</span>
      </div>
    </article>
  );
}

function WomenCatalog() {
  return (
    <section className="shop-women-catalog">
      <div className="shop-women-catalog-layout">
        <WomenSidebar />

        <div className="shop-women-catalog-main">
          <div className="shop-women-catalog-toolbar">
            <p className="shop-women-results">Showing 63 pieces</p>
            <button aria-label="Sort products" className="shop-women-sort" type="button">
              <span>Sort By</span>
              <ChevronDownIcon className="shop-women-sort-icon" />
            </button>
          </div>

          <div className="shop-women-product-grid">
            {shopWomenProducts.map((product) => (
              <WomenProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="shop-women-pagination">
            <button aria-label="Previous page" className="shop-women-page-button" type="button">
              <ArrowLeftIcon className="shop-women-page-icon" />
            </button>
            <span className="shop-women-page-indicator">Page 01 of 04</span>
            <button aria-label="Next page" className="shop-women-page-button is-primary" type="button">
              <ArrowRightIcon className="shop-women-page-icon" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function WomenEditorialSection() {
  const titleLines = shopWomenEditorial.title.split("\n");

  return (
    <section className="shop-women-editorial">
      <div className="shop-women-editorial-grid">
        <article className="shop-women-editorial-feature">
          <img
            alt={shopWomenEditorial.featureImageAlt}
            className="shop-women-editorial-image"
            loading="lazy"
            src={shopWomenEditorial.featureImageUrl}
          />
          <div className="shop-women-editorial-gradient" />

          <div className="shop-women-editorial-feature-copy">
            <h2 className="shop-women-editorial-feature-title">{shopWomenEditorial.featureTitle}</h2>
            <p className="shop-women-editorial-feature-description">{shopWomenEditorial.featureDescription}</p>
            <button className="shop-women-editorial-cta" type="button">
              {shopWomenEditorial.featureCta}
            </button>
          </div>
        </article>

        <article className="shop-women-editorial-card">
          <span className="shop-women-editorial-label">{shopWomenEditorial.label}</span>
          <h2 className="shop-women-editorial-title">
            {titleLines.map((line, index) => (
              <span key={line}>
                {line}
                {index < titleLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </h2>
          <p className="shop-women-editorial-description">{shopWomenEditorial.description}</p>
        </article>
      </div>
    </section>
  );
}

export function ShopWomenPage() {
  return (
    <div className="shop-women-surface">
      <div className="shop-women-page">
        <WomenHero />
        <WomenCatalog />
        <WomenEditorialSection />
      </div>
    </div>
  );
}
