import { OrderDetailPageView } from "@/components/account-pages";

export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <OrderDetailPageView orderId={orderId} />;
}

