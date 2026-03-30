import { useState, type SVGProps } from "react";

import {
  shopFootwearHero,
  shopFootwearHighlight,
  shopFootwearMaterialFilters,
  shopFootwearProducts,
  shopFootwearQuote,
  shopFootwearSizeFilters,
  shopFootwearTypeFilters,
  type ShopFootwearMaterialOption,
  type ShopFootwearProduct,
  type ShopFootwearSizeOption,
  type ShopFootwearTypeOption
} from "./shopFootwearData";
import "./ShopFootwearPage.css";

type IconProps = SVGProps<SVGSVGElement>;

function SparkIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M12 3.5 14 10l6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2 2-6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FootwearHero() {
  return (
    <header className="shop-footwear-hero">
      <div className="shop-footwear-hero-media">
        <img
          alt={shopFootwearHero.imageAlt}
          className="shop-footwear-hero-image"
          loading="eager"
          src={shopFootwearHero.imageUrl}
        />
        <div className="shop-footwear-hero-overlay" />
      </div>

      <div className="shop-footwear-hero-inner">
        <div className="shop-footwear-hero-copy">
          <span className="shop-footwear-hero-kicker">{shopFootwearHero.label}</span>
          <h1 className="shop-footwear-hero-title">{shopFootwearHero.title}</h1>
          <p className="shop-footwear-hero-description">{shopFootwearHero.description}</p>
        </div>
      </div>
    </header>
  );
}

function TypeFilterList({
  items,
  onSelect
}: {
  items: ShopFootwearTypeOption[];
  onSelect: (label: string) => void;
}) {
  return (
    <ul className="shop-footwear-type-list">
      {items.map((item) => (
        <li key={item.label}>
          <button
            aria-pressed={item.active}
            className={item.active ? "shop-footwear-type-button is-active" : "shop-footwear-type-button"}
            type="button"
            onClick={() => onSelect(item.label)}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function SizeFilterGrid({
  items,
  onSelect
}: {
  items: ShopFootwearSizeOption[];
  onSelect: (label: string) => void;
}) {
  return (
    <div className="shop-footwear-size-grid">
      {items.map((item) => (
        <button
          aria-pressed={item.active}
          className={item.active ? "shop-footwear-size-button is-active" : "shop-footwear-size-button"}
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

function MaterialFilterList({
  items,
  onToggle
}: {
  items: ShopFootwearMaterialOption[];
  onToggle: (label: string) => void;
}) {
  return (
    <div className="shop-footwear-material-list">
      {items.map((item) => (
        <label className="shop-footwear-material-item" key={item.label}>
          <input checked={Boolean(item.active)} type="checkbox" onChange={() => onToggle(item.label)} />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
}

function FootwearSidebar() {
  const [types, setTypes] = useState(shopFootwearTypeFilters);
  const [sizes, setSizes] = useState(shopFootwearSizeFilters);
  const [materials, setMaterials] = useState(shopFootwearMaterialFilters);

  function selectType(label: string) {
    setTypes((current) => current.map((item) => ({ ...item, active: item.label === label })));
  }

  function selectSize(label: string) {
    setSizes((current) => current.map((item) => ({ ...item, active: item.label === label })));
  }

  function toggleMaterial(label: string) {
    setMaterials((current) =>
      current.map((item) => (item.label === label ? { ...item, active: !item.active } : item))
    );
  }

  return (
    <aside className="shop-footwear-sidebar" aria-label="Footwear filters">
      <section className="shop-footwear-filter-block">
        <h2 className="shop-footwear-filter-title">Type</h2>
        <TypeFilterList items={types} onSelect={selectType} />
      </section>

      <section className="shop-footwear-filter-block">
        <h2 className="shop-footwear-filter-title">Size</h2>
        <SizeFilterGrid items={sizes} onSelect={selectSize} />
      </section>

      <section className="shop-footwear-filter-block">
        <h2 className="shop-footwear-filter-title">Material</h2>
        <MaterialFilterList items={materials} onToggle={toggleMaterial} />
      </section>
    </aside>
  );
}

function FootwearBadge({ badge }: { badge?: ShopFootwearProduct["badge"] }) {
  if (!badge) {
    return null;
  }

  return (
    <span className={badge.tone === "primary" ? "shop-footwear-badge is-primary" : "shop-footwear-badge is-surface"}>
      {badge.label}
    </span>
  );
}

function FootwearProductCard({ product }: { product: ShopFootwearProduct }) {
  return (
    <article className={product.offset ? "shop-footwear-product-card is-offset" : "shop-footwear-product-card"}>
      <div className="shop-footwear-product-media">
        <img alt={product.imageAlt} className="shop-footwear-product-image" loading="lazy" src={product.imageUrl} />
        <div className="shop-footwear-product-badge-shell">
          <FootwearBadge badge={product.badge} />
        </div>
      </div>

      <div className="shop-footwear-product-copy">
        <h3 className="shop-footwear-product-title">{product.name}</h3>
        <p className="shop-footwear-product-material">{product.material}</p>
        <p className="shop-footwear-product-price">{product.price}</p>
      </div>
    </article>
  );
}

function HeritageHighlight() {
  return (
    <article className="shop-footwear-highlight-card">
      <img
        alt={shopFootwearHighlight.imageAlt}
        className="shop-footwear-highlight-image"
        loading="lazy"
        src={shopFootwearHighlight.imageUrl}
      />
      <div className="shop-footwear-highlight-overlay" />

      <div className="shop-footwear-highlight-copy">
        <h2 className="shop-footwear-highlight-title">{shopFootwearHighlight.title}</h2>
        <p className="shop-footwear-highlight-description">{shopFootwearHighlight.description}</p>
        <button className="shop-footwear-highlight-cta" type="button">
          {shopFootwearHighlight.cta}
        </button>
      </div>
    </article>
  );
}

function FootwearCatalog() {
  return (
    <section className="shop-footwear-catalog">
      <div className="shop-footwear-catalog-layout">
        <FootwearSidebar />

        <div className="shop-footwear-grid">
          {shopFootwearProducts.slice(0, 3).map((product) => (
            <FootwearProductCard key={product.id} product={product} />
          ))}
          {shopFootwearProducts[3] ? <FootwearProductCard product={shopFootwearProducts[3]} /> : null}
          <HeritageHighlight />
        </div>
      </div>
    </section>
  );
}

function QuoteSection() {
  return (
    <section className="shop-footwear-quote-section">
      <div className="shop-footwear-quote-inner">
        <SparkIcon className="shop-footwear-quote-icon" />
        <p className="shop-footwear-quote-text">"{shopFootwearQuote.text}"</p>
        <div className="shop-footwear-quote-divider" />
        <p className="shop-footwear-quote-author">- {shopFootwearQuote.author}</p>
      </div>
    </section>
  );
}

export function ShopFootwearPage() {
  return (
    <div className="shop-footwear-surface">
      <div className="shop-footwear-page">
        <FootwearHero />
        <FootwearCatalog />
        <QuoteSection />
      </div>
    </div>
  );
}
