import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCart } from "../features/cart/hooks/useCart";
import {
  findHomeWorkbookCategoryPage,
  type HomeWorkbookCategoryPage,
  type HomeWorkbookCategoryProduct,
  type HomeWorkbookContent,
} from "../features/home/workbook";
import { useHomeWorkbook } from "../features/home/useHomeWorkbook";
import { api, getErrorMessage, isHttpError } from "../shared/api";
import { ProductCard } from "../shared/components/product/ProductCard";
import { formatCurrency } from "../shared/utils/format";
import type {
  JsonObject,
  Product,
  StorefrontCategoryPageData,
  StorefrontEditorialSection,
} from "../shared/types/api";
import "./CategoryPage.css";

const fallbackCategoryImages: Record<string, string> = {
  "shop-men": "https://lh3.googleusercontent.com/aida-public/AB6AXuCyUfebOMONTnvYr9ZpAON5r2sqH9cixvFEI4IUO1HgtLokw0DocOKis15vSsJ14j6mnx1QrXMXJyDrzK64DrNUI1kc34lTyj4aIPfoodV3MFa0JLPFNdllb_6HgGOigtKyydUohURWyjMOQURKHAk5z02a5vuIH_t821X1vUIusV9VajR3V14-QiTAt7WCragHu_ErX2cBuxj6cZyi0qHNw-tRhFozQO02eRzXwXB3GyXDgg6tVkt9BgTiuPHfPlE9ZdYH2sNodvYW",
  "shop-women": "https://lh3.googleusercontent.com/aida-public/AB6AXuBfeL88OBqW4Ue3Wr45J2UYNHHoz1V3GIYVT6BS47pFs4Ts1ZtnuMaaioY1y7Je7oqhcYL8DLZR8KKa3pevzh2EOXaCo_M9xAJhHsGvxIeawRZyLgrBDcTQKiMMTdBJfJv4EDGj_ST1SAVOcoV-DlbA_GhmqAhboruBHvNNSjrLZExknF7AnbpG7f-BfdcG52rKGirTBwXdWoxBIaSFpozclIZ4oni5B5b2Xn7rzo1a13KiUEDsW12kfxNX2AN9xi_LfBWp-G8i2o7n",
  footwear: "https://lh3.googleusercontent.com/aida-public/AB6AXuC35EijN08hEhyXUNWU2WpmdXA-xKjXvVdQOkMB4J5Rt7XVw2ILNt27Jt92PUK2lOZLOyi-wwd64M20h4a_trllHLaecxpEhm3cRJskDeuyLTz248X3saxiF9Xx7qHWTTV-Q_6G58RaZiu-8vk3yYYOiP5aflLpGRjTe6yi6EtaoQKcBvHljgI4ItMv4FXnUPfGAYVnlVFrxYoDYB6LIE9tpXNeScpgugQTJzhp_icbkXy4Ay2kMR5-SI0rGXdV2RyT8p-AYS9ZdH9w",
  accessories: "https://lh3.googleusercontent.com/aida-public/AB6AXuAtpa0mJyKNICckH1wefUZTbwZo2Cg73toQg0p8Gs8HN84jU1dorhR-2jnXY-oDpZbRJQTYU6z2RuFiaqR_vx_BDTT30cUs2PtZGI-fdDfLZlrhkBB-gyED-FFOC2t0Dwpfe2t6mBWGbfA-f4EbYvH1QV61hKuBF7UfI-b_NBaRjm_A3LejyFwwwvM-2t-K-zHQWiYcOHHbplLjNpn3jDEO4siwrnpdkAaVJDh28LrLN0qGfUWRCFcXRzKfNM5VvnVj7r3R8bZe5FpI",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRecord(value: unknown): JsonObject {
  return isRecord(value) ? (value as JsonObject) : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStringFromRecord(record: JsonObject, ...keys: string[]) {
  for (const key of keys) {
    const value = readString(record[key]);
    if (value) {
      return value;
    }
  }

  return "";
}

function normalizeCategoryToken(value: string) {
  return value.trim().toLowerCase();
}

function getFallbackCategoryImage(
  slug: string,
  displayName: string,
  featuredImage?: string
) {
  if (featuredImage) {
    return featuredImage;
  }

  const normalizedSlug = normalizeCategoryToken(slug);
  if (fallbackCategoryImages[normalizedSlug]) {
    return fallbackCategoryImages[normalizedSlug];
  }

  return `https://placehold.co/1200x1500/F5F3EE/1B3022?text=${encodeURIComponent(
    displayName || slug || "Category"
  )}`;
}

function getSectionPayload(
  sections: StorefrontEditorialSection[],
  sectionTypes: string[]
) {
  const match = sections.find((section) =>
    sectionTypes.includes(section.section_type)
  );

  return readRecord(match?.payload);
}

function buildHeroSource(pageData: StorefrontCategoryPageData) {
  return {
    ...readRecord(pageData.category.hero),
    ...getSectionPayload(pageData.sections, ["hero-banner"]),
  };
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function resolveHref(href: string, fallbackHref: string) {
  const trimmed = href.trim();
  return trimmed || fallbackHref;
}

function buildFilterLookupValue(filterKey: string, option: string) {
  return `${filterKey.trim().toLowerCase()}:${option.trim().toLowerCase()}`;
}

function buildCategoryRoute(categoryPage: HomeWorkbookCategoryPage) {
  const identifier = categoryPage.routeAliases[0] || categoryPage.slug;
  return `/categories/${encodeURIComponent(identifier)}`;
}

function buildInitialFilterState(page: HomeWorkbookCategoryPage) {
  return Object.fromEntries(
    page.filters
      .filter((filter) => filter.defaultValue)
      .map((filter) => [filter.filterKey, filter.defaultValue])
  );
}

function matchesWorkbookProductFilters(
  product: HomeWorkbookCategoryProduct,
  activeFilters: Record<string, string>
) {
  if (Object.keys(activeFilters).length === 0) {
    return true;
  }

  const normalizedTags = product.filterTags.map((tag) => tag.trim().toLowerCase());

  return Object.entries(activeFilters).every(([filterKey, option]) => {
    if (!option) {
      return true;
    }

    return normalizedTags.includes(buildFilterLookupValue(filterKey, option));
  });
}

function formatResultsLabel(template: string, count: number) {
  if (!template.trim()) {
    return `Showing ${count} results`;
  }

  return template.replace("%count%", String(count));
}

function CategoryActionLink({
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

export function CategoryPage() {
  const { categoryName = "" } = useParams();
  const identifier = decodeURIComponent(categoryName);

  return <StorefrontCategoryRoute identifier={identifier} />;
}

function StorefrontCategoryRoute({ identifier }: { identifier: string }) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { content, status: workbookStatus } = useHomeWorkbook();

  const [storefrontPage, setStorefrontPage] =
    useState<StorefrontCategoryPageData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const workbookCategoryPage =
    content ? findHomeWorkbookCategoryPage(content, identifier) : null;

  useEffect(() => {
    if (workbookCategoryPage) {
      setStorefrontPage(null);
      setProducts([]);
      setFeedback("");
      setIsLoading(false);
      return undefined;
    }

    if (workbookStatus === "loading" || workbookStatus === "refreshing") {
      return undefined;
    }

    let active = true;

    async function loadCategoryData() {
      setIsLoading(true);
      setStorefrontPage(null);
      setProducts([]);
      setFeedback("");

      try {
        const storefrontResponse = await api.getStorefrontCategoryPage(identifier);
        if (!active) {
          return;
        }

        setStorefrontPage(storefrontResponse.data);
        setProducts(
          storefrontResponse.data.featured_products.map((item) => item.product)
        );
      } catch (reason) {
        if (!active) {
          return;
        }

        if (!isHttpError(reason) || reason.status !== 404) {
          setFeedback(getErrorMessage(reason));
          setIsLoading(false);
          return;
        }

        try {
          const productResponse = await api.listProducts({
            category: identifier,
            limit: 48,
            status: "active",
          });
          if (!active) {
            return;
          }

          setProducts(productResponse.data);
        } catch (fallbackReason) {
          if (active) {
            setFeedback(getErrorMessage(fallbackReason));
          }
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadCategoryData();

    return () => {
      active = false;
    };
  }, [identifier, workbookCategoryPage, workbookStatus]);

  async function handleAddToCart(product: Product) {
    try {
      setBusyProductId(product.id);
      await addItem({
        product_id: product.id,
        quantity: 1,
      });
      setFeedback(`${product.name} đã được thêm vào giỏ hàng.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }

  if (workbookCategoryPage && content) {
    return (
      <WorkbookCategoryPage
        content={content}
        pageData={workbookCategoryPage}
      />
    );
  }

  if (storefrontPage) {
    return (
      <EditorialCategoryPage
        busyProductId={busyProductId}
        feedback={feedback}
        isLoading={isLoading}
        navigate={navigate}
        onAddToCart={handleAddToCart}
        pageData={storefrontPage}
        products={products}
      />
    );
  }

  return (
    <div className="page-stack category-page">
      <section className="content-section category-results-section">
        <div className="section-heading category-results-head">
          <div>
            <span className="section-kicker">Category Listing</span>
            <h2>Sản phẩm trong danh mục {identifier}</h2>
          </div>
          <span className="category-results-caption">
            {products.length > 0 ? `${products.length} sản phẩm active` : "Chưa có dữ liệu hiển thị"}
          </span>
        </div>

        {feedback ? (
          <div className={products.length > 0 ? "feedback feedback-info" : "feedback feedback-error"}>{feedback}</div>
        ) : null}

        {isLoading ? (
          <div className="page-state">Đang tải danh mục...</div>
        ) : products.length > 0 ? (
          <div className="product-grid category-product-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                busy={busyProductId === product.id}
                onAddToCart={handleAddToCart}
                onBuyNow={(selected) =>
                  navigate("/checkout", {
                    state: {
                      directProduct: {
                        id: selected.id,
                        name: selected.name,
                        price: selected.price,
                        quantity: 1,
                      },
                    },
                  })
                }
                product={product}
              />
            ))}
          </div>
        ) : feedback ? null : (
          <div className="empty-card category-empty-state">
            <span className="section-kicker">Empty Category</span>
            <strong>Danh mục này chưa có sản phẩm active.</strong>
            <span>Bạn có thể quay lại catalog để xem các mặt hàng khác đang hiển thị.</span>
            <Link className="text-link" to="/products">
              Quay lại catalog
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function WorkbookCategoryPage({
  content,
  pageData,
}: {
  content: HomeWorkbookContent;
  pageData: HomeWorkbookCategoryPage;
}) {
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(
    () => buildInitialFilterState(pageData)
  );

  useEffect(() => {
    setActiveFilters(buildInitialFilterState(pageData));
  }, [pageData]);

  const filteredProducts = pageData.products.filter((product) =>
    matchesWorkbookProductFilters(product, activeFilters)
  );
  const primaryCategoryRoute = buildCategoryRoute(pageData);
  const categoryNavigation = [
    {
      label: "All Archive",
      href: "/",
      isActive: false,
    },
    ...content.categoryPages.map((page) => ({
      label: page.navLabel,
      href: buildCategoryRoute(page),
      isActive: page.slug === pageData.slug,
    })),
  ];

  return (
    <div className="atelier-category-page">
      <section className="atelier-category-hero">
        <img
          alt={pageData.heroImageAlt || pageData.heroTitle}
          className="atelier-category-hero-image"
          src={pageData.heroImageUrl || getFallbackCategoryImage(pageData.slug, pageData.heroTitle)}
        />
        <div className="atelier-category-hero-scrim" />

        <div className="atelier-category-hero-inner">
          <nav className="atelier-category-pill-row" aria-label="Atelier navigation">
            {categoryNavigation.map((item) => (
              <CategoryActionLink
                className={
                  item.isActive
                    ? "atelier-category-pill atelier-category-pill-active"
                    : "atelier-category-pill"
                }
                fallbackHref="/"
                href={item.href}
                key={item.label}
              >
                {item.label}
              </CategoryActionLink>
            ))}
          </nav>

          <div className="atelier-category-hero-grid">
            <div className="atelier-category-hero-copy">
              <span className="atelier-category-kicker">
                {pageData.heroEyebrow || pageData.navLabel}
              </span>
              <h1>{pageData.heroTitle}</h1>
              <p>{pageData.heroDescription}</p>
            </div>

            {pageData.quoteBody ? (
              <aside className="atelier-category-quote-card">
                <p>{pageData.quoteBody}</p>
                {pageData.quoteAuthor ? <span>{pageData.quoteAuthor}</span> : null}
              </aside>
            ) : null}
          </div>
        </div>
      </section>

      {pageData.filters.length > 0 ? (
        <section className="atelier-category-filter-surface">
          {pageData.filters.map((filter) => (
            <article className="atelier-category-filter-card" key={filter.filterKey}>
              <span className="atelier-category-filter-label">{filter.label}</span>
              <div className="atelier-category-filter-options">
                {filter.options.map((option) => {
                  const isActive = activeFilters[filter.filterKey] === option;
                  const isResetOption = option.trim().toLowerCase().startsWith("all");

                  return (
                    <button
                      className={
                        isActive
                          ? "atelier-category-filter-chip atelier-category-filter-chip-active"
                          : "atelier-category-filter-chip"
                      }
                      key={`${filter.filterKey}-${option}`}
                      onClick={() => {
                        setActiveFilters((current) => {
                          const nextFilters = { ...current };

                          if (current[filter.filterKey] === option || isResetOption) {
                            delete nextFilters[filter.filterKey];
                            return nextFilters;
                          }

                          nextFilters[filter.filterKey] = option;
                          return nextFilters;
                        });
                      }}
                      type="button"
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="atelier-category-results-surface">
        <div className="atelier-category-results-head">
          <span>{formatResultsLabel(pageData.resultsLabel, filteredProducts.length)}</span>
          <span>{pageData.sortLabel || "Sort by: Relevance"}</span>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="atelier-category-product-grid">
            {filteredProducts.map((product) => (
              <CategoryActionLink
                className="atelier-category-product-card"
                fallbackHref={primaryCategoryRoute}
                href={product.href || primaryCategoryRoute}
                key={`${pageData.slug}-${product.position}-${product.name}`}
              >
                <div className="atelier-category-product-media">
                  <img alt={product.imageAlt || product.name} src={product.imageUrl} />
                </div>
                <div className="atelier-category-product-copy">
                  <span>{product.badge}</span>
                  <strong>{product.name}</strong>
                  <p>{product.material}</p>
                  <em>{formatCurrency(product.price)}</em>
                </div>
              </CategoryActionLink>
            ))}
          </div>
        ) : (
          <div className="empty-card category-empty-state">
            <span className="section-kicker">Filtered Empty State</span>
            <strong>No pieces match the current filter combination.</strong>
            <span>Clear one of the active filter chips to bring the editorial grid back.</span>
          </div>
        )}
      </section>

      {(pageData.storyTitle || pageData.storyImageUrl) && (
        <section className="atelier-category-story-surface">
          <div className="atelier-category-story-copy">
            <span className="atelier-category-filter-label">
              {pageData.storyEyebrow || "Editorial Story"}
            </span>
            <h2>{pageData.storyTitle || "Editorial Story"}</h2>
            <p>{pageData.storyBody}</p>

            {pageData.storyCtaLabel ? (
              <CategoryActionLink
                className="atelier-category-story-link"
                fallbackHref={primaryCategoryRoute}
                href={pageData.storyCtaHref || primaryCategoryRoute}
              >
                {pageData.storyCtaLabel}
              </CategoryActionLink>
            ) : null}
          </div>

          <div className="atelier-category-story-media">
            <img
              alt={pageData.storyImageAlt || pageData.storyTitle}
              src={
                pageData.storyImageUrl ||
                getFallbackCategoryImage(pageData.slug, pageData.storyTitle || pageData.heroTitle)
              }
            />
          </div>
        </section>
      )}

      <footer className="atelier-category-footer">
        <div>
          <strong>ND Shop</strong>
          <p>
            {pageData.footerNote ||
              "Workbook-driven category page aligned to the Stitch Atelier direction."}
          </p>
        </div>
        <div className="atelier-category-footer-links">
          {content.footerLinks.map((link) => (
            <CategoryActionLink
              className="atelier-category-footer-link"
              fallbackHref="/"
              href={link.href || "/"}
              key={`${link.position}-${link.label}`}
            >
              {link.label}
            </CategoryActionLink>
          ))}
        </div>
      </footer>
    </div>
  );
}

function EditorialCategoryPage({
  pageData,
  products,
  feedback,
  isLoading,
  busyProductId,
  onAddToCart,
  navigate,
}: {
  pageData: StorefrontCategoryPageData;
  products: Product[];
  feedback: string;
  isLoading: boolean;
  busyProductId: string;
  onAddToCart: (product: Product) => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const heroSource = buildHeroSource(pageData);
  const featureSource = getSectionPayload(pageData.sections, [
    "feature-card",
    "feature-panel",
    "feature-spotlight",
    "story-block",
  ]);
  const heroProduct = products[0] ?? null;
  const featureProduct = products[1] ?? heroProduct;
  const heroImage = getFallbackCategoryImage(
    pageData.category.slug,
    pageData.category.display_name,
    readStringFromRecord(heroSource, "imageUrl", "image_url") ||
      heroProduct?.image_urls[0] ||
      heroProduct?.image_url
  );
  const featureImage = getFallbackCategoryImage(
    pageData.category.slug,
    pageData.category.display_name,
    readStringFromRecord(featureSource, "imageUrl", "image_url") ||
      featureProduct?.image_urls[0] ||
      featureProduct?.image_url
  );
  const heroTitle =
    readStringFromRecord(heroSource, "title", "heading") ||
    pageData.category.display_name;
  const heroDescription =
    readStringFromRecord(heroSource, "description", "subtitle", "body") ||
    `${pageData.category.display_name} đang được phục vụ trực tiếp từ storefront API mới.`;
  const heroBadge =
    readStringFromRecord(heroSource, "badge", "eyebrow") ||
    pageData.category.nav_label;
  const featureTitle =
    readStringFromRecord(featureSource, "title", "heading", "panelTitle", "panel_title") ||
    featureProduct?.name ||
    `Curated ${pageData.category.nav_label}`;
  const featureDescription =
    readStringFromRecord(
      featureSource,
      "description",
      "body",
      "panelDescription",
      "panel_description"
    ) ||
    featureProduct?.description ||
    `Editorial content va curated products cho ${pageData.category.display_name} đang bám cùng source dữ liệu backend.`;
  const metrics = [
    {
      label: "Curated items",
      value: String(products.length),
      description: "featured_products",
    },
    {
      label: "Editorial sections",
      value: String(pageData.sections.length),
      description: "editorial_sections",
    },
    {
      label: "Price range",
      value:
        products.length > 0
          ? `${formatCurrency(
              Math.min(...products.map((product) => product.price))
            )} - ${formatCurrency(
              Math.max(...products.map((product) => product.price))
            )}`
          : "--",
      description: "real-time product pricing",
    },
  ];

  return (
    <div className="page-stack category-page">
      <section className="category-hero">
        <article className="category-hero-panel">
          <div className="category-hero-copy">
            <span className="section-kicker">{heroBadge || "Storefront category"}</span>
            <h1>{heroTitle}</h1>
            <p>{heroDescription}</p>
          </div>

          <div className="hero-actions">
            <Link
              className="primary-link"
              to={heroProduct ? `/products/${heroProduct.id}` : "/products"}
            >
              {heroProduct ? "Shop featured piece" : "Explore archive"}
            </Link>
            <Link className="secondary-link" to="/products">
              View full catalog
            </Link>
          </div>

          <div className="category-chip-row">
            {[pageData.category.slug, ...pageData.category.aliases]
              .filter(Boolean)
              .slice(0, 4)
              .map((item) => (
                <span className="product-card-badge" key={item}>
                  {item}
                </span>
              ))}
          </div>

          <div className="category-metric-grid">
            {metrics.map((metric) => (
              <article className="surface-card category-metric-card" key={metric.label}>
                <span className="section-kicker">{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.description}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="category-feature-card">
          <div className="category-feature-media">
            {featureImage ? (
              <img alt={featureTitle} src={featureImage} />
            ) : (
              <div className="category-feature-fallback">
                {(featureTitle || pageData.category.nav_label).slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="category-feature-copy">
            <span className="section-kicker">Editorial block</span>
            <strong>{featureTitle}</strong>
            <p>{featureDescription}</p>
          </div>
        </article>
      </section>

      <section className="content-section category-results-section">
        <div className="section-heading category-results-head">
          <div>
            <span className="section-kicker">Storefront API</span>
            <h2>{pageData.category.display_name}</h2>
          </div>
          <span className="category-results-caption">
            {products.length > 0
              ? `${products.length} curated products from featured_products`
              : "Chưa có curated products"}
          </span>
        </div>

        {feedback ? (
          <div
            className={
              products.length > 0
                ? "feedback feedback-info"
                : "feedback feedback-error"
            }
          >
            {feedback}
          </div>
        ) : null}

        {isLoading ? (
          <div className="page-state">Đang tải storefront category...</div>
        ) : products.length > 0 ? (
          <div className="product-grid category-product-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                busy={busyProductId === product.id}
                onAddToCart={onAddToCart}
                onBuyNow={(selected) =>
                  navigate("/checkout", {
                    state: {
                      directProduct: {
                        id: selected.id,
                        name: selected.name,
                        price: selected.price,
                        quantity: 1,
                      },
                    },
                  })
                }
                product={product}
                variant="archive"
              />
            ))}
          </div>
        ) : (
          <div className="empty-card category-empty-state">
            <span className="section-kicker">Editorial category</span>
            <strong>Category này đã có cấu trúc storefront nhưng chưa có curated products.</strong>
            <span>
              Hãy import thêm `featured_products` hoặc bổ sung product active vào
              category này để lấp đầy grid.
            </span>
            <Link className="text-link" to="/products">
              Quay lại catalog
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
