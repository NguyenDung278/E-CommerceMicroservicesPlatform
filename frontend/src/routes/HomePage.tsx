import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";

import {
  type HomeWorkbookProduct,
  type HomeWorkbookSegment,
} from "../features/home/workbook";
import { useHomeWorkbook } from "../features/home/useHomeWorkbook";
import { formatCurrency } from "../shared/utils/format";
import "./HomePage.css";

const fallbackHeroImage =
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1800&q=80";
const fallbackTileImage =
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80";
const fallbackCalloutImage =
  "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=1400&q=80";

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function resolveHref(href: string, fallbackHref: string) {
  const trimmed = href.trim();
  return trimmed || fallbackHref;
}

function ActionLink({
  href,
  fallbackHref,
  className,
  children,
}: {
  href: string;
  fallbackHref: string;
  className: string;
  children: ReactNode;
}) {
  const finalHref = resolveHref(href, fallbackHref);

  if (isExternalHref(finalHref)) {
    return (
      <a className={className} href={finalHref} rel="noreferrer" target="_blank">
        {children}
      </a>
    );
  }

  return (
    <Link className={className} to={finalHref}>
      {children}
    </Link>
  );
}

function buildPageStyle(segment: HomeWorkbookSegment | null): CSSProperties {
  return {
    "--home-stitch-accent": segment?.hero.accent || "#946246",
  } as CSSProperties;
}

function buildTileHref(segment: HomeWorkbookSegment | null, href: string) {
  return resolveHref(href, segment?.href || "/products");
}

function buildProductHref(product: HomeWorkbookProduct) {
  return resolveHref(product.href, "/products");
}

function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="home-stitch-empty-card">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

