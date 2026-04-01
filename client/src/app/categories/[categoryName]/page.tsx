import { AtelierCategoryPage } from "@/components/atelier-category-page";
import { getAtelierPageConfig } from "@/components/atelier-page-data";
import { CatalogPage } from "@/components/catalog-page";
import { getCatalogPageInitialData } from "@/lib/server/storefront";
import { readCatalogPageQuery } from "@/lib/storefront/initial-data";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ categoryName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { categoryName } = await params;
  const resolvedSearchParams = await searchParams;
  const decodedCategoryName = decodeURIComponent(categoryName);
  const atelierPageConfig = getAtelierPageConfig(decodedCategoryName);

  if (atelierPageConfig) {
    return <AtelierCategoryPage config={atelierPageConfig} />;
  }

  const query = readCatalogPageQuery(resolvedSearchParams, decodedCategoryName);
  const initialData = query.savedOnly
    ? undefined
    : await getCatalogPageInitialData(query);

  return <CatalogPage initialCategory={decodedCategoryName} initialData={initialData} />;
}
