import { CatalogPage } from "@/components/catalog-page";

export default async function CatalogRoute({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  const { department } = await searchParams;
  const initialDepartment =
    department &&
    ["men", "women", "footwear", "accessories", "living"].includes(department)
      ? (department as "men" | "women" | "footwear" | "accessories" | "living")
      : "all";

  return <CatalogPage key={initialDepartment} initialDepartment={initialDepartment} />;
}
