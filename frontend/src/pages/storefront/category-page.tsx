import { Link, useParams } from "react-router-dom";

import {
  EditorialSignatureFooter,
  PaginationControls,
  ProductCard,
  StorefrontActionLink,
  StorefrontCollectionCard,
  StorefrontFilterSection,
  StorefrontOverlayHeader,
  StorefrontResultsToolbar,
} from "@/components";
import type {
  HomeWorkbookCategoryPage,
  HomeWorkbookCategoryProduct,
  HomeWorkbookContent,
} from "@/features/home/home-workbook";
import { buildCategoryRoute } from "@/features/storefront/archive/archive-utils";
import {
  buildHeroSource,
  buildWorkbookCategoryProductLookupKey,
  getFallbackCategoryImage,
  getSectionPayload,
  readStringFromRecord,
  resolveWorkbookProductHref,
} from "@/features/storefront/category/category-page-utils";
import { useStorefrontCategoryRoute } from "@/features/storefront/category/use-storefront-category-route";
import { useWorkbookCategoryPageState } from "@/features/storefront/category/use-workbook-category-page-state";
import { usePaginatedList } from "@/features/storefront/listing/use-paginated-list";
import { resolveStorefrontCopy } from "@/features/storefront/storefront-copy";
import { formatCurrency } from "@/utils/format";
import type { Product, StorefrontCategoryPageData } from "@/types/api";
import "@/styles/pages/storefront/category-page.css";

