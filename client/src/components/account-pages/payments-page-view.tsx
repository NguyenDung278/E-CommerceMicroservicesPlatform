"use client";

import { Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { AccountShell } from "@/components/account-shell";
import {
  Badge,
  EmptyState,
  InlineAlert,
  LoadingScreen,
  StatusPill,
  SurfaceCard,
} from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { useOrderPayments } from "@/hooks/useOrderPayments";
import { buttonStyles } from "@/lib/button-styles";
import {
  formatCurrency,
  formatDateTime,
  formatShortDate,
  formatShortOrderId,
  humanizeToken,
} from "@/utils/format";

import { getNetPaidAmount, getPaymentMethodIcon } from "./shared";

type PaymentMethodCard = {
  key: string;
  paymentMethod: string;
  gatewayProvider: string;
  lastUsedAt: string;
  usageCount: number;
  totalAmount: number;
};

export function PaymentsPageView() {
  const { token } = useAuth();
  const { orders, paymentsByOrder, isLoading, error } = useOrderPayments(token);

  const paymentEntries = useMemo(
    () =>
      orders
        .flatMap((order) => (paymentsByOrder[order.id] ?? []).map((payment) => ({ payment, order })))
        .sort((left, right) => Date.parse(right.payment.created_at) - Date.parse(left.payment.created_at)),
    [orders, paymentsByOrder],
  );
  const paymentMethodCards = useMemo(() => {
    const paymentMethodMap = new Map<string, PaymentMethodCard>();

    paymentEntries.forEach(({ payment }) => {
      const key = `${payment.payment_method}:${payment.gateway_provider}`;
      const existingEntry = paymentMethodMap.get(key);

      if (existingEntry) {
        existingEntry.usageCount += 1;
        existingEntry.totalAmount += payment.amount;
        if (Date.parse(payment.created_at) > Date.parse(existingEntry.lastUsedAt)) {
          existingEntry.lastUsedAt = payment.created_at;
        }
        return;
      }

      paymentMethodMap.set(key, {
        key,
        paymentMethod: payment.payment_method,
        gatewayProvider: payment.gateway_provider,
        lastUsedAt: payment.created_at,
        usageCount: 1,
        totalAmount: payment.amount,
      });
    });

    return Array.from(paymentMethodMap.values()).sort((left, right) => {
      if (right.usageCount !== left.usageCount) {
        return right.usageCount - left.usageCount;
      }
      return Date.parse(right.lastUsedAt) - Date.parse(left.lastUsedAt);
    });
  }, [paymentEntries]);

  const totalPaid = getNetPaidAmount(paymentsByOrder);

  return (
    <AccountShell
      title="Lịch sử thanh toán"
      description="Tổng hợp giao dịch, phương thức thanh toán đã dùng và billing history theo đúng dữ liệu từ payment-service."
    >
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      {isLoading ? (
        <LoadingScreen label="Đang tải lịch sử thanh toán..." />
      ) : paymentEntries.length === 0 ? (
        <EmptyState
          title="Chưa có giao dịch nào"
          description="Sau khi thanh toán thành công, payment records sẽ xuất hiện tại đây."
        />
      ) : (
        <div className="space-y-12">
          <section className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge className="bg-secondary text-on-secondary">Secure billing</Badge>
                <div className="mt-4 space-y-2">
                  <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                    Payment methods
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-on-surface-variant">
                    {paymentEntries.length} giao dịch trên {orders.length} đơn hàng, giá trị ròng{" "}
                    <span className="font-semibold text-primary">{formatCurrency(totalPaid)}</span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {paymentMethodCards.slice(0, 2).map((methodCard, index) => {
                const Icon = getPaymentMethodIcon(methodCard.paymentMethod);
                const isPrimary = index === 0;

                return (
                  <SurfaceCard key={methodCard.key} className="p-7 transition duration-300 hover:bg-surface-container">
                    <div className="flex items-start justify-between gap-4">
                      <Icon className="h-7 w-7 text-primary" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                        {humanizeToken(methodCard.gatewayProvider)}
                      </span>
                    </div>
                    <div className="mt-10">
                      <p className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                        {humanizeToken(methodCard.paymentMethod)}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                        Dùng {methodCard.usageCount} lần · gần nhất {formatShortDate(methodCard.lastUsedAt)}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                        Tổng giá trị xử lý {formatCurrency(methodCard.totalAmount)}
                      </p>
                    </div>
                    <div className="mt-8 flex items-center gap-2">
                      {isPrimary ? (
                        <>
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                            Primary usage
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                          Transaction derived
                        </span>
                      )}
                    </div>
                  </SurfaceCard>
                );
              })}

              <div className="flex min-h-[18rem] flex-col items-center justify-center gap-4 rounded-[1.5rem] border border-dashed border-outline-variant bg-transparent px-7 py-8 text-center transition duration-300 hover:border-primary hover:bg-surface-container-low">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-primary">Phương thức mới sẽ xuất hiện sau checkout</p>
                  <p className="text-sm leading-7 text-on-surface-variant">
                    Repo hiện chưa có API quản lý thẻ lưu sẵn, nên màn này hiển thị phương thức thực sự đã được dùng.
                  </p>
                </div>
                <Link href="/checkout" className={buttonStyles({ variant: "secondary" })}>
                  Đi tới checkout
                </Link>
              </div>
            </div>
          </section>

          <section className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                Billing history
              </h2>
              <p className="text-sm leading-7 text-on-surface-variant">
                Lịch sử này được tổng hợp trực tiếp từ endpoint `/api/v1/payments/history`.
              </p>
            </div>

            <SurfaceCard className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-on-surface-variant">
                    <th className="px-8 py-6 text-[10px] font-semibold uppercase tracking-[0.24em]">Order ID</th>
                    <th className="px-8 py-6 text-[10px] font-semibold uppercase tracking-[0.24em]">Date</th>
                    <th className="px-8 py-6 text-[10px] font-semibold uppercase tracking-[0.24em]">Method</th>
                    <th className="px-8 py-6 text-[10px] font-semibold uppercase tracking-[0.24em]">Status</th>
                    <th className="px-8 py-6 text-right text-[10px] font-semibold uppercase tracking-[0.24em]">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {paymentEntries.map(({ payment }) => {
                    const Icon = getPaymentMethodIcon(payment.payment_method);

                    return (
                      <tr key={payment.id} className="transition hover:bg-surface-container-high/60">
                        <td className="px-8 py-6">
                          <Link
                            href={`/orders/${payment.order_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {formatShortOrderId(payment.order_id)}
                          </Link>
                        </td>
                        <td className="px-8 py-6 text-sm text-on-surface-variant">
                          {formatShortDate(payment.created_at)}
                        </td>
                        <td className="px-8 py-6 text-sm text-primary">
                          <span className="inline-flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {humanizeToken(payment.payment_method)} · {humanizeToken(payment.gateway_provider)}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <StatusPill status={payment.status} />
                        </td>
                        <td className="px-8 py-6 text-right text-sm font-semibold text-primary">
                          {formatCurrency(payment.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SurfaceCard>

            <div className="grid gap-4 md:hidden">
              {paymentEntries.map(({ payment, order }) => {
                const Icon = getPaymentMethodIcon(payment.payment_method);

                return (
                  <Link
                    key={payment.id}
                    href={`/orders/${payment.order_id}`}
                    className="block rounded-[1.75rem] bg-surface-container-low px-5 py-5 transition hover:bg-surface-container"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-primary">{formatShortOrderId(payment.order_id)}</p>
                        <p className="mt-2 text-sm text-on-surface-variant">{formatDateTime(payment.created_at)}</p>
                        <p className="mt-3 inline-flex items-center gap-2 text-sm text-on-surface-variant">
                          <Icon className="h-4 w-4 text-primary" />
                          {humanizeToken(payment.payment_method)} · {humanizeToken(payment.gateway_provider)}
                        </p>
                        <p className="mt-2 text-sm text-on-surface-variant">
                          Đơn hàng tạo ngày {formatShortDate(order.created_at)}
                        </p>
                      </div>
                      <StatusPill status={payment.status} />
                    </div>
                    <p className="mt-4 font-semibold text-primary">{formatCurrency(payment.amount)}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </AccountShell>
  );
}
