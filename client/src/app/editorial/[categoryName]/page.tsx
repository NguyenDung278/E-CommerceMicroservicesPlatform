import { notFound } from "next/navigation";

import { AtelierCategoryPage } from "@/components/atelier-category-page";
import { getEditorialPageInitialData, isServerHttpStatus } from "@/lib/server/storefront";
import { buildAtelierNavItems, buildAtelierPageConfig } from "@/lib/storefront/editorial-adapter";

export default async function Page({
  params,
}: {
  params: Promise<{ categoryName: string }>;
}) {
  const { categoryName } = await params;
  const identifier = decodeURIComponent(categoryName);

  try {
    const { pageData, categories } = await getEditorialPageInitialData(identifier);
    return (
      <AtelierCategoryPage
        config={buildAtelierPageConfig(pageData)}
        navItems={buildAtelierNavItems(categories)}
      />
    );
  } catch (reason) {
    if (isServerHttpStatus(reason, 404)) {
      notFound();
    }
    throw reason;
  }
}
