import { ReturnDetailPageView } from "@/components/account-pages";

export default async function Page({
  params,
}: {
  params: Promise<{ returnId: string }>;
}) {
  const { returnId } = await params;
  return <ReturnDetailPageView returnId={returnId} />;
}
