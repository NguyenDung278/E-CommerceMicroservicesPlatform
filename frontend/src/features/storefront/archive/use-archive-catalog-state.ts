import { startTransition, useEffect, useMemo, useState, type ChangeEvent } from "react";

import type { HomeWorkbookContent } from "@/features/home/home-workbook";
import { api, getErrorMessage } from "@/services/api";
import type {
  ProductSearchFacetValue,
  ProductSearchSuggestion,
} from "@/types/api";
import { formatCurrency } from "@/utils/format";
import type {
  ArchiveFilterSection,
  ArchiveItem,
  ArchivePriceRange,
  ArchiveSortOption,
} from "./archive-types";
import {
  archiveCategorySources,
  buildApiArchiveItem,
  buildArchiveIndexFromWorkbook,
  buildArchiveSearchPlaceholder,
  compareArchiveFacetValue,
  deriveArchiveStatusCopy,
  getArchiveFilterValues,
  hasArchiveFilterValue,
  normalizeArchiveText,
  sortArchiveItems,
} from "./archive-utils";

type UseArchiveCatalogStateOptions = {
  content: HomeWorkbookContent | null;
  searchQuery: string;
};

function parseArchivePrice(value: string) {
  const numericValue = Number.parseFloat(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return undefined;
  }

  return numericValue;
}

function buildFacetCountLookup(values: ProductSearchFacetValue[] | undefined) {
  return Object.fromEntries(
    (values ?? []).map((item) => [normalizeArchiveText(item.value), item.count] as const)
  );
}

function readAssistFacetValues(
  facets: Array<{ key: string; values: ProductSearchFacetValue[] }> | undefined,
  key: string
) {
  return facets?.find((facet) => normalizeArchiveText(facet.key) === normalizeArchiveText(key))
    ?.values;
}

function resolveArchiveCategoryLabel(identifier: string) {
  return (
    archiveCategorySources.find(
      (source) => normalizeArchiveText(source.identifier) === normalizeArchiveText(identifier)
    )?.label || identifier
  );
}

function buildFallbackArchiveItems(
  content: HomeWorkbookContent | null,
  searchInput: string,
  selectedCategory: string,
  selectedSize: string,
  selectedColor: string,
  priceRange: ArchivePriceRange,
  sortBy: ArchiveSortOption
) {
  const selectedCategoryLabel = selectedCategory ? resolveArchiveCategoryLabel(selectedCategory) : "";
  const normalizedSearch = normalizeArchiveText(searchInput);
  const minPrice = parseArchivePrice(priceRange.min);
  const maxPrice = parseArchivePrice(priceRange.max);
  const workbookItems = buildArchiveIndexFromWorkbook(content).workbookItems;

  const nextItems = workbookItems.filter((item) => {
    if (selectedCategoryLabel && item.categoryLabel !== selectedCategoryLabel) {
      return false;
    }

    if (selectedSize && !hasArchiveFilterValue(item.filterMap, "size", selectedSize)) {
      return false;
    }

    if (selectedColor && !hasArchiveFilterValue(item.filterMap, "color", selectedColor)) {
      return false;
    }

    if (normalizedSearch && !item.searchIndex.includes(normalizedSearch)) {
      return false;
    }

    if (typeof minPrice === "number" && item.price < minPrice) {
      return false;
    }

    if (typeof maxPrice === "number" && item.price > maxPrice) {
      return false;
    }

    return true;
  });

  return sortArchiveItems(nextItems, sortBy);
}

