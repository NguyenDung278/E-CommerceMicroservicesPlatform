"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AccountShell } from "@/components/account-shared/account-shell";
import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
import {
  Badge,
  EmptyState,
  InlineAlert,
  LoadingScreen,
  StatusPill,
} from "@/components/storefront-shared/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { useOrderPayments } from "@/hooks/useOrderPayments";
import {
  formatCurrency,
  formatShippingMethodLabel,
  formatShortDate,
  formatShortOrderId,
} from "@/utils/format";

import {
  getLeadOrderItem,
  getOrderPreviewImage,
  useOrderProductLookup,
} from "@/components/account-shared/account-helpers";

export function OrdersPageView() {
  const { token } = useAuth();
  const { orders, isLoading, error } = useOrderPayments(token);
  const productLookup = useOrderProductLookup(orders);
  const [visibleCount, setVisibleCount] = useState(3);
  const visibleOrders = orders.slice(0, visibleCount);
  const hasMoreOrders = visibleCount < orders.length;
  const activeOrderCount = useMemo(
    () => orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length,
    [orders],
  );
  const deliveredOrderCount = useMemo(
    () => orders.filter((order) => order.status === "delivered").length,
    [orders],
  );

  return (
    <AccountShell
      title="Lịch sử đơn hàng"
      description="Xem lại toàn bộ đơn đã đặt, trạng thái hiện tại, mặt hàng đại diện và tổng tiền thanh toán trong bố cục bám sát visual language của Stitch."
    >
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      {isLoading ? (
        <LoadingScreen label="Đang tải lịch sử đơn hàng..." />
      ) : orders.length === 0 ? (
        <EmptyState
          title="Bạn chưa có đơn hàng nào"
          description="Hoàn tất checkout để order-service bắt đầu ghi nhận lịch sử mua sắm."
        />
      ) : (
        <div className="space-y-10">
          <div className="rounded-[2rem] border border-[#ddd5cc] bg-white/74 px-6 py-7 shadow-[0_28px_48px_-30px_rgba(27,28,25,0.16)] backdrop-blur md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge>Order archive</Badge>
                <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary md:text-4xl">
                  Order History
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-on-surface-variant md:text-base">
                  Review your past purchases and track current deliveries from the latest storefront sessions.
                </p>
              </div>
              <p className="text-sm leading-7 text-on-surface-variant">
                Showing <span className="font-semibold text-primary">{visibleOrders.length}</span> of{" "}
                <span className="font-semibold text-primary">{orders.length}</span> synchronized orders.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Active deliveries
                </p>
                <p className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                  {activeOrderCount}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Delivered
                </p>
                <p className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                  {deliveredOrderCount}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Archive visible
                </p>
                <p className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                  {visibleOrders.length}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-8">
            {visibleOrders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="group overflow-hidden rounded-[2rem] bg-surface-container-low transition duration-500 hover:bg-surface-container"
              >
                <div className="flex h-full flex-col md:flex-row">
                  <div className="relative h-64 w-full overflow-hidden md:w-64 md:shrink-0">
                    <StorefrontImage
                      alt={getLeadOrderItem(order)?.name || formatShortOrderId(order.id)}
                      src={getOrderPreviewImage(order, productLookup)}
                      fill
                      sizes="(min-width: 768px) 256px, 100vw"
                      className="object-cover transition duration-700 group-hover:scale-[1.05]"
                    />
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-6 md:p-8 lg:p-10">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                          Order reference
                        </span>
                        <h2 className="mt-3 font-serif text-[1.9rem] font-semibold tracking-[-0.03em] text-primary">
                          {formatShortOrderId(order.id)}
                        </h2>
                        <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                          {formatShortDate(order.created_at)} ·{" "}
                          {getLeadOrderItem(order)?.name || `${order.items.length} mặt hàng`}
                        </p>
                        <p className="text-sm leading-7 text-on-surface-variant">
                          {formatShippingMethodLabel(order.shipping_method)} · {order.items.length} mặt hàng
                        </p>
                      </div>

                      <StatusPill status={order.status} />
                    </div>

                    <div className="mt-8 flex items-end justify-between gap-4 border-t border-outline-variant/20 pt-6">
                      <div className="grid gap-2">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                          Total amount
                        </span>
                        <p className="mt-3 font-serif text-[2rem] font-semibold tracking-[-0.03em] text-primary">
                          {formatCurrency(order.total_price)}
                        </p>
                        <p className="text-sm leading-7 text-on-surface-variant">
                          {describeOrder(order)}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                        Xem chi tiết
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="flex flex-col items-center gap-4 pt-2">
            {hasMoreOrders ? (
              <button
                type="button"
                className="rounded-full border border-[#d7d0c7] px-5 py-3 text-sm font-medium text-primary transition hover:border-primary/30 hover:bg-[#f7f3ed]"
                onClick={() => setVisibleCount((current) => current + 3)}
              >
                Load More Orders
              </button>
            ) : null}
            <p className="text-sm leading-7 text-on-surface-variant">
              Showing {visibleOrders.length} of {orders.length} orders
            </p>
            <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">
              Lịch sử đơn hàng được lấy trực tiếp từ order-service
            </p>
          </div>
        </div>
      )}
    </AccountShell>
  );
}

function describeOrder(order: { items: Array<{ name: string; quantity: number }> }) {
  const firstItemName = order.items[0]?.name;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  if (!firstItemName) {
    return `${itemCount || order.items.length || 1} item prepared for delivery.`;
  }

  if (itemCount <= 1) {
    return firstItemName;
  }

  return `${firstItemName} and ${itemCount - 1} more ${itemCount - 1 === 1 ? "item" : "items"}.`;
}
