import { useState } from "react";

import {
  shopAccessoriesCategories,
  shopAccessoriesHero,
  shopAccessoriesMaterials,
  shopAccessoriesProducts,
  shopAccessoriesQuoteCard,
  type ShopAccessoriesCategoryOption,
  type ShopAccessoriesMaterialTag,
  type ShopAccessoriesProduct
} from "./shopAccessoriesData";
import "./ShopAccessoriesPage.css";

function AccessoriesHero() {
  return (
    <header className="shop-accessories-hero">
      <div className="shop-accessories-hero-media">
        <img
          alt={shopAccessoriesHero.imageAlt}
          className="shop-accessories-hero-image"
          loading="eager"
          src={shopAccessoriesHero.imageUrl}
        />
        <div className="shop-accessories-hero-overlay" />
      </div>

      <div className="shop-accessories-hero-copy">
        <h1 className="shop-accessories-hero-title">
          {shopAccessoriesHero.title}
          <br />
          <span>{shopAccessoriesHero.emphasis}</span>
        </h1>
        <p className="shop-accessories-hero-description">{shopAccessoriesHero.description}</p>
      </div>
    </header>
  );
}

function CategoryList({
  items,
  onSelect
}: {
  items: ShopAccessoriesCategoryOption[];
  onSelect: (label: string) => void;
}) {
  return (
    <ul className="shop-accessories-category-list">
      {items.map((item) => (
        <li key={item.label}>
          <button
            aria-pressed={item.active}
            className={item.active ? "shop-accessories-category-button is-active" : "shop-accessories-category-button"}
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

function MaterialChips({
  items,
  onToggle
}: {
  items: ShopAccessoriesMaterialTag[];
  onToggle: (label: string) => void;
}) {
  return (
    <div className="shop-accessories-materials">
      {items.map((item) => (
        <button
          aria-pressed={item.active}
          className={item.active ? "shop-accessories-material-chip is-active" : "shop-accessories-material-chip"}
          key={item.label}
          type="button"
          onClick={() => onToggle(item.label)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function AccessoriesSidebar() {
  const [categories, setCategories] = useState(shopAccessoriesCategories);
  const [materials, setMaterials] = useState(shopAccessoriesMaterials);

  function selectCategory(label: string) {
    setCategories((current) => current.map((item) => ({ ...item, active: item.label === label })));
  }

  function toggleMaterial(label: string) {
    setMaterials((current) =>
      current.map((item) => (item.label === label ? { ...item, active: !item.active } : item))
    );
  }

  return (
    <aside className="shop-accessories-sidebar" aria-label="Accessories filters">
      <section className="shop-accessories-filter-block">
        <h2 className="shop-accessories-filter-title">Category</h2>
        <CategoryList items={categories} onSelect={selectCategory} />
      </section>

      <section className="shop-accessories-filter-block">
        <h2 className="shop-accessories-filter-title">Material</h2>
        <MaterialChips items={materials} onToggle={toggleMaterial} />
      </section>

      <section className="shop-accessories-quote-card">
        <p>{shopAccessoriesQuoteCard.text}</p>
        <span>{shopAccessoriesQuoteCard.author}</span>
      </section>
    </aside>
  );
}

function ProductBadge({ badge }: { badge?: ShopAccessoriesProduct["badge"] }) {
  if (!badge) {
    return null;
  }

  return (
    <span className={badge.tone === "accent" ? "shop-accessories-badge is-accent" : "shop-accessories-badge is-primary"}>
      {badge.label}
    </span>
  );
}

function AccessoriesProductCard({ product }: { product: ShopAccessoriesProduct }) {
  return (
    <article className={product.offset ? "shop-accessories-product-card is-offset" : "shop-accessories-product-card"}>
      <div className="shop-accessories-product-media">
        <img alt={product.imageAlt} className="shop-accessories-product-image" loading="lazy" src={product.imageUrl} />
        {product.badge ? <div className="shop-accessories-product-badge-shell"><ProductBadge badge={product.badge} /></div> : null}
      </div>

      <div className="shop-accessories-product-copy">
        <h3 className="shop-accessories-product-title">{product.name}</h3>
        <p className="shop-accessories-product-material">{product.material}</p>
        <p className="shop-accessories-product-price">{product.price}</p>
      </div>
    </article>
  );
}

function AccessoriesCatalog() {
  return (
    <section className="shop-accessories-catalog">
      <div className="shop-accessories-layout">
        <AccessoriesSidebar />

        <div className="shop-accessories-grid">
          {shopAccessoriesProducts.map((product) => (
            <AccessoriesProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ShopAccessoriesPage() {
  return (
    <div className="shop-accessories-surface">
      <div className="shop-accessories-page">
        <AccessoriesHero />
        <AccessoriesCatalog />
      </div>
    </div>
  );
}
