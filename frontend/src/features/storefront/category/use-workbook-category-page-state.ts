import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { HomeWorkbookCategoryPage } from "@/features/home/home-workbook";
import type { Product } from "@/types/api";

import type { WorkbookCategorySortOption } from "./category-page-utils";
import {
  buildInitialFilterState,
  buildInitialWorkbookSectionState,
  buildWorkbookProductSearchIndex,
  formatResultsLabel,
  loadWorkbookLiveProducts,
  matchesWorkbookProductFilters,
  sortWorkbookCategoryProducts,
} from "./category-page-utils";

type UseWorkbookCategoryPageStateResult = {
  activeFilterCount: number;
  activeFilterSummary: string;
  activeFilters: Record<string, string>;
  clearWorkbookFilters: () => void;
  filteredProducts: HomeWorkbookCategoryPage["products"];
  liveWorkbookProducts: Record<string, Product>;
  openSections: Record<string, boolean>;
  resultsLabel: string;
  searchInput: string;
  searchPlaceholder: string;
  setIsFiltersPanelOpen: Dispatch<SetStateAction<boolean>>;
  setSearchInput: Dispatch<SetStateAction<string>>;
  setSortBy: Dispatch<SetStateAction<WorkbookCategorySortOption>>;
  sortBy: WorkbookCategorySortOption;
  toggleWorkbookSection: (filterKey: string) => void;
  toggleWorkbookFilter: (filterKey: string, option: string) => void;
  isFiltersPanelOpen: boolean;
};

export function useWorkbookCategoryPageState(
  pageData: HomeWorkbookCategoryPage
): UseWorkbookCategoryPageStateResult {
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(() =>
    buildInitialFilterState(pageData)
  );
  const [searchInput, setSearchInput] = useState("");
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);
  const [sortBy, setSortBy] = useState<WorkbookCategorySortOption>("latest");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    buildInitialWorkbookSectionState(pageData)
  );
  const [liveWorkbookProducts, setLiveWorkbookProducts] = useState<Record<string, Product>>({});

  useEffect(() => {
    setActiveFilters(buildInitialFilterState(pageData));
    setSearchInput("");
    setIsFiltersPanelOpen(false);
    setSortBy("latest");
    setOpenSections(buildInitialWorkbookSectionState(pageData));
    setLiveWorkbookProducts({});
  }, [pageData]);

  useEffect(() => {
    let active = true;

    if (pageData.products.length === 0) {
      setLiveWorkbookProducts({});
      return () => {
        active = false;
      };
    }

    async function hydrateLiveProducts() {
      const nextLookup = await loadWorkbookLiveProducts(pageData);

      if (active) {
        setLiveWorkbookProducts(nextLookup);
      }
    }

    void hydrateLiveProducts().catch(() => {
      if (active) {
        setLiveWorkbookProducts({});
      }
    });

    return () => {
      active = false;
    };
  }, [pageData]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchInput.trim().toLowerCase();

    const nextProducts = pageData.products.filter((product) => {
      if (!matchesWorkbookProductFilters(product, activeFilters)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return buildWorkbookProductSearchIndex(product).includes(normalizedSearch);
    });

    return sortWorkbookCategoryProducts(nextProducts, sortBy);
  }, [activeFilters, pageData.products, searchInput, sortBy]);

  const activeFilterCount =
    Object.values(activeFilters).filter(Boolean).length + (searchInput ? 1 : 0);
  const activeFilterSummary = [
    searchInput ? `Search: ${searchInput}` : "",
    ...pageData.filters
      .map((filter) =>
        activeFilters[filter.filterKey] ? `${filter.label}: ${activeFilters[filter.filterKey]}` : ""
      )
      .filter(Boolean),
  ].join(" / ");

  function clearWorkbookFilters() {
    startTransition(() => {
      setSearchInput("");
      setActiveFilters(buildInitialFilterState(pageData));
    });
  }

  function toggleWorkbookSection(filterKey: string) {
    startTransition(() => {
      setOpenSections((current) => ({
        ...current,
        [filterKey]: !current[filterKey],
      }));
    });
  }

  function toggleWorkbookFilter(filterKey: string, option: string) {
    const isResetOption = option.trim().toLowerCase().startsWith("all");

    startTransition(() => {
      setActiveFilters((current) => {
        const nextFilters = { ...current };

        if (current[filterKey] === option || isResetOption) {
          delete nextFilters[filterKey];
          return nextFilters;
        }

        nextFilters[filterKey] = option;
        return nextFilters;
      });
    });
  }

  return {
    activeFilterCount,
    activeFilterSummary,
    activeFilters,
    clearWorkbookFilters,
    filteredProducts,
    isFiltersPanelOpen,
    liveWorkbookProducts,
    openSections,
    resultsLabel: formatResultsLabel(pageData.resultsLabel, filteredProducts.length),
    searchInput,
    searchPlaceholder: `Search ${pageData.navLabel || pageData.heroTitle}`,
    setIsFiltersPanelOpen,
    setSearchInput,
    setSortBy,
    sortBy,
    toggleWorkbookFilter,
    toggleWorkbookSection,
  };
}
