import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  resolveHomeWorkbookProductHref,
  type HomeWorkbookProduct,
  type HomeWorkbookSegment,
} from "@/features/home/home-workbook";
import { EditorialSignatureFooter, StorefrontActionLink } from "@/components";
import { loadWorkbookLiveProductLookup } from "@/features/home/workbook-live-products";
import { useHomeWorkbook } from "@/features/home/use-home-workbook";
import { resolveStorefrontCopy } from "@/features/storefront/storefront-copy";
import { StorefrontOverlayHeader } from "@/components/navigation/storefront-overlay-header";
import { api } from "@/services/api";
import type { JsonValue, Product, StorefrontHomeData } from "@/types/api";
import { formatCurrency } from "@/utils/format";
import "@/styles/pages/storefront/home-page.css";

const fallbackHeroImage =
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1800&q=80";
const fallbackTileImage =
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80";
const fallbackCalloutImage =
  "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=1400&q=80";
const highPriorityImageAttribute = { fetchpriority: "high" } as Record<string, string>;

function buildPageStyle(segment: HomeWorkbookSegment | null): CSSProperties {
  return {
    "--home-stitch-accent": segment?.hero.accent || "#946246",
  } as CSSProperties;
}

function buildTileHref(segment: HomeWorkbookSegment | null, href: string) {
  return href.trim() || segment?.href || "/products";
}

function buildProductHref(product: HomeWorkbookProduct) {
  return resolveHomeWorkbookProductHref({
    productId: product.productId,
    productName: product.name,
    href: product.href,
    fallbackHref: "/products",
  });
}

