import { useSearchParams } from "react-router-dom";

import {
  EditorialSignatureFooter,
  PaginationControls,
  StorefrontCollectionCard,
  StorefrontFilterSection,
  StorefrontOverlayHeader,
  StorefrontResultsToolbar,
} from "@/components";
import { useHomeWorkbook } from "@/features/home/use-home-workbook";
import { useArchiveCatalogState } from "@/features/storefront/archive/use-archive-catalog-state";
import { usePaginatedList } from "@/features/storefront/listing/use-paginated-list";
import { resolveStorefrontCopy } from "@/features/storefront/storefront-copy";
import { formatCurrency } from "@/utils/format";
import "@/styles/pages/storefront/catalog-page.css";

export function CatalogPage() {
  const [searchParams] = useSearchParams();
  const { content } = useHomeWorkbook();
  const archiveState = useArchiveCatalogState({
    content,
    searchQuery: searchParams.get("search") ?? "",
  });
  const archivePagination = usePaginatedList(archiveState.filteredItems, {
    pageSize: 12,
  });
  const activeSummary =
    archiveState.selectedSummary ||
    (archiveState.activeFilterCount > 0
      ? `${archiveState.activeFilterCount} filters active`
      : undefined);
  const footerNoteFallback =
    "An editorial storefront shaped for clear browsing, product discovery, and quick returns.";

  return (
    <div className="archive-shell">
      <section className="archive-hero">
        <div className="archive-hero-surface">
          <StorefrontOverlayHeader tone="light" />

          <header className="archive-editorial-header">
            <div className="archive-editorial-copy">
              <span className="archive-editorial-kicker">Seasonal Archive</span>
              <h1>The Curated Archive</h1>
              <p>
                Tailoring, knitwear, footwear, and accessories gathered into one calm, searchable
                edit.
              </p>
            </div>
          </header>
        </div>
      </section>

      <div className="archive-layout">
        <aside
          className={
            archiveState.isFiltersPanelOpen
              ? "archive-sidebar archive-sidebar-open"
              : "archive-sidebar"
          }
          id="archive-filters-panel"
        >
          <StorefrontFilterSection
            expanded={archiveState.openSections.category}
            summary={archiveState.selectedCategory || "All Archive"}
            title="CATEGORY"
            onToggle={() => archiveState.toggleFilterSection("category")}
          >
            <div className="archive-collection-list">
              <button
                className={
                  !archiveState.selectedCategory
                    ? "archive-collection-link archive-collection-link-active"
                    : "archive-collection-link"
                }
                type="button"
                onClick={() => archiveState.handleCategorySelection("")}
              >
                All Archive
                {archiveState.archiveIndex.length > 0 ? (
                  <span className="archive-option-count">{archiveState.archiveIndex.length}</span>
                ) : null}
              </button>

              {archiveState.categoryOptions.map((source) => (
                <button
                  className={
                    archiveState.selectedCategory === source.identifier
                      ? "archive-collection-link archive-collection-link-active"
                      : "archive-collection-link"
                  }
                  key={source.identifier}
                  type="button"
                  onClick={() => archiveState.handleCategorySelection(source.identifier)}
                >
                  {source.label}
                  {source.count > 0 ? (
                    <span className="archive-option-count">{source.count}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </StorefrontFilterSection>

          <StorefrontFilterSection
            expanded={archiveState.openSections.size}
            summary={archiveState.selectedSize || "All sizes"}
            title="SIZE"
            onToggle={() => archiveState.toggleFilterSection("size")}
          >
            {archiveState.availableSizeOptions.length > 0 ? (
              <div className="archive-size-grid">
                {archiveState.availableSizeOptions.map((size) => (
                  <button
                    className={
                      archiveState.selectedSize === size
                        ? "archive-size-button archive-size-button-active"
                        : "archive-size-button"
                    }
                    key={size}
                    type="button"
                    onClick={() => archiveState.handleSizeSelection(size)}
                  >
                    {size}
                    {(archiveState.sizeCounts[size.toLowerCase()] ?? 0) > 0 ? (
                      <span className="archive-option-count">
                        {archiveState.sizeCounts[size.toLowerCase()]}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <p className="archive-filter-empty">
                Size options will appear here as soon as collection metadata is available.
              </p>
            )}
          </StorefrontFilterSection>

          <StorefrontFilterSection
            expanded={archiveState.openSections.color}
            summary={archiveState.selectedColor || "All colors"}
            title="COLOR"
            onToggle={() => archiveState.toggleFilterSection("color")}
          >
            {archiveState.availableColorOptions.length > 0 ? (
              <div className="archive-collection-list">
                {archiveState.availableColorOptions.map((color) => (
                  <button
                    className={
                      archiveState.selectedColor === color
                        ? "archive-collection-link archive-collection-link-active"
                        : "archive-collection-link"
                    }
                    key={color}
                    type="button"
                    onClick={() => archiveState.handleColorSelection(color)}
                  >
                    {color}
                    {(archiveState.colorCounts[color.toLowerCase()] ?? 0) > 0 ? (
                      <span className="archive-option-count">
                        {archiveState.colorCounts[color.toLowerCase()]}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <p className="archive-filter-empty">
                Color options will appear here as soon as search facets are available.
              </p>
            )}
          </StorefrontFilterSection>

          <StorefrontFilterSection
            expanded={archiveState.openSections.price}
            summary={
              archiveState.priceRange.min || archiveState.priceRange.max
                ? `${archiveState.priceRange.min || "0"} - ${archiveState.priceRange.max || "Any"}`
                : "Any price"
            }
            title="PRICE RANGE"
            onToggle={() => archiveState.toggleFilterSection("price")}
          >
            <div className="archive-value-grid">
              <label className="archive-value-field">
                <span>Min</span>
                <input
                  inputMode="decimal"
                  placeholder="150"
                  value={archiveState.priceRange.min}
                  onChange={(event) => archiveState.handlePriceChange("min", event)}
                />
              </label>

              <label className="archive-value-field">
                <span>Max</span>
                <input
                  inputMode="decimal"
                  placeholder="2500"
                  value={archiveState.priceRange.max}
                  onChange={(event) => archiveState.handlePriceChange("max", event)}
                />
              </label>
            </div>
          </StorefrontFilterSection>

          <button
            className="archive-reset-button"
            type="button"
            onClick={archiveState.clearFilters}
          >
            Reset Filters
          </button>

          <div className="archive-service-note">
            <span>Collection Focus</span>
            <strong>Four signature edits</strong>
            <p>{archiveState.statusCopy}</p>
          </div>
        </aside>

        <section className="archive-results">
          <StorefrontResultsToolbar
            className="archive-results-toolbar-shell"
            filterPanelId="archive-filters-panel"
            filterPanelOpen={archiveState.isFiltersPanelOpen}
            filterToggleClassName="archive-filters-toggle"
            filterToggleCount={archiveState.activeFilterCount}
            resultLabel={archiveState.resultCountLabel}
            searchClearClassName="archive-search-clear"
            searchInputId="archive-search"
            searchSuggestions={archiveState.searchSuggestions}
            searchHint={archiveState.searchHint}
            searchLabel="Search across archive categories"
            searchPlaceholder={archiveState.searchPlaceholder}
            searchValue={archiveState.searchInput}
            sortId="archive-sort"
            sortOptions={archiveState.sortOptions}
            sortValue={archiveState.sortBy}
            summary={activeSummary}
            onClearSearch={() => archiveState.setSearchInput("")}
            onSearchChange={archiveState.setSearchInput}
            onSelectSearchSuggestion={(suggestion) => archiveState.setSearchInput(suggestion)}
            onSortChange={archiveState.setSortBy}
            onToggleFilters={() => archiveState.setIsFiltersPanelOpen((current) => !current)}
          />

          {archiveState.feedback ? (
            <div className="feedback feedback-info">{archiveState.feedback}</div>
          ) : null}

          {archiveState.isLoading ? (
            <div className="page-state">Loading the archive...</div>
          ) : archiveState.filteredItems.length > 0 ? (
            <>
              <div className="archive-product-grid">
                {archivePagination.paginatedItems.map((item) => {
                  return (
                    <StorefrontCollectionCard
                      badge={item.badge}
                      className="archive-editorial-card"
                      description={item.subtitle}
                      href={item.href}
                      imageAlt={item.imageAlt || item.name}
                      imageSrc={item.imageUrl}
                      key={item.id}
                      priceLabel={formatCurrency(item.price)}
                      title={item.name}
                      eyebrow={item.badge || item.categoryLabel}
                    />
                  );
                })}
              </div>

              <PaginationControls
                ariaLabel="Archive product pagination"
                currentPage={archivePagination.currentPage}
                pageCount={archivePagination.pageCount}
                onPageChange={archivePagination.goToPage}
              />
            </>
          ) : archiveState.feedback ? null : (
            <div className="empty-card catalog-empty-state archive-empty-state">
              <strong>No pieces match the current selection.</strong>
              <span>Clear a filter or widen the price range to bring the full archive back.</span>
              <button className="ghost-button" type="button" onClick={archiveState.clearFilters}>
                Reset Filters
              </button>
            </div>
          )}
        </section>
      </div>

      <EditorialSignatureFooter
        brandName={content?.footer.brandName}
        caption={content?.footer.caption}
        links={content?.footerLinks}
        note={resolveStorefrontCopy(content?.footer.note, footerNoteFallback)}
      />
    </div>
  );
}
