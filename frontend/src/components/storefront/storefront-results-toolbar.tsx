import type { Ref } from "react";

import "./storefront-results-toolbar.css";

type StorefrontSortOption<TSort extends string> = {
  label: string;
  value: TSort;
};

type StorefrontResultsToolbarProps<TSort extends string> = {
  resultLabel: string;
  searchInputId: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  sortId: string;
  sortValue: TSort;
  sortOptions: StorefrontSortOption<TSort>[];
  className?: string;
  filterPanelId?: string;
  filterPanelOpen?: boolean;
  filterToggleClassName?: string;
  filterToggleLabel?: string;
  filterToggleCount?: number;
  searchClearClassName?: string;
  searchInputRef?: Ref<HTMLInputElement>;
  summary?: string;
  onClearSearch?: () => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: TSort) => void;
  onToggleFilters?: () => void;
};

export function StorefrontResultsToolbar<TSort extends string>({
  resultLabel,
  searchInputId,
  searchLabel,
  searchPlaceholder,
  searchValue,
  sortId,
  sortValue,
  sortOptions,
  className,
  filterPanelId,
  filterPanelOpen = false,
  filterToggleClassName,
  filterToggleLabel = "Filters",
  filterToggleCount = 0,
  searchClearClassName,
  searchInputRef,
  summary,
  onClearSearch,
  onSearchChange,
  onSortChange,
  onToggleFilters,
}: StorefrontResultsToolbarProps<TSort>) {
  const filterButtonLabel =
    filterToggleCount > 0 ? `${filterToggleLabel} (${filterToggleCount})` : filterToggleLabel;

  return (
    <div
      className={
        className
          ? `storefront-results-toolbar-shell ${className}`
          : "storefront-results-toolbar-shell"
      }
    >
      <div className="storefront-results-toolbar">
        <span className="storefront-results-count">{resultLabel}</span>

        <div className="storefront-results-toolbar-controls">
          <div className="storefront-inline-search">
            <label className="storefront-inline-search-field" htmlFor={searchInputId}>
              <span className="sr-only">{searchLabel}</span>
              <input
                id={searchInputId}
                placeholder={searchPlaceholder}
                ref={searchInputRef}
                type="search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>
          </div>

          {searchValue && onClearSearch ? (
            <button
              className={
                searchClearClassName
                  ? `storefront-search-clear ${searchClearClassName}`
                  : "storefront-search-clear"
              }
              type="button"
              onClick={onClearSearch}
            >
              Clear
            </button>
          ) : null}

          <div className="storefront-sort-control">
            <span className="storefront-sort-control-label">
              <span>Sort</span>
              <span>By</span>
            </span>
            <label className="storefront-sort-control-field" htmlFor={sortId}>
              <select
                id={sortId}
                value={sortValue}
                onChange={(event) => onSortChange(event.target.value as TSort)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {onToggleFilters ? (
            <button
              aria-controls={filterPanelId}
              aria-expanded={filterPanelOpen}
              className={
                filterToggleClassName
                  ? `storefront-filters-toggle ${filterToggleClassName}`
                  : "storefront-filters-toggle"
              }
              type="button"
              onClick={onToggleFilters}
            >
              {filterButtonLabel}
            </button>
          ) : null}
        </div>
      </div>

      {summary ? <p className="storefront-results-summary">{summary}</p> : null}
    </div>
  );
}
