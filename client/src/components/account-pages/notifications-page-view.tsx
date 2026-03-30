"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AccountShell } from "@/components/account-shell";
import { SurfaceCard } from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { useOrderPayments } from "@/hooks/useOrderPayments";
import {
  formatCurrency,
  formatShortDate,
  formatShortOrderId,
  formatStatusLabel,
  humanizeToken,
} from "@/utils/format";

import { getLatestPayment } from "./shared";

const notificationPreferenceCards = [
  ["emailAlerts", "Email alerts", "Nhận tóm tắt đơn hàng và cập nhật giao dịch qua email."],
  ["smsNotifications", "SMS notifications", "Thông báo ngắn gọn cho các trạng thái cần chú ý."],
  ["orderUpdates", "Order updates", "Cập nhật mọi bước xử lý đơn hàng."],
  ["securityAlerts", "Security alerts", "Nhắc nhở về email verification và password changes."],
] as const;

export function NotificationsPageView() {
  const { token, user } = useAuth();
  const { orders, paymentsByOrder } = useOrderPayments(token);
  const [prefs, setPrefs] = useState({
    emailAlerts: true,
    smsNotifications: false,
    orderUpdates: true,
    securityAlerts: true,
  });

  const latestPayment = getLatestPayment(paymentsByOrder);

  const feed = useMemo(() => {
    const items = [];

    if (orders[0]) {
      items.push({
        id: `order-${orders[0].id}`,
        title: `Đơn ${formatShortOrderId(orders[0].id)} đang ở trạng thái ${formatStatusLabel(orders[0].status)}`,
        description: `Cập nhật gần nhất vào ${formatShortDate(orders[0].updated_at)}.`,
        href: `/orders/${orders[0].id}`,
      });
    }

    if (latestPayment) {
      items.push({
        id: `payment-${latestPayment.id}`,
        title: `${humanizeToken(latestPayment.payment_method)} ${formatStatusLabel(latestPayment.status)}`,
        description: `${formatCurrency(latestPayment.amount)} qua ${humanizeToken(latestPayment.gateway_provider)}.`,
        href: `/orders/${latestPayment.order_id}`,
      });
    }

    items.push({
      id: "security",
      title: user?.email_verified ? "Email đã xác minh" : "Email cần xác minh",
      description: user?.email_verified
        ? "Tài khoản đã sẵn sàng cho các luồng recovery và security notice."
        : "Hãy xác minh email để tăng mức bảo vệ cho tài khoản.",
      href: "/security",
    });

    return items;
  }, [latestPayment, orders, user?.email_verified]);

  return (
    <AccountShell
      title="Thông báo & activity"
      description="Trang này gom các tín hiệu quan trọng từ orders, payments và trạng thái tài khoản để người dùng xử lý nhanh hơn."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {notificationPreferenceCards.map(([key, title, description]) => (
          <SurfaceCard key={key} className="p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-primary">{title}</p>
              <input
                checked={prefs[key]}
                type="checkbox"
                onChange={(event) =>
                  setPrefs((current) => ({ ...current, [key]: event.target.checked }))
                }
              />
            </div>
            <p className="mt-4 text-sm leading-7 text-on-surface-variant">{description}</p>
          </SurfaceCard>
        ))}
      </div>

      <SurfaceCard className="p-6">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">Activity feed</h2>
        <div className="mt-6 grid gap-4">
          {feed.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-[1.5rem] bg-surface p-5 transition hover:bg-surface-container-high"
            >
              <p className="font-semibold text-primary">{item.title}</p>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">{item.description}</p>
            </Link>
          ))}
        </div>
      </SurfaceCard>
    </AccountShell>
  );
}
