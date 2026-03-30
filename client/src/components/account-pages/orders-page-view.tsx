"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { AccountShell } from "@/components/account-shell";
import { StorefrontImage } from "@/components/storefront-image";
import {
  Badge,
  EmptyState,
  InlineAlert,
  LoadingScreen,
  StatusPill,
} from "@/components/storefront-ui";
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
} from "./shared";

export function OrdersPageView() {
  const { token } = useAuth();
  const { orders, isLoading, error } = useOrderPayments(token);
  const productLookup = useOrderProductLookup(orders);

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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm leading-7 text-on-surface-variant">
              Đang hiển thị toàn bộ <span className="font-semibold text-primary">{orders.length}</span> đơn hàng đã
              đồng bộ.
            </p>
            <Badge>Order archive</Badge>
          </div>

          <div className="grid gap-8">
            {orders.map((order) => (
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
                      <div>
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                          Total amount
                        </span>
                        <p className="mt-3 font-serif text-[2rem] font-semibold tracking-[-0.03em] text-primary">
                          {formatCurrency(order.total_price)}
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

          <div className="flex flex-col items-center gap-6 pt-4">
            <div className="h-px w-24 bg-outline-variant/30" />
            <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">
              Lịch sử đơn hàng được lấy trực tiếp từ order-service
            </p>
          </div>
        </div>
      )}
    </AccountShell>
  );
}
