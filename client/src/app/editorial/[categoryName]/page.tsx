import { notFound } from "next/navigation";

import { AtelierCategoryPage } from "@/components/storefront-pages/editorial/atelier-category-page";
import { getEditorialPageInitialData, isServerHttpStatus } from "@/lib/server/storefront";
import { buildAtelierNavItems, buildAtelierPageConfig } from "@/lib/storefront/editorial-adapter";

export default async function Page({
  params,
}: {
  params: Promise<{ categoryName: string }>;
}) {
  const { categoryName } = await params;
  const identifier = decodeURIComponent(categoryName);
  let pageData: Awaited<ReturnType<typeof getEditorialPageInitialData>>["pageData"];
  let categories: Awaited<ReturnType<typeof getEditorialPageInitialData>>["categories"];

  try {
    const initialData = await getEditorialPageInitialData(identifier);
    pageData = initialData.pageData;
    categories = initialData.categories;
  } catch (reason) {
    if (isServerHttpStatus(reason, 404)) {
      notFound();
    }
    throw reason;
  }

  return (
    <AtelierCategoryPage
      config={buildAtelierPageConfig(pageData)}
      navItems={buildAtelierNavItems(categories)}
    />
  );
}