export function useArchiveCatalogState({
  content,
  searchQuery,
}: UseArchiveCatalogStateOptions) {
  const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>([]);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [sortBy, setSortBy] = useState<ArchiveSortOption>("merchandising");
  const [priceRange, setPriceRange] = useState<ArchivePriceRange>({ min: "", max: "" });
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<ProductSearchSuggestion[]>([]);
  const [assistResultCount, setAssistResultCount] = useState(0);
  const [sortOptions, setSortOptions] = useState<
    Array<{ label: string; value: ArchiveSortOption }>
  >([
    { label: "Merchandising edit", value: "merchandising" },
    { label: "Newest first", value: "latest" },
    { label: "Most wanted", value: "popular" },
    { label: "Price: Low to High", value: "price_asc" },
    { label: "Price: High to Low", value: "price_desc" },
  ]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [sizeCounts, setSizeCounts] = useState<Record<string, number>>({});
  const [colorCounts, setColorCounts] = useState<Record<string, number>>({});
  const [searchHint, setSearchHint] = useState("");
  const [openSections, setOpenSections] = useState<Record<ArchiveFilterSection, boolean>>({
    category: true,
    size: true,
    color: true,
    price: true,
  });

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    let active = true;

    void api
      .getProductSearchAssist({
        category: selectedCategory || undefined,
        limit: 8,
        query: searchInput.trim() || undefined,
        status: "active",
      })
      .then((response) => {
        if (!active) {
          return;
        }

        const categoryFacetValues = readAssistFacetValues(response.data.facets, "category");
        const sizeFacetValues = readAssistFacetValues(response.data.facets, "size");
        const colorFacetValues = readAssistFacetValues(response.data.facets, "color");

        setSearchSuggestions(
          response.data.suggestions.filter(
            (suggestion) =>
              normalizeArchiveText(suggestion.value) !== normalizeArchiveText(searchInput)
          )
        );
        setAssistResultCount(response.data.result_count);
        setSortOptions(
          response.data.sort_options
            .map((option) => ({
              label: option.label,
              value: option.value as ArchiveSortOption,
            }))
            .filter((option) =>
              ["latest", "price_asc", "price_desc", "popular", "merchandising"].includes(
                option.value
              )
            ).length > 0
            ? response.data.sort_options
                .map((option) => ({
                  label: option.label,
                  value: option.value as ArchiveSortOption,
                }))
                .filter((option) =>
                  ["latest", "price_asc", "price_desc", "popular", "merchandising"].includes(
                    option.value
                  )
                )
            : [
                { label: "Merchandising edit", value: "merchandising" as const },
                { label: "Newest first", value: "latest" as const },
                { label: "Most wanted", value: "popular" as const },
                { label: "Price: Low to High", value: "price_asc" as const },
                { label: "Price: High to Low", value: "price_desc" as const },
              ]
        );
        setCategoryCounts(buildFacetCountLookup(categoryFacetValues));
        setSizeCounts(buildFacetCountLookup(sizeFacetValues));
        setColorCounts(buildFacetCountLookup(colorFacetValues));

        if (response.data.applied_synonyms.length > 0) {
          setSearchHint(
            `Including related terms: ${response.data.applied_synonyms.join(", ")}.`
          );
          return;
        }

        if (
          response.data.resolved_query &&
          normalizeArchiveText(response.data.resolved_query) !== normalizeArchiveText(searchInput)
        ) {
          setSearchHint(`Showing related matches for "${response.data.resolved_query}".`);
          return;
        }

        setSearchHint("");
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setSearchSuggestions([]);
        setAssistResultCount(0);
        setCategoryCounts({});
        setSizeCounts({});
        setColorCounts({});
        setSearchHint("");
      });

    return () => {
      active = false;
    };
  }, [searchInput, selectedCategory]);

  useEffect(() => {
    let active = true;

    async function loadArchive() {
      setIsLoading(true);
      setFeedback("");

      try {
        const response = await api.listProducts({
          category: selectedCategory || undefined,
          color: selectedColor || undefined,
          limit: 96,
          maxPrice: parseArchivePrice(priceRange.max),
          minPrice: parseArchivePrice(priceRange.min),
          search: searchInput.trim() || undefined,
          size: selectedSize || undefined,
          sort: sortBy,
          status: "active",
        });

        if (!active) {
          return;
        }

        setArchiveItems(
          response.data.map((product, index) =>
            buildApiArchiveItem(product, product.category || "Archive", index)
          )
        );
      } catch (reason) {
        if (!active) {
          return;
        }

        setArchiveItems(
          buildFallbackArchiveItems(
            content,
            searchInput,
            selectedCategory,
            selectedSize,
            selectedColor,
            priceRange,
            sortBy
          )
        );
        setFeedback(getErrorMessage(reason));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadArchive();

    return () => {
      active = false;
    };
  }, [content, priceRange, searchInput, selectedCategory, selectedColor, selectedSize, sortBy]);

  const availableSizeOptions = useMemo(() => {
    const assistValues = Object.keys(sizeCounts);
    if (assistValues.length > 0) {
      return assistValues
        .map((value) => {
          const matchingValue = archiveItems
            .flatMap((item) => getArchiveFilterValues(item.filterMap, "size"))
            .find((item) => normalizeArchiveText(item) === value);
          return matchingValue || value.toUpperCase();
        })
        .sort(compareArchiveFacetValue);
    }

    const fallbackValues = new Set<string>();
    archiveItems.forEach((item) => {
      getArchiveFilterValues(item.filterMap, "size").forEach((size) => {
        if (size.trim()) {
          fallbackValues.add(size.trim());
        }
      });
    });

    return Array.from(fallbackValues.values()).sort(compareArchiveFacetValue);
  }, [archiveItems, sizeCounts]);

  const availableColorOptions = useMemo(() => {
    const assistValues = Object.keys(colorCounts);
    if (assistValues.length > 0) {
      return assistValues
        .map((value) => {
          const matchingValue = archiveItems
            .flatMap((item) => getArchiveFilterValues(item.filterMap, "color"))
            .find((item) => normalizeArchiveText(item) === value);
          return matchingValue || value;
        })
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
    }

    const fallbackValues = new Set<string>();
    archiveItems.forEach((item) => {
      getArchiveFilterValues(item.filterMap, "color").forEach((color) => {
        if (color.trim()) {
          fallbackValues.add(color.trim());
        }
      });
    });

    return Array.from(fallbackValues.values()).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: "base" })
    );
  }, [archiveItems, colorCounts]);

  const activeFilterCount = [
    searchInput,
    selectedCategory,
    selectedSize,
    selectedColor,
    priceRange.min,
    priceRange.max,
    sortBy !== "merchandising" ? sortBy : "",
  ].filter(Boolean).length;

  const resultCountLabel =
    !selectedSize &&
    !selectedColor &&
    !priceRange.min &&
    !priceRange.max &&
    assistResultCount > 0
      ? `Showing ${archiveItems.length} of ${assistResultCount} Products`
      : `Showing ${archiveItems.length} Products`;

  const statusCopy = deriveArchiveStatusCopy(archiveItems);
  const selectedSummary = [
    searchInput ? `Search: ${searchInput}` : "",
    selectedCategory ? `Category: ${resolveArchiveCategoryLabel(selectedCategory)}` : "",
    selectedSize ? `Size: ${selectedSize}` : "",
    selectedColor ? `Color: ${selectedColor}` : "",
    priceRange.min ? `Min: ${formatCurrency(Number(priceRange.min) || 0)}` : "",
    priceRange.max ? `Max: ${formatCurrency(Number(priceRange.max) || 0)}` : "",
  ]
    .filter(Boolean)
    .join(" / ");
  const searchPlaceholder = buildArchiveSearchPlaceholder(content);
  const categoryOptions = archiveCategorySources.map((source) => ({
    ...source,
    count: categoryCounts[normalizeArchiveText(source.identifier)] ?? 0,
  }));

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
      setSelectedCategory((current) => (current === nextCategory ? "" : nextCategory));
    });
  }

  function handleSizeSelection(nextSize: string) {
    startTransition(() => {
      setSelectedSize((current) => (current === nextSize ? "" : nextSize));
    });
  }

  function handleColorSelection(nextColor: string) {
    startTransition(() => {
      setSelectedColor((current) => (current === nextColor ? "" : nextColor));
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
      setSelectedColor("");
      setSortBy("merchandising");
      setPriceRange({ min: "", max: "" });
    });
  }

  return {
    activeFilterCount,
    archiveIndex: archiveItems,
    availableColorOptions,
    availableSizeOptions,
    categoryOptions,
    clearFilters,
    colorCounts,
    feedback,
    filteredItems: archiveItems,
    handleCategorySelection,
    handleColorSelection,
    handlePriceChange,
    handleSizeSelection,
    isFiltersPanelOpen,
    isLoading,
    openSections,
    priceRange,
    resultCountLabel,
    searchHint,
    searchInput,
    searchPlaceholder,
    searchSuggestions,
    selectedCategory,
    selectedColor,
    selectedSize,
    selectedSummary,
    setIsFiltersPanelOpen,
    setSearchInput,
    setSortBy,
    sizeCounts,
    sortBy,
    sortOptions,
    statusCopy,
    toggleFilterSection,
  };
}
