import type { HomeWorkbookCategoryPage, HomeWorkbookCategoryProduct } from "@/features/home/home-workbook";

export type ArchiveCategorySource = {
  label: string;
  identifier: string;
};

export type ArchiveFilterSection = "category" | "size" | "color" | "price";

export type ArchiveFilterMap = Record<string, string[]>;

export type ArchiveSortOption =
  | "latest"
  | "price_asc"
  | "price_desc"
  | "popular"
  | "merchandising";

export type ArchiveItem = {
  id: string;
  productId?: string;
  name: string;
  price: number;
  imageUrl: string;
  imageAlt: string;
  href: string;
  categoryLabel: string;
  badge: string;
  subtitle: string;
  searchIndex: string;
  sequence: number;
  filterMap: ArchiveFilterMap;
};

export type ArchivePriceRange = {
  min: string;
  max: string;
};

export type BuildWorkbookArchiveItemInput = {
  categoryLabel: string;
  categoryPage: HomeWorkbookCategoryPage;
  product: HomeWorkbookCategoryProduct;
  sequence: number;
};
