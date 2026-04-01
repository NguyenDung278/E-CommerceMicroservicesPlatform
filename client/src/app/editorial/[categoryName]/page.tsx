import { notFound } from "next/navigation";

import { AtelierCategoryPage } from "@/components/atelier-category-page";
import { getAtelierPageConfig } from "@/components/atelier-page-data";

export default async function Page({
  params,
}: {
  params: Promise<{ categoryName: string }>;
}) {
  const { categoryName } = await params;
  const config = getAtelierPageConfig(decodeURIComponent(categoryName));

  if (!config) {
    notFound();
  }

  return <AtelierCategoryPage config={config} />;
}
