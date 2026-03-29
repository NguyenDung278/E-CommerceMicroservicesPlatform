import { AtelierCategoryPage } from "@/components/atelier-category-page";
import { getAtelierPageConfig } from "@/components/atelier-page-data";
import { CatalogPage } from "@/components/catalog-page";

export default async function Page({
  params,
}: {
  params: Promise<{ categoryName: string }>;
}) {
  const { categoryName } = await params;
  const decodedCategoryName = decodeURIComponent(categoryName);
  const atelierPageConfig = getAtelierPageConfig(decodedCategoryName);

  if (atelierPageConfig) {
    return <AtelierCategoryPage config={atelierPageConfig} />;
  }

  return <CatalogPage initialCategory={decodedCategoryName} />;
}