function buildProductLookupKey(product: HomeWorkbookProduct) {
  return product.productId || `${product.segmentSlug}-${product.position}-${product.name}`;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="home-stitch-empty-card">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

export function HomePage() {
  const productRailRef = useRef<HTMLDivElement | null>(null);
  const { content, error } = useHomeWorkbook();
  const [storefrontHome, setStorefrontHome] = useState<StorefrontHomeData | null>(null);
  const [storefrontError, setStorefrontError] = useState("");

  const navItems = useMemo(() => content?.navItems ?? [], [content?.navItems]);
  const segments = useMemo(() => content?.segments ?? [], [content?.segments]);
  const [activeSegmentSlug, setActiveSegmentSlug] = useState("");
  const [liveArrivalProducts, setLiveArrivalProducts] = useState<Record<string, Product>>({});

  useEffect(() => {
    let active = true;

    void api
      .getStorefrontHome(4)
      .then((response) => {
        if (!active) {
          return;
        }

        if (response.data.category_pages.length > 0) {
          setStorefrontHome(response.data);
          setStorefrontError("");
        }
      })
      .catch((reason) => {
        if (active) {
          setStorefrontError(reason instanceof Error ? reason.message : "");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const defaultSegmentSlug =
      navItems.find((item) => item.isDefault)?.slug ?? segments[0]?.slug ?? "";

    if (!segments.some((segment) => segment.slug === activeSegmentSlug)) {
      startTransition(() => {
        setActiveSegmentSlug(defaultSegmentSlug);
      });
    }
  }, [activeSegmentSlug, navItems, segments]);

  const activeSegment = useMemo(
    () =>
      segments.find((segment) => segment.slug === activeSegmentSlug) ??
      segments.find((segment) => segment.isDefault) ??
      segments[0] ??
      null,
    [activeSegmentSlug, segments]
  );

  const activeTiles = useMemo(() => activeSegment?.tiles.slice(0, 4) ?? [], [activeSegment]);
  const activeMetrics = useMemo(() => activeSegment?.metrics.slice(0, 4) ?? [], [activeSegment]);
  const activeProducts = useMemo(() => activeSegment?.products.slice(0, 8) ?? [], [activeSegment]);
  const footerLinks = content?.footerLinks ?? [];
  const footerNoteFallback =
    "An editorial storefront shaped for clear browsing, product discovery, and quick returns.";
  const footer = content?.footer ?? {
    brandName: "ND Shop",
    caption: "Crafted for the Discerning",
    note: footerNoteFallback,
  };
  const pageStyle = buildPageStyle(activeSegment);

  useEffect(() => {
    let active = true;

    if (activeProducts.length === 0) {
      setLiveArrivalProducts({});
      return () => {
        active = false;
      };
    }

    async function hydrateArrivalProducts() {
      const nextLookup = await loadWorkbookLiveProductLookup({
        entries: activeProducts.map((product) => ({
          lookupKey: buildProductLookupKey(product),
          productId: product.productId,
          name: product.name,
          brand: product.brand,
          categoryLabel: activeSegment?.label,
          href: product.href || activeSegment?.href || "/products",
        })),
      });

      if (active) {
        setLiveArrivalProducts(nextLookup);
      }
    }

    void hydrateArrivalProducts().catch(() => {
      if (active) {
        setLiveArrivalProducts({});
      }
    });

    return () => {
      active = false;
    };
  }, [activeProducts, activeSegment?.href, activeSegment?.label]);

  function scrollProductRail(direction: "prev" | "next") {
    const rail = productRailRef.current;
    if (!rail) {
      return;
    }

    const distance = Math.max(rail.clientWidth * 0.82, 280);
    rail.scrollBy({
      left: direction === "prev" ? -distance : distance,
      behavior: "smooth",
    });
  }

  if (storefrontHome?.category_pages.length) {
    return <ApiFirstHomePage feedback={storefrontError} homeData={storefrontHome} />;
  }

  return (
    <div className="home-stitch-page" style={pageStyle}>
      {error ? <div className="feedback feedback-info home-stitch-feedback">{error}</div> : null}

      <section className="home-stitch-hero">
        <img
          alt={activeSegment?.hero.title || "Workbook hero"}
          className="home-stitch-hero-image"
          decoding="async"
          src={activeSegment?.hero.backgroundImage || fallbackHeroImage}
          {...highPriorityImageAttribute}
        />
        <div className="home-stitch-hero-scrim" />

        <div className="home-stitch-hero-inner">
          <StorefrontOverlayHeader />

          <div className="home-stitch-hero-grid">
            <div className="home-stitch-hero-copy">
              <span className="home-stitch-kicker">
                {activeSegment?.hero.collectionKicker || "Seasonal Edit"}
              </span>
              <h1>{activeSegment?.hero.title || "Forest & Hearth"}</h1>
              <p>
                {resolveStorefrontCopy(
                  activeSegment?.hero.description,
                  "Seasonal layers, refined essentials, and considered accessories gathered in one calm edit."
                )}
              </p>

              <div className="home-stitch-action-row">
                <StorefrontActionLink
                  className="home-stitch-primary-button"
                  fallbackHref={activeSegment?.href || "/products"}
                  href={activeSegment?.hero.primaryCtaHref || "/products"}
                >
                  {activeSegment?.hero.primaryCtaLabel || "Explore Collection"}
                </StorefrontActionLink>
                <StorefrontActionLink
                  className="home-stitch-secondary-button"
                  fallbackHref={activeSegment?.href || "/products"}
                  href={activeSegment?.hero.secondaryCtaHref || activeSegment?.href || "/products"}
                >
                  {activeSegment?.hero.secondaryCtaLabel || "View Lookbook"}
                </StorefrontActionLink>
              </div>
            </div>

            <aside className="home-stitch-quote-card">
              <span>{activeSegment?.hero.quoteKicker || "Editorial Note"}</span>
              <p>
                {resolveStorefrontCopy(
                  activeSegment?.hero.quoteBody,
                  "New arrivals, updated imagery, and quieter storytelling stay aligned across the storefront."
                )}
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="home-stitch-bento-section">
        {activeTiles.length > 0 ? (
          <div className="home-stitch-bento-grid">
            {activeTiles.map((tile, index) => (
              <StorefrontActionLink
                className={`home-stitch-bento-card home-stitch-bento-card-${index + 1}`}
                fallbackHref={activeSegment?.href || "/products"}
                href={buildTileHref(activeSegment, tile.ctaHref)}
                key={`${tile.segmentSlug}-${tile.position}-${tile.title}`}
              >
                <img
                  alt={tile.title}
                  decoding="async"
                  loading="lazy"
                  src={tile.imageUrl || fallbackTileImage}
                />
                <div className="home-stitch-bento-scrim" />
                <div className="home-stitch-bento-copy">
                  <span>{tile.eyebrow || activeSegment?.label}</span>
                  <h2>{tile.title}</h2>
                  <p>{tile.subtitle}</p>
                  <strong>{tile.ctaLabel || "Explore"}</strong>
                </div>
              </StorefrontActionLink>
            ))}
          </div>
        ) : (
          <EmptyState
            body="Editorial highlights for this collection will appear here as soon as they are ready."
            title="This collection has no spotlight cards yet."
          />
        )}
      </section>

      <section className="home-stitch-callout-section">
        <div className="home-stitch-callout-copy">
          <span className="home-stitch-section-label">
            {activeSegment?.callout?.eyebrow || "Collection Focus"}
          </span>
          <h2>{activeSegment?.callout?.title || "Digital Precision, Analogue Soul."}</h2>
          <p>
            {resolveStorefrontCopy(
              activeSegment?.callout?.body,
              "Seasonal stories, collection highlights, and product imagery stay aligned across the storefront."
            )}
          </p>

          {activeMetrics.length > 0 ? (
            <div className="home-stitch-metric-row">
              {activeMetrics.map((metric) => (
                <article
                  className="home-stitch-metric-card"
                  key={`${metric.segmentSlug}-${metric.position}-${metric.label}`}
                >
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <div className="home-stitch-callout-media">
          <img
            alt={activeSegment?.callout?.title || "Editorial callout"}
            decoding="async"
            loading="lazy"
            src={activeSegment?.callout?.imageUrl || fallbackCalloutImage}
          />
        </div>
      </section>

      <section className="home-stitch-arrivals-section">
        <div className="home-stitch-arrivals-head">
          <div>
            <span className="home-stitch-section-label">
              {activeSegment?.hero.arrivalsKicker || "New Arrivals"}
            </span>
            <h2>{activeSegment?.hero.arrivalsTitle || "Seasonal Essentials"}</h2>
          </div>

          <div className="home-stitch-arrivals-controls">
            <button
              aria-label="Scroll arrivals left"
              className="home-stitch-rail-button"
              onClick={() => scrollProductRail("prev")}
              type="button"
            >
              Prev
            </button>
            <button
              aria-label="Scroll arrivals right"
              className="home-stitch-rail-button"
              onClick={() => scrollProductRail("next")}
              type="button"
            >
              Next
            </button>
          </div>
        </div>

        {activeProducts.length > 0 ? (
          <div className="home-stitch-product-rail" ref={productRailRef}>
            {activeProducts.map((product) => {
              const liveProduct = liveArrivalProducts[buildProductLookupKey(product)];
              const imageSrc =
                liveProduct?.image_urls[0] || liveProduct?.image_url || product.imageUrl;
              const productHref = liveProduct
                ? `/products/${encodeURIComponent(liveProduct.id)}`
                : buildProductHref(product);

              return (
                <StorefrontActionLink
                  className="home-stitch-product-card"
                  fallbackHref="/products"
                  href={productHref}
                  key={`${product.segmentSlug}-${product.position}-${product.name}`}
                >
                  <div className="home-stitch-product-media">
                    <img
                      alt={liveProduct?.name || product.name}
                      decoding="async"
                      loading="lazy"
                      src={imageSrc || fallbackTileImage}
                    />
                  </div>
                  <div className="home-stitch-product-copy">
                    <p>{product.eyebrow || liveProduct?.brand || product.brand || activeSegment?.label}</p>
                    <h3>{liveProduct?.name ?? product.name}</h3>
                    <div className="home-stitch-product-meta">
                      <span>{product.sizeTag || liveProduct?.brand || product.brand || "Archive edit"}</span>
                      <span>{formatCurrency(liveProduct?.price ?? product.price)}</span>
                    </div>
                    <small>{product.fitNote || "A considered piece selected for the current edit."}</small>
                  </div>
                </StorefrontActionLink>
              );
            })}
          </div>
        ) : (
          <EmptyState
            body="Products for this collection will appear here as soon as they are ready."
            title="This collection has no arrivals yet."
          />
        )}
      </section>

      <EditorialSignatureFooter
        brandName={footer.brandName}
        caption={footer.caption}
        links={footerLinks}
        note={resolveStorefrontCopy(footer.note, footerNoteFallback)}
      />
    </div>
  );
}

function ApiFirstHomePage({
  homeData,
  feedback,
}: {
  homeData: StorefrontHomeData;
  feedback: string;
}) {
  const heroPage = homeData.category_pages[0];
  const heroCategory = heroPage?.category;
  const heroProduct = heroPage?.featured_products[0]?.product;
  const heroRecord = asJsonRecord(heroCategory?.hero);
  const railProducts = homeData.category_pages
    .flatMap((page) => page.featured_products.map((item) => item.product))
    .filter((product, index, collection) => collection.findIndex((item) => item.id === product.id) === index)
    .slice(0, 8);

  return (
    <div className="home-stitch-page">
      {feedback ? <div className="feedback feedback-info home-stitch-feedback">{feedback}</div> : null}

      <section className="home-stitch-hero">
        <img
          alt={readJsonString(heroRecord, "title", "hero_title") || heroCategory?.display_name || "Storefront hero"}
          className="home-stitch-hero-image"
          decoding="async"
          src={
            readJsonString(heroRecord, "background_image", "backgroundImage", "image_url") ||
            heroProduct?.image_urls[0] ||
            heroProduct?.image_url ||
            fallbackHeroImage
          }
          {...highPriorityImageAttribute}
        />
        <div className="home-stitch-hero-scrim" />

        <div className="home-stitch-hero-inner">
          <StorefrontOverlayHeader />

          <div className="home-stitch-hero-grid">
            <div className="home-stitch-hero-copy">
              <span className="home-stitch-kicker">
                {readJsonString(heroRecord, "eyebrow", "collection_kicker") ||
                  heroCategory?.nav_label ||
                  "Storefront Edit"}
              </span>
              <h1>{readJsonString(heroRecord, "title", "hero_title") || heroCategory?.display_name}</h1>
              <p>
                {resolveStorefrontCopy(
                  readJsonString(heroRecord, "description", "hero_description"),
                  "Category-led storytelling and live catalog data now come from the storefront API first."
                )}
              </p>

              <div className="home-stitch-action-row">
                <StorefrontActionLink
                  className="home-stitch-primary-button"
                  fallbackHref="/products"
                  href={`/categories/${encodeURIComponent(heroCategory?.slug || heroCategory?.display_name || "products")}`}
                >
                  Explore {heroCategory?.display_name || "Collection"}
                </StorefrontActionLink>
                <StorefrontActionLink
                  className="home-stitch-secondary-button"
                  fallbackHref="/products"
                  href={heroProduct ? `/products/${encodeURIComponent(heroProduct.id)}` : "/products"}
                >
                  Shop Featured Look
                </StorefrontActionLink>
              </div>
            </div>

            <aside className="home-stitch-quote-card">
              <span>{heroCategory?.nav_label || "Editorial Note"}</span>
              <p>
                {heroProduct?.description ||
                  "The storefront home now hydrates directly from public category and featured-product APIs."}
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="home-stitch-bento-section">
        <div className="home-stitch-bento-grid">
          {homeData.category_pages.slice(0, 4).map((page, index) => {
            const pageHero = asJsonRecord(page.category.hero);
            const tileProduct = page.featured_products[0]?.product;
            return (
              <StorefrontActionLink
                className={`home-stitch-bento-card home-stitch-bento-card-${index + 1}`}
                fallbackHref="/products"
                href={`/categories/${encodeURIComponent(page.category.slug || page.category.display_name)}`}
                key={page.category.slug}
              >
                <img
                  alt={page.category.display_name}
                  decoding="async"
                  loading="lazy"
                  src={
                    readJsonString(pageHero, "background_image", "image_url") ||
                    tileProduct?.image_urls[0] ||
                    tileProduct?.image_url ||
                    fallbackTileImage
                  }
                />
                <div className="home-stitch-bento-scrim" />
                <div className="home-stitch-bento-copy">
                  <span>{page.category.nav_label}</span>
                  <h2>{page.category.display_name}</h2>
                  <p>
                    {resolveStorefrontCopy(
                      readJsonString(pageHero, "description", "hero_description"),
                      tileProduct?.description || "Live category storytelling from the storefront API."
                    )}
                  </p>
                  <strong>Open collection</strong>
                </div>
              </StorefrontActionLink>
            );
          })}
        </div>
      </section>

      <section className="home-stitch-callout-section">
        <div className="home-stitch-callout-copy">
          <span className="home-stitch-section-label">API-First Storefront</span>
          <h2>Editorial direction, live inventory, one public contract.</h2>
          <p>
            Featured products, category hero assets, and merchandising order now flow from the
            storefront service instead of workbook-only composition.
          </p>
        </div>

        <div className="home-stitch-callout-media">
          <img
            alt={heroProduct?.name || "Storefront highlight"}
            decoding="async"
            loading="lazy"
            src={heroProduct?.image_urls[0] || heroProduct?.image_url || fallbackCalloutImage}
          />
        </div>
      </section>

      <section className="home-stitch-arrivals-section">
        <div className="home-stitch-arrivals-head">
          <div>
            <span className="home-stitch-section-label">Featured Across Categories</span>
            <h2>Live storefront picks</h2>
          </div>
        </div>

        <div className="home-stitch-product-rail">
          {railProducts.map((product) => (
            <StorefrontActionLink
              className="home-stitch-product-card"
              fallbackHref="/products"
              href={`/products/${encodeURIComponent(product.id)}`}
              key={product.id}
            >
              <div className="home-stitch-product-media">
                <img
                  alt={product.name}
                  decoding="async"
                  loading="lazy"
                  src={product.image_urls[0] || product.image_url || fallbackTileImage}
                />
              </div>
              <div className="home-stitch-product-copy">
                <p>{product.brand || product.category || "Storefront pick"}</p>
                <h3>{product.name}</h3>
                <div className="home-stitch-product-meta">
                  <span>{product.category || "Live catalog"}</span>
                  <span>{formatCurrency(product.price)}</span>
                </div>
                <small>
                  {product.description || "Hydrated from storefront featured products and live catalog records."}
                </small>
              </div>
            </StorefrontActionLink>
          ))}
        </div>
      </section>

      <EditorialSignatureFooter
        brandName="ND Shop"
        caption="Crafted for the Discerning"
        links={homeData.categories.map((category) => ({
          label: category.display_name,
          href: `/categories/${encodeURIComponent(category.slug || category.display_name)}`,
        }))}
        note="Storefront home is now reading public category and featured-product APIs first, with workbook content retained as a fallback layer."
      />
    </div>
  );
}

function asJsonRecord(value: JsonValue | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : {};
}

function readJsonString(source: Record<string, JsonValue>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}