const categorySortOptions = [
  { label: "Category Order", value: "latest" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
] as const;
const highPriorityImageAttribute = { fetchpriority: "high" } as Record<string, string>;

export function CategoryPage() {
  const { categoryName = "" } = useParams();
  const identifier = decodeURIComponent(categoryName);

  return <StorefrontCategoryRoute identifier={identifier} />;
}

function StorefrontCategoryRoute({ identifier }: { identifier: string }) {
  const routeState = useStorefrontCategoryRoute(identifier);

  if (routeState.storefrontPage) {
    return (
      <EditorialCategoryPage
        busyProductId={routeState.busyProductId}
        content={routeState.content}
        feedback={routeState.feedback}
        isLoading={routeState.isLoading}
        onAddToCart={routeState.handleAddToCart}
        onBuyNow={routeState.handleBuyNow}
        pageData={routeState.storefrontPage}
        products={routeState.products}
      />
    );
  }

  if (routeState.workbookCategoryPage && routeState.content) {
    return (
      <WorkbookCategoryPage
        content={routeState.content}
        pageData={routeState.workbookCategoryPage}
      />
    );
  }

  return (
    <BasicCategoryPage
      busyProductId={routeState.busyProductId}
      content={routeState.content}
      feedback={routeState.feedback}
      identifier={identifier}
      isLoading={routeState.isLoading}
      onAddToCart={routeState.handleAddToCart}
      onBuyNow={routeState.handleBuyNow}
      products={routeState.products}
    />
  );
}

function BasicCategoryPage({
  content,
  identifier,
  products,
  feedback,
  isLoading,
  busyProductId,
  onAddToCart,
  onBuyNow,
}: {
  content: HomeWorkbookContent | null;
  identifier: string;
  products: Product[];
  feedback: string;
  isLoading: boolean;
  busyProductId: string;
  onAddToCart: (product: Product) => Promise<void>;
  onBuyNow: (product: Product) => Promise<void>;
}) {
  const pagination = usePaginatedList(products, {
    pageSize: 12,
  });
  const footerNoteFallback =
    "An editorial storefront shaped for clear browsing, product discovery, and quick returns.";

  return (
    <div className="page-stack category-page">
      <section className="content-section category-results-section">
        <div className="section-heading category-results-head">
          <div>
            <span className="section-kicker">Collection</span>
            <h2>Sản phẩm trong danh mục {identifier}</h2>
          </div>
          <span className="category-results-caption">
            {products.length > 0
              ? `${pagination.pageStart}-${pagination.pageEnd} of ${products.length} sản phẩm đang có`
              : "Danh mục đang được cập nhật"}
          </span>
        </div>

        {feedback ? (
          <div
            className={
              products.length > 0 ? "feedback feedback-info" : "feedback feedback-error"
            }
          >
            {feedback}
          </div>
        ) : null}

        {isLoading ? (
          <div className="page-state">Đang tải bộ sưu tập...</div>
        ) : products.length > 0 ? (
          <>
            <div className="product-grid category-product-grid">
              {pagination.paginatedItems.map((product) => (
                <ProductCard
                  key={product.id}
                  busy={busyProductId === product.id}
                  onAddToCart={onAddToCart}
                  onBuyNow={onBuyNow}
                  product={product}
                />
              ))}
            </div>

            <PaginationControls
              ariaLabel={`${identifier} category pagination`}
              currentPage={pagination.currentPage}
              pageCount={pagination.pageCount}
              onPageChange={pagination.goToPage}
            />
          </>
        ) : feedback ? null : (
          <div className="empty-card category-empty-state">
            <span className="section-kicker">Collection update</span>
            <strong>Danh mục này chưa có sản phẩm đang mở bán.</strong>
            <span>Bạn có thể quay lại archive để khám phá các bộ sưu tập khác.</span>
            <Link className="text-link" to="/products">
              Quay lại archive
            </Link>
          </div>
        )}
      </section>

      <EditorialSignatureFooter
        brandName={content?.footer.brandName}
        caption={content?.footer.caption}
        links={content?.footerLinks}
        note={resolveStorefrontCopy(content?.footer.note, footerNoteFallback)}
      />
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
  const categoryState = useWorkbookCategoryPageState(pageData);
  const pagination = usePaginatedList(categoryState.filteredProducts, {
    pageSize: 12,
  });
  const primaryCategoryRoute = buildCategoryRoute(pageData);
  const heroDescription = resolveStorefrontCopy(
    pageData.heroDescription,
    `${pageData.navLabel || pageData.heroTitle} selected for easier browsing and confident everyday styling.`
  );
  const storyBody = resolveStorefrontCopy(
    pageData.storyBody,
    "A closer look at the textures, silhouettes, and details shaping this collection."
  );
  const footerNote = resolveStorefrontCopy(
    pageData.footerNote,
    "A focused edit designed to be easy to browse and revisit."
  );
  const activeSummary =
    categoryState.activeFilterSummary ||
    (categoryState.activeFilterCount > 0
      ? `${categoryState.activeFilterCount} filters active`
      : undefined);

  return (
    <div className="atelier-category-page">
      <section className="atelier-category-hero">
        <img
          alt={pageData.heroImageAlt || pageData.heroTitle}
          className="atelier-category-hero-image"
          decoding="async"
          src={pageData.heroImageUrl || getFallbackCategoryImage(pageData.slug, pageData.heroTitle)}
          {...highPriorityImageAttribute}
        />
        <div className="atelier-category-hero-scrim" />

        <div className="atelier-category-hero-inner">
          <StorefrontOverlayHeader />

          <div className="atelier-category-hero-grid">
            <div className="atelier-category-hero-copy">
              <span className="atelier-category-kicker">
                {pageData.heroEyebrow || pageData.navLabel}
              </span>
              <h1>{pageData.heroTitle}</h1>
              <p>{heroDescription}</p>
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

      <section className="atelier-category-results-layout">
        <aside
          className={
            categoryState.isFiltersPanelOpen
              ? "atelier-category-sidebar atelier-category-sidebar-open"
              : "atelier-category-sidebar"
          }
          id={`atelier-category-filters-${pageData.slug}`}
        >
          {pageData.filters.length > 0 ? (
            pageData.filters.map((filter) => (
              <StorefrontFilterSection
                className="atelier-category-filter-card"
                expanded={categoryState.openSections[filter.filterKey] ?? true}
                key={filter.filterKey}
                summary={categoryState.activeFilters[filter.filterKey] || `All ${filter.label}`}
                title={filter.label.toUpperCase()}
                onToggle={() => categoryState.toggleWorkbookSection(filter.filterKey)}
              >
                <div className="atelier-category-filter-options">
                  {filter.options.map((option) => {
                    const isActive = categoryState.activeFilters[filter.filterKey] === option;

                    return (
                      <button
                        className={
                          isActive
                            ? "atelier-category-filter-chip atelier-category-filter-chip-active"
                            : "atelier-category-filter-chip"
                        }
                        key={`${filter.filterKey}-${option}`}
                        type="button"
                        onClick={() => categoryState.toggleWorkbookFilter(filter.filterKey, option)}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </StorefrontFilterSection>
            ))
          ) : (
            <div className="atelier-category-sidebar-note">
              <span className="atelier-category-filter-label">Collection Note</span>
              <p>Browse the full edit with search and sort to narrow the selection.</p>
            </div>
          )}

          <button
            className="atelier-category-reset-button"
            type="button"
            onClick={categoryState.clearWorkbookFilters}
          >
            Reset Filters
          </button>
        </aside>

        <div className="atelier-category-results-pane">
          <section className="atelier-category-results-surface">
            <StorefrontResultsToolbar
              className="atelier-category-results-toolbar-shell"
              filterPanelId={`atelier-category-filters-${pageData.slug}`}
              filterPanelOpen={categoryState.isFiltersPanelOpen}
              filterToggleClassName="atelier-category-filters-toggle"
              filterToggleCount={categoryState.activeFilterCount}
              resultLabel={categoryState.resultsLabel}
              searchClearClassName="atelier-category-search-clear"
              searchInputId={`category-search-${pageData.slug}`}
              searchLabel={`Search products in ${pageData.navLabel || pageData.heroTitle}`}
              searchPlaceholder={categoryState.searchPlaceholder}
              searchValue={categoryState.searchInput}
              sortId={`category-sort-${pageData.slug}`}
              sortOptions={[...categorySortOptions]}
              sortValue={categoryState.sortBy}
              summary={activeSummary}
              onClearSearch={() => categoryState.setSearchInput("")}
              onSearchChange={categoryState.setSearchInput}
              onSortChange={categoryState.setSortBy}
              onToggleFilters={() => categoryState.setIsFiltersPanelOpen((current) => !current)}
            />

            {categoryState.filteredProducts.length > 0 ? (
              <>
                <div className="atelier-category-product-grid">
                  {pagination.paginatedItems.map((product) => (
                    <WorkbookCategoryProductCard
                      fallbackHref={primaryCategoryRoute}
                      key={`${pageData.slug}-${product.position}-${product.name}`}
                      liveProduct={
                        categoryState.liveWorkbookProducts[
                          buildWorkbookCategoryProductLookupKey(product)
                        ]
                      }
                      product={product}
                    />
                  ))}
                </div>

                <PaginationControls
                  ariaLabel={`${pageData.navLabel || pageData.heroTitle} category pagination`}
                  currentPage={pagination.currentPage}
                  pageCount={pagination.pageCount}
                  onPageChange={pagination.goToPage}
                />
              </>
            ) : (
              <div className="empty-card category-empty-state">
                <span className="section-kicker">Filtered Empty State</span>
                <strong>No pieces match the current search or filter combination.</strong>
                <span>Clear one of the active filters or search terms to bring the grid back.</span>
              </div>
            )}
          </section>
        </div>
      </section>

      {pageData.storyTitle || pageData.storyImageUrl ? (
        <section className="atelier-category-story-surface">
          <div className="atelier-category-story-copy">
            <span className="atelier-category-filter-label">
              {pageData.storyEyebrow || "Editorial Story"}
            </span>
            <h2>{pageData.storyTitle || "Editorial Story"}</h2>
            <p>{storyBody}</p>

            {pageData.storyCtaLabel ? (
              <StorefrontActionLink
                className="atelier-category-story-link"
                fallbackHref={primaryCategoryRoute}
                href={pageData.storyCtaHref || primaryCategoryRoute}
              >
                {pageData.storyCtaLabel}
              </StorefrontActionLink>
            ) : null}
          </div>

          <div className="atelier-category-story-media">
            <img
              alt={pageData.storyImageAlt || pageData.storyTitle}
              decoding="async"
              loading="lazy"
              src={
                pageData.storyImageUrl ||
                getFallbackCategoryImage(pageData.slug, pageData.storyTitle || pageData.heroTitle)
              }
            />
          </div>
        </section>
      ) : null}

      <EditorialSignatureFooter
        brandName={content.footer.brandName}
        caption={content.footer.caption}
        links={content.footerLinks}
        note={footerNote}
      />
    </div>
  );
}

function WorkbookCategoryProductCard({
  product,
  liveProduct,
  fallbackHref,
}: {
  product: HomeWorkbookCategoryProduct;
  liveProduct?: Product;
  fallbackHref: string;
}) {
  const resolvedHref = liveProduct
    ? `/products/${encodeURIComponent(liveProduct.id)}`
    : resolveWorkbookProductHref(product, fallbackHref);
  const stockCopy = liveProduct
    ? liveProduct.stock > 0
      ? `${liveProduct.stock} còn lại`
      : "Hết hàng"
    : "Available in the collection";

  return (
    <StorefrontCollectionCard
      badge={product.badge}
      className="atelier-category-product-card"
      description={product.material}
      footer={
        <small
          className={
            liveProduct && liveProduct.stock === 0
              ? "atelier-category-product-stock atelier-category-product-stock-out"
              : "atelier-category-product-stock"
          }
        >
          {stockCopy}
        </small>
      }
      href={resolvedHref}
      imageAlt={product.imageAlt || liveProduct?.name || product.name}
      imageSrc={liveProduct?.image_urls[0] || liveProduct?.image_url || product.imageUrl}
      priceLabel={formatCurrency(liveProduct?.price ?? product.price)}
      title={liveProduct?.name ?? product.name}
      eyebrow={product.material}
    />
  );
}

function EditorialCategoryPage({
  content,
  pageData,
  products,
  feedback,
  isLoading,
  busyProductId,
  onAddToCart,
  onBuyNow,
}: {
  content: HomeWorkbookContent | null;
  pageData: StorefrontCategoryPageData;
  products: Product[];
  feedback: string;
  isLoading: boolean;
  busyProductId: string;
  onAddToCart: (product: Product) => Promise<void>;
  onBuyNow: (product: Product) => Promise<void>;
}) {
  const pagination = usePaginatedList(products, {
    pageSize: 12,
  });
  const footerNoteFallback =
    "An editorial storefront shaped for clear browsing, product discovery, and quick returns.";
  const heroSource = buildHeroSource(pageData);
  const featureSource = getSectionPayload(pageData.sections, [
    "feature-card",
    "feature-panel",
    "feature-spotlight",
    "story-block",
  ]);
  const heroProduct = products[0] ?? null;
  const featureProduct = products[1] ?? heroProduct;
  const featureImage = getFallbackCategoryImage(
    pageData.category.slug,
    pageData.category.display_name,
    readStringFromRecord(featureSource, "imageUrl", "image_url") ||
      featureProduct?.image_urls[0] ||
      featureProduct?.image_url
  );
  const heroTitle =
    readStringFromRecord(heroSource, "title", "heading") || pageData.category.display_name;
  const heroDescription =
    resolveStorefrontCopy(
      readStringFromRecord(heroSource, "description", "subtitle", "body"),
      `${pageData.category.display_name} selected for the current season.`
    );
  const heroBadge =
    readStringFromRecord(heroSource, "badge", "eyebrow") || pageData.category.nav_label;
  const featureTitle =
    readStringFromRecord(featureSource, "title", "heading", "panelTitle", "panel_title") ||
    featureProduct?.name ||
    `Curated ${pageData.category.nav_label}`;
  const featureDescription =
    resolveStorefrontCopy(
      readStringFromRecord(
        featureSource,
        "description",
        "body",
        "panelDescription",
        "panel_description"
      ) || featureProduct?.description,
      "A closer look at the textures, shapes, and signatures leading this collection."
    );
  const metrics = [
    {
      label: "Curated pieces",
      value: String(products.length),
      description: "Số sản phẩm đang tham gia layout editorial của collection hiện tại.",
    },
    {
      label: "Editorial moments",
      value: String(pageData.sections.length),
      description: "Các khối story, hero, và product grid được publish cho category page này.",
    },
    {
      label: "Price range",
      value:
        products.length > 0
          ? `${formatCurrency(
              Math.min(...products.map((product) => product.price))
            )} - ${formatCurrency(Math.max(...products.map((product) => product.price)))}`
          : "--",
      description: "Khoảng giá nhanh để đọc độ rộng merchandising của bộ sưu tập hiện tại.",
    },
  ];

  return (
    <div className="page-stack category-page">
      <section className="category-hero">
        <article className="category-hero-shell">
          <StorefrontOverlayHeader />

          <div className="category-hero-grid">
            <div className="category-hero-panel">
              <div className="category-hero-copy">
                <span className="section-kicker">{heroBadge || "Featured collection"}</span>
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
            </div>

            <StorefrontCollectionCard
              className="category-feature-card"
              description={featureDescription}
              href={heroProduct ? `/products/${heroProduct.id}` : "/products"}
              imageAlt={featureTitle}
              imageSrc={featureImage}
              title={featureTitle}
              eyebrow="Editorial pick"
            />
          </div>
        </article>
      </section>
      <section className="content-section category-results-section">
        <div className="section-heading category-results-head">
          <div>
            <span className="section-kicker">Collection Edit</span>
            <h2>{pageData.category.display_name}</h2>
          </div>
          <span className="category-results-caption">
            {products.length > 0
              ? `${pagination.pageStart}-${pagination.pageEnd} of ${products.length} curated pieces`
              : "Collection coming soon"}
          </span>
        </div>

        {feedback ? (
          <div
            className={products.length > 0 ? "feedback feedback-info" : "feedback feedback-error"}
          >
            {feedback}
          </div>
        ) : null}

        {isLoading ? (
          <div className="page-state">Đang tải bộ sưu tập...</div>
        ) : products.length > 0 ? (
          <>
            <div className="product-grid category-product-grid">
              {pagination.paginatedItems.map((product) => (
                <ProductCard
                  key={product.id}
                  busy={busyProductId === product.id}
                  onAddToCart={onAddToCart}
                  onBuyNow={onBuyNow}
                  product={product}
                  variant="archive"
                />
              ))}
            </div>

            <PaginationControls
              ariaLabel={`${pageData.category.display_name} pagination`}
              currentPage={pagination.currentPage}
              pageCount={pagination.pageCount}
              onPageChange={pagination.goToPage}
            />
          </>
        ) : (
          <div className="empty-card category-empty-state">
            <span className="section-kicker">Collection update</span>
            <strong>This collection is being refreshed.</strong>
            <Link className="text-link" to="/products">
              Quay lại archive
            </Link>
          </div>
        )}
      </section>

      <EditorialSignatureFooter
        brandName={content?.footer.brandName}
        caption={content?.footer.caption}
        links={content?.footerLinks}
        note={resolveStorefrontCopy(content?.footer.note, footerNoteFallback)}
      />
    </div>
  );
}
