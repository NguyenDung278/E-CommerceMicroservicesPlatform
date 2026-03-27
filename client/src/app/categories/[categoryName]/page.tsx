import { CatalogPage } from "@/components/catalog-page";

export default async function Page({
  params,
}: {
  params: Promise<{ categoryName: string }>;
}) {
  const { categoryName } = await params;
  return <CatalogPage initialCategory={decodeURIComponent(categoryName)} />;
}

