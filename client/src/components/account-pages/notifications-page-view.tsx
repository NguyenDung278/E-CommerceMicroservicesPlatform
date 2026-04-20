"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AccountShell } from "@/components/account-shell";
import { SurfaceCard } from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { useOrderPayments } from "@/hooks/useOrderPayments";
import { userApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors/handler";
import type { NotificationPreference, WishlistAlert } from "@/types/api";
import {
  formatCurrency,
  formatShortDate,
  formatShortOrderId,
  formatStatusLabel,
  humanizeToken,
} from "@/utils/format";

import { getLatestPayment } from "./shared";

const preferenceCards = [
  ["order_updates", "Order updates", "Cập nhật mọi bước xử lý đơn hàng."],
  ["payment_updates", "Payment updates", "Biên lai, lỗi thanh toán và trạng thái refund."],
  ["return_updates", "Return updates", "Trạng thái xử lý của các yêu cầu trả hàng."],
  ["wishlist_back_in_stock", "Back in stock", "Thông báo khi sản phẩm wishlist có hàng trở lại."],
  ["wishlist_price_drop", "Price drop", "Thông báo khi sản phẩm wishlist giảm giá."],
] as const;

export function NotificationsPageView() {
  const { token, user } = useAuth();
  const { orders, paymentsByOrder } = useOrderPayments(token);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [wishlistAlerts, setWishlistAlerts] = useState<WishlistAlert[]>([]);
  const [feedback, setFeedback] = useState("");
  const [busyTopic, setBusyTopic] = useState("");

  useEffect(() => {
    let active = true;

    if (!token) {
      setPreferences([]);
      setWishlistAlerts([]);
      return () => {
        active = false;
      };
    }

    void Promise.allSettled([
      userApi.listNotificationPreferences(token),
      userApi.listWishlistAlerts(token),
    ]).then((results) => {
      if (!active) {
        return;
      }

      const [preferencesResult, alertsResult] = results;
      if (preferencesResult.status === "fulfilled") {
        setPreferences(preferencesResult.value.data);
      }
      if (alertsResult.status === "fulfilled") {
        setWishlistAlerts(alertsResult.value.data);
      }
      if (
        preferencesResult.status === "rejected" &&
        alertsResult.status === "rejected"
      ) {
        setFeedback(getErrorMessage(preferencesResult.reason));
      }
    });

    return () => {
      active = false;
    };
  }, [token]);

  const latestPayment = getLatestPayment(paymentsByOrder);

  const preferenceMap = useMemo(
    () => new Map(preferences.map((preference) => [preference.topic, preference.enabled])),
    [preferences],
  );

  const sortedWishlistAlerts = useMemo(
    () =>
      [...wishlistAlerts].sort(
        (left, right) => Date.parse(right.detected_at) - Date.parse(left.detected_at),
      ),
    [wishlistAlerts],
  );

  const feed = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      description: string;
      href: string;
    }> = [];

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

  async function handleToggle(topic: string, enabled: boolean) {
    if (!token) {
      return;
    }

    try {
      setBusyTopic(topic);
      setFeedback("");
      const response = await userApi.updateNotificationPreferences(token, {
        preferences: [{ topic, enabled }],
      });
      setPreferences(response.data);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyTopic("");
    }
  }

  return (
    <AccountShell
      title="Thông báo & activity"
      description="Trang này đã nối trực tiếp notification preferences và wishlist alerts từ backend thay vì state giả lập."
    >
      {feedback ? (
        <SurfaceCard className="p-4 text-sm leading-7 text-on-surface-variant">{feedback}</SurfaceCard>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {preferenceCards.map(([topic, title, description]) => {
          const enabled = preferenceMap.get(topic) ?? true;
          const isBusy = busyTopic === topic;

          return (
            <SurfaceCard key={topic} className="p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-primary">{title}</p>
                <input
                  checked={enabled}
                  disabled={isBusy}
                  type="checkbox"
                  onChange={(event) => void handleToggle(topic, event.target.checked)}
                />
              </div>
              <p className="mt-4 text-sm leading-7 text-on-surface-variant">{description}</p>
            </SurfaceCard>
          );
        })}
      </div>

      <SurfaceCard className="p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
            Wishlist signals
          </h2>
          <Link href="/wishlist" className="text-sm font-medium text-primary underline">
            Open wishlist
          </Link>
        </div>
        <div className="mt-6 grid gap-4">
          {sortedWishlistAlerts.length === 0 ? (
            <div className="rounded-[1.5rem] bg-surface p-5">
              <p className="font-semibold text-primary">Chưa có tín hiệu wishlist mới</p>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                Khi sản phẩm wishlist giảm giá hoặc có hàng trở lại, mục này sẽ hiển thị ngay.
              </p>
            </div>
          ) : (
            sortedWishlistAlerts.map((alert) => (
              <Link
                key={`${alert.kind}-${alert.product_id}-${alert.detected_at}`}
                href="/wishlist"
                className="rounded-[1.5rem] bg-surface p-5 transition hover:bg-surface-container-high"
              >
                <p className="font-semibold text-primary">{buildWishlistAlertTitle(alert)}</p>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                  {buildWishlistAlertDescription(alert)}
                </p>
              </Link>
            ))
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-6">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
          Activity feed
        </h2>
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

function buildWishlistAlertTitle(alert: WishlistAlert) {
  const name = alert.product_name || alert.product_id;
  if (alert.kind === "back_in_stock") {
    return `${name} đã có hàng trở lại`;
  }
  if (alert.kind === "price_drop") {
    return `${name} vừa giảm giá`;
  }
  return `${name} có cập nhật mới`;
}

function buildWishlistAlertDescription(alert: WishlistAlert) {
  if (alert.kind === "back_in_stock") {
    return `${alert.product_name || alert.product_id} hiện có ${alert.current_stock ?? 0} sản phẩm sẵn sàng để đặt mua.`;
  }
  if (alert.kind === "price_drop") {
    return `${alert.product_name || alert.product_id} giảm từ ${formatCurrency(alert.baseline_price ?? 0)} xuống ${formatCurrency(alert.current_price ?? 0)}.`;
  }
  return "Một sản phẩm trong wishlist vừa có thay đổi mới.";
}
