"use client";

import { cn } from "@/lib/utils";
import type { CatalogSortMode } from "@/lib/storefront/initial-data";

import { catalogSortOptions } from "@/components/storefront/catalog/catalog-shared";

export function CatalogFilters({
  search,
  selectedCategory,
  sortMode,
  categories,
  onSearchChange,
  onCategoryChange,
  onSortChange,
}: {
  search: string;
  selectedCategory: string;
  sortMode: CatalogSortMode;
  categories: string[];
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: CatalogSortMode) => void;
}) {
  return (
    <>
      <div className="grid gap-4 rounded-[var(--radius-2xl)] border border-outline-variant bg-surface p-4 shadow-[var(--shadow-card)] md:grid-cols-[minmax(0,1fr)_220px] xl:grid-cols-[minmax(0,1fr)_220px_220px]">
        <label className="grid gap-2 text-sm font-medium text-on-surface">
          Tìm sản phẩm
          <input
            className="commerce-input"
            placeholder="Tên, SKU, mô tả hoặc tag"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-on-surface">
          Danh mục
          <select
            className="commerce-input"
            value={selectedCategory}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-on-surface">
          Sắp xếp
          <select
            className="commerce-input"
            value={sortMode}
            onChange={(event) => onSortChange(event.target.value as CatalogSortMode)}
          >
            {catalogSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          className={cn("commerce-chip", !selectedCategory && "commerce-chip-active")}
          onClick={() => onCategoryChange("")}
        >
          Tất cả
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={cn("commerce-chip", selectedCategory === category && "commerce-chip-active")}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </div>
    </>
  );
}
