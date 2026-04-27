"use client";

import { useAdminConsole } from "@/components/admin/admin-console-context";
import { canCancelOrder, orderStatusFilters, StatusPill } from "@/components/admin/admin-shared";
import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatDateTime,
  formatShortOrderId,
  formatStatusLabel,
} from "@/utils/format";

export function AdminOrdersPage() {
  const {
    orders,
    orderStatusFilter,
    setOrderStatusFilter,
    busyOrderId,
    cancelOrder,
  } = useAdminConsole();

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-4 rounded-[var(--radius-2xl)] border border-outline-variant bg-surface p-4 shadow-[var(--shadow-card)] md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Xử lý đơn hàng</p>
          <h2 className="mt-2 text-2xl font-semibold text-on-surface">Theo dõi 20 đơn gần nhất</h2>
        </div>

        <label className="grid gap-2 text-sm font-medium text-on-surface">
          Trạng thái
          <select
            className="commerce-input min-w-[220px]"
            value={orderStatusFilter}
            onChange={(event) => setOrderStatusFilter(event.target.value)}
          >
            {orderStatusFilters.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {orders.map((order) => (
          <article key={order.id} className="commerce-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-on-surface">{formatShortOrderId(order.id)}</p>
                <p className="mt-1 text-sm text-on-surface-variant">{formatDateTime(order.created_at)}</p>
              </div>
              <StatusPill status={order.status} />
            </div>

            <div className="mt-4 grid gap-2 text-sm text-on-surface-variant">
              <div className="flex justify-between gap-4">
                <span>Tổng tiền</span>
                <strong className="text-on-surface">{formatCurrency(order.total_price)}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Phương thức giao</span>
                <strong className="text-on-surface">{formatStatusLabel(order.shipping_method)}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Số dòng hàng</span>
                <strong className="text-on-surface">{order.items.length}</strong>
              </div>
            </div>

            <div className="mt-4 rounded-[var(--radius-lg)] bg-surface-container-low p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                Mặt hàng
              </p>
              <ul className="mt-2 grid gap-2 text-sm text-on-surface">
                {order.items.slice(0, 3).map((item) => (
                  <li key={item.id} className="flex justify-between gap-4">
                    <span className="line-clamp-1">{item.name}</span>
                    <strong>x{item.quantity}</strong>
                  </li>
                ))}
              </ul>
            </div>

            {canCancelOrder(order) ? (
              <button
                type="button"
                className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "mt-4")}
                disabled={busyOrderId === order.id}
                onClick={() => void cancelOrder(order)}
              >
                Hủy đơn
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
