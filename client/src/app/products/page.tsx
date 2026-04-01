import { CatalogPage } from "@/components/catalog-page";
import { getCatalogPageInitialData } from "@/lib/server/storefront";
import { readCatalogPageQuery } from "@/lib/storefront/initial-data";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = readCatalogPageQuery(resolvedSearchParams);
  const initialData = query.savedOnly
    ? undefined
    : await getCatalogPageInitialData(query);

  return <CatalogPage initialData={initialData} />;
}
