import { HomePage } from "@/components/storefront-pages/home-page";
import { getHomePageInitialData } from "@/lib/server/storefront";

export default async function Page() {
  const initialData = await getHomePageInitialData();

  return <HomePage initialData={initialData} />;
}
