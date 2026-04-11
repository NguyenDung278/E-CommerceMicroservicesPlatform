import { startTransition, useEffect, useMemo, useState, type ChangeEvent } from "react";

import type { HomeWorkbookContent } from "@/features/home/home-workbook";
import { loadWorkbookLiveProductLookup } from "@/features/home/workbook-live-products";
import { findHomeWorkbookCategoryPage } from "@/features/home/home-workbook";
import { getErrorMessage } from "@/services/api";
import type { Product } from "@/types/api";
import { formatCurrency } from "@/utils/format";
import type {
  ArchiveFilterSection,
  ArchiveItem,
  ArchivePriceRange,
  ArchiveSortOption,
} from "./archive-types";
import {
  archiveCategorySources,
  buildArchiveIndexFromWorkbook,
  buildArchiveSearchPlaceholder,
  compareArchiveFacetValue,
  deriveArchiveStatusCopy,
  getArchiveFilterValues,
  hasArchiveFilterValue,
  loadCategoryArchiveItems,
  normalizeArchiveText,
  sortArchiveItems,
} from "./archive-utils";

type UseArchiveCatalogStateOptions = {
  content: HomeWorkbookContent | null;
  searchQuery: string;
  workbookStatus: string;
};

export function useArchiveCatalogState({
  content,
  searchQuery,
  workbookStatus,
}: UseArchiveCatalogStateOptions) {
  const [archiveIndex, setArchiveIndex] = useState<ArchiveItem[]>([]);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [sortBy, setSortBy] = useState<ArchiveSortOption>("latest");
  const [priceRange, setPriceRange] = useState<ArchivePriceRange>({ min: "", max: "" });
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);
  const [liveArchiveProducts, setLiveArchiveProducts] = useState<Record<string, Product>>({});
  const [openSections, setOpenSections] = useState<Record<ArchiveFilterSection, boolean>>({
    category: true,
    size: true,
    price: true,
  });

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!content && (workbookStatus === "loading" || workbookStatus === "refreshing")) {
      setIsLoading(true);
      return undefined;
    }

    let active = true;

    async function loadArchive() {
      setIsLoading(true);
      setFeedback("");

      const { workbookItems, missingSources } = buildArchiveIndexFromWorkbook(content);
      const fallbackItemGroups = await Promise.all(
        missingSources.map((source, sourceIndex) =>
          loadCategoryArchiveItems(source, (archiveCategorySources.length + sourceIndex) * 100)
        )
      );

      if (!active) {
        return;
      }

      setArchiveIndex([...workbookItems, ...fallbackItemGroups.flat()]);
      setFeedback("");
      setIsLoading(false);
    }

    void loadArchive().catch((reason) => {
      if (!active) {
        return;
      }

      setArchiveIndex([]);
      setFeedback(getErrorMessage(reason));
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [content, workbookStatus]);

  useEffect(() => {
    let active = true;

    if (archiveIndex.length === 0) {
      setLiveArchiveProducts({});
      return () => {
        active = false;
      };
    }

    async function hydrateLiveArchiveProducts() {
      const nextLookup = await loadWorkbookLiveProductLookup({
        entries: archiveIndex.map((item) => ({
          lookupKey: item.id,
          productId: item.productId,
          name: item.name,
          categoryLabel: item.categoryLabel,
          href: item.href,
        })),
      });

      if (active) {
        setLiveArchiveProducts(nextLookup);
      }
    }

    void hydrateLiveArchiveProducts().catch(() => {
      if (active) {
        setLiveArchiveProducts({});
      }
    });

    return () => {
      active = false;
    };
  }, [archiveIndex]);

  const availableSizeOptions = useMemo(() => {
    const sizeOptions = new Map<string, string>();

    archiveCategorySources.forEach((source) => {
      const categoryPage = content
        ? findHomeWorkbookCategoryPage(content, source.identifier)
        : null;

      if (!categoryPage) {
        return;
      }

      categoryPage.filters.forEach((filter) => {
        if (normalizeArchiveText(filter.filterKey) !== "size") {
          return;
        }

        filter.options.forEach((option) => {
          const trimmedOption = option.trim();
          if (!trimmedOption) {
            return;
          }

          sizeOptions.set(normalizeArchiveText(trimmedOption), trimmedOption);
        });
      });
    });

    archiveIndex.forEach((item) => {
      getArchiveFilterValues(item.filterMap, "size").forEach((size) => {
        const trimmedSize = size.trim();
        if (!trimmedSize) {
          return;
        }

        sizeOptions.set(normalizeArchiveText(trimmedSize), trimmedSize);
      });
    });

    return Array.from(sizeOptions.values()).sort(compareArchiveFacetValue);
  }, [archiveIndex, content]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = normalizeArchiveText(searchInput);
    const minPrice = Number.parseFloat(priceRange.min);
    const maxPrice = Number.parseFloat(priceRange.max);

    const nextItems = archiveIndex.filter((item) => {
      if (selectedCategory && item.categoryLabel !== selectedCategory) {
        return false;
      }

      if (selectedSize && !hasArchiveFilterValue(item.filterMap, "size", selectedSize)) {
        return false;
      }

      if (normalizedSearch && !item.searchIndex.includes(normalizedSearch)) {
        return false;
      }

      if (Number.isFinite(minPrice) && minPrice > 0 && item.price < minPrice) {
        return false;
      }

      if (Number.isFinite(maxPrice) && maxPrice > 0 && item.price > maxPrice) {
        return false;
      }

      return true;
    });

    return sortArchiveItems(nextItems, sortBy);
  }, [
    archiveIndex,
    priceRange.max,
    priceRange.min,
    searchInput,
    selectedCategory,
    selectedSize,
    sortBy,
  ]);

  const activeFilterCount = [
    searchInput,
    selectedCategory,
    selectedSize,
    priceRange.min,
    priceRange.max,
    sortBy !== "latest" ? sortBy : "",
  ].filter(Boolean).length;
  const resultCountLabel = `Showing ${filteredItems.length} of ${
    archiveIndex.length || filteredItems.length
  } Products`;
  const statusCopy = deriveArchiveStatusCopy(archiveIndex);
  const selectedSummary = [
    searchInput ? `Search: ${searchInput}` : "",
    selectedCategory ? `Category: ${selectedCategory}` : "",
    selectedSize ? `Size: ${selectedSize}` : "",
    priceRange.min ? `Min: ${formatCurrency(Number(priceRange.min) || 0)}` : "",
    priceRange.max ? `Max: ${formatCurrency(Number(priceRange.max) || 0)}` : "",
  ]
    .filter(Boolean)
    .join(" / ");
  const searchPlaceholder = buildArchiveSearchPlaceholder(content);

  function toggleFilterSection(section: ArchiveFilterSection) {
    startTransition(() => {
      setOpenSections((current) => ({
        ...current,
        [section]: !current[section],
      }));
    });
  }

  function handleCategorySelection(nextCategory: string) {
    startTransition(() => {
      setSelectedCategory(nextCategory);
    });
  }

  function handleSizeSelection(nextSize: string) {
    startTransition(() => {
      setSelectedSize((current) => (current === nextSize ? "" : nextSize));
    });
  }

  function handlePriceChange(field: keyof ArchivePriceRange, event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.replace(/[^\d.]/g, "");
    setPriceRange((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    startTransition(() => {
      setSearchInput("");
      setSelectedCategory("");
      setSelectedSize("");
      setSortBy("latest");
      setPriceRange({ min: "", max: "" });
    });
  }

  return {
    activeFilterCount,
    archiveIndex,
    availableSizeOptions,
    clearFilters,
    feedback,
    filteredItems,
    handleCategorySelection,
    handlePriceChange,
    handleSizeSelection,
    isFiltersPanelOpen,
    isLoading,
    liveArchiveProducts,
    openSections,
    priceRange,
    resultCountLabel,
    searchInput,
    searchPlaceholder,
    selectedCategory,
    selectedSize,
    selectedSummary,
    setIsFiltersPanelOpen,
    setSearchInput,
    setSortBy,
    sortBy,
    statusCopy,
    toggleFilterSection,
  };
}