export function HomePage() {
  const productRailRef = useRef<HTMLDivElement | null>(null);
  const {
    content,
    error,
  } = useHomeWorkbook();

  const navItems = content?.navItems ?? [];
  const segments = content?.segments ?? [];
  const [activeSegmentSlug, setActiveSegmentSlug] = useState("");

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

  const activeTiles = activeSegment?.tiles.slice(0, 4) ?? [];
  const activeMetrics = activeSegment?.metrics.slice(0, 4) ?? [];
  const activeProducts = activeSegment?.products.slice(0, 8) ?? [];
  const footerLinks = content?.footerLinks ?? [];
  const footer = content?.footer ?? {
    brandName: "ND Shop",
    caption: "Crafted for the Discerning",
    note: "Workbook-driven editorial homepage.",
  };
  const pageStyle = buildPageStyle(activeSegment);

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

  return (
    <div className="home-stitch-page" style={pageStyle}>
      {error ? <div className="feedback feedback-info home-stitch-feedback">{error}</div> : null}

      <section className="home-stitch-hero">
        <img
          alt={activeSegment?.hero.title || "Workbook hero"}
          className="home-stitch-hero-image"
          src={activeSegment?.hero.backgroundImage || fallbackHeroImage}
        />
        <div className="home-stitch-hero-scrim" />

        <div className="home-stitch-hero-inner">
          <div className="home-stitch-tab-row" role="tablist" aria-label="Archive tabs">
            {navItems.map((item) => {
              const isActive = item.slug === activeSegment?.slug;

              return (
                <button
                  aria-selected={isActive}
                  className={`home-stitch-tab ${isActive ? "is-active" : ""}`}
                  key={item.slug}
                  onClick={() => {
                    startTransition(() => {
                      setActiveSegmentSlug(item.slug);
                    });
                  }}
                  role="tab"
                  type="button"
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="home-stitch-hero-grid">
            <div className="home-stitch-hero-copy">
              <span className="home-stitch-kicker">
                {activeSegment?.hero.collectionKicker || "Seasonal Edit"}
              </span>
              <h1>{activeSegment?.hero.title || "Forest & Hearth"}</h1>
              <p>{activeSegment?.hero.description}</p>

              <div className="home-stitch-action-row">
                <ActionLink
                  className="home-stitch-primary-button"
                  fallbackHref={activeSegment?.href || "/products"}
                  href={activeSegment?.hero.primaryCtaHref || "/products"}
                >
                  {activeSegment?.hero.primaryCtaLabel || "Explore Collection"}
                </ActionLink>
                <ActionLink
                  className="home-stitch-secondary-button"
                  fallbackHref={activeSegment?.href || "/products"}
                  href={activeSegment?.hero.secondaryCtaHref || activeSegment?.href || "/products"}
                >
                  {activeSegment?.hero.secondaryCtaLabel || "View Lookbook"}
                </ActionLink>
              </div>
            </div>

            <aside className="home-stitch-quote-card">
              <span>{activeSegment?.hero.quoteKicker || "Editorial Note"}</span>
              <p>
                {activeSegment?.hero.quoteBody ||
                  "Update the workbook to change hero, tiles, metrics, and arrivals without touching the UI code."}
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="home-stitch-bento-section">
        {activeTiles.length > 0 ? (
          <div className="home-stitch-bento-grid">
            {activeTiles.map((tile, index) => (
              <ActionLink
                className={`home-stitch-bento-card home-stitch-bento-card-${index + 1}`}
                fallbackHref={activeSegment?.href || "/products"}
                href={buildTileHref(activeSegment, tile.ctaHref)}
                key={`${tile.segmentSlug}-${tile.position}-${tile.title}`}
              >
                <img alt={tile.title} src={tile.imageUrl || fallbackTileImage} />
                <div className="home-stitch-bento-scrim" />
                <div className="home-stitch-bento-copy">
                  <span>{tile.eyebrow || activeSegment?.label}</span>
                  <h2>{tile.title}</h2>
                  <p>{tile.subtitle}</p>
                  <strong>{tile.ctaLabel || "Explore"}</strong>
                </div>
              </ActionLink>
            ))}
          </div>
        ) : (
          <EmptyState
            body="Thêm các dòng vào sheet category_tiles để lấp đầy editorial grid cho tab này."
            title="Tab hiện tại chưa có category tile."
          />
        )}
      </section>

      <section className="home-stitch-callout-section">
        <div className="home-stitch-callout-copy">
          <span className="home-stitch-section-label">
            {activeSegment?.callout?.eyebrow || "Technical Editorial"}
          </span>
          <h2>{activeSegment?.callout?.title || "Digital Precision, Analogue Soul."}</h2>
          <p>
            {activeSegment?.callout?.body ||
              "Workbook-driven sections let the team update imagery and copy without hardcoded homepage data."}
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
            {activeProducts.map((product) => (
              <ActionLink
                className="home-stitch-product-card"
                fallbackHref="/products"
                href={buildProductHref(product)}
                key={`${product.segmentSlug}-${product.position}-${product.name}`}
              >
                <div className="home-stitch-product-media">
                  <img alt={product.name} src={product.imageUrl || fallbackTileImage} />
                </div>
                <div className="home-stitch-product-copy">
                  <p>{product.eyebrow || product.brand || activeSegment?.label}</p>
                  <h3>{product.name}</h3>
                  <div className="home-stitch-product-meta">
                    <span>{product.sizeTag || product.brand || "Archive edit"}</span>
                    <span>{formatCurrency(product.price)}</span>
                  </div>
                  <small>{product.fitNote || "Workbook-controlled product story."}</small>
                </div>
              </ActionLink>
            ))}
          </div>
        ) : (
          <EmptyState
            body="Sheet products đang trống cho tab này. Chỉ cần thêm dòng cùng segment_slug là rail sẽ tự hiển thị."
            title="Tab hiện tại chưa có arrivals."
          />
        )}
      </section>

      <footer className="home-stitch-footer">
        <div className="home-stitch-footer-brand">
          <strong>{footer.brandName}</strong>
          <p>{footer.caption}</p>
        </div>

        <nav aria-label="Footer" className="home-stitch-footer-links">
          {footerLinks.length > 0 ? (
            footerLinks.map((link) => (
              <ActionLink
                className="home-stitch-footer-link"
                fallbackHref="/products"
                href={link.href}
                key={`${link.position}-${link.label}`}
              >
                {link.label}
              </ActionLink>
            ))
          ) : (
            <span className="home-stitch-footer-link is-muted">No footer links in workbook</span>
          )}
        </nav>

        <div className="home-stitch-footer-note">{footer.note}</div>
      </footer>
    </div>
  );
}
