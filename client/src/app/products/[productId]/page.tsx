import { ProductPage } from "@/components/product-page";
import { getProductPageInitialData } from "@/lib/server/storefront";

export default async function Page({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const initialData = await getProductPageInitialData(productId);

  return <ProductPage key={productId} productId={productId} initialData={initialData} />;
}
