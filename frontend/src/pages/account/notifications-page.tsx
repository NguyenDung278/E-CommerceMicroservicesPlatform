import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AccountPageLayout } from "@/features/account/components/account-page-layout";
import { useOrderPayments } from "@/features/account/hooks/use-order-payments";
import {
  formatShortDate,
  formatShortOrderId,
  humanizeToken,
} from "@/features/account/utils/account-presentation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { api, getErrorMessage } from "@/services/api";
import type { NotificationPreference, WishlistAlert } from "@/types/api";
import { formatCurrency, formatStatusLabel } from "@/utils/format";
import "@/styles/pages/account/notifications-page.css";

type NotificationFeedItem = {
  id: string;
  title: string;
  description: string;
  meta: string;
  unread?: boolean;
  actionHref?: string;
  actionLabel?: string;
};

const preferenceCards = [
  {
    topic: "order_updates",
    icon: "OR",
    title: "Order Updates",
    description: "Nhận email khi đơn hàng đổi trạng thái từ xác nhận tới giao hàng.",
  },
  {
    topic: "payment_updates",
    icon: "PM",
    title: "Payment Updates",
    description: "Biên lai thanh toán, thất bại thanh toán và trạng thái hoàn tiền.",
  },
  {
    topic: "return_updates",
    icon: "RT",
    title: "Return Updates",
    description: "Mọi mốc của quy trình trả hàng và refund queue cho đơn đã mua.",
  },
  {
    topic: "wishlist_back_in_stock",
    icon: "ST",
    title: "Back In Stock",
    description: "Thông báo khi sản phẩm trong wishlist có hàng trở lại.",
  },
  {
    topic: "wishlist_price_drop",
    icon: "PD",
    title: "Price Drop",
    description: "Thông báo khi sản phẩm wishlist giảm giá so với lúc bạn lưu lại.",
  },
] as const;

export function NotificationsPage() {
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
      api.listNotificationPreferences(token),
      api.listWishlistAlerts(token),
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

  const latestPayment = useMemo(
    () =>
      Object.values(paymentsByOrder)
        .flat()
        .slice()
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0],
    [paymentsByOrder]
  );

  const enabledTopics = useMemo(
    () => new Map(preferences.map((preference) => [preference.topic, preference.enabled])),
    [preferences]
  );

  const sortedWishlistAlerts = useMemo(
    () =>
      [...wishlistAlerts].sort(
        (left, right) => Date.parse(right.detected_at) - Date.parse(left.detected_at)
      ),
    [wishlistAlerts]
  );

  const feedItems = useMemo<NotificationFeedItem[]>(() => {
    const items: NotificationFeedItem[] = [];

    if (orders[0]) {
      items.push({
        id: `order-${orders[0].id}`,
        title: `Your order ${formatShortOrderId(orders[0].id)} is ${formatStatusLabel(orders[0].status)}`,
        description: `Current order total is ${formatCurrency(orders[0].total_price)} and the latest update was recorded on ${formatShortDate(orders[0].updated_at)}.`,
        meta: formatShortDate(orders[0].updated_at),
        unread: true,
        actionHref: `/orders/${orders[0].id}`,
        actionLabel: "Track Shipment",
      });
    }

    if (latestPayment) {
      items.push({
        id: `payment-${latestPayment.id}`,
        title: `${humanizeToken(latestPayment.gateway_provider)} payment ${formatStatusLabel(latestPayment.status)}`,
        description: `${formatCurrency(latestPayment.amount)} via ${humanizeToken(latestPayment.payment_method)}.`,
        meta: formatShortDate(latestPayment.created_at),
        actionHref: `/orders/${latestPayment.order_id}`,
        actionLabel: "Open Order",
      });
    }

    items.push({
      id: "security",
      title: user?.email_verified
        ? "Security: Verified account email"
        : "Security: Email verification pending",
      description: user?.email_verified
        ? "Your recovery email is verified and ready for account protection flows."
        : "Verify your email to strengthen recovery and important security notices.",
      meta: user?.email_verified ? "Ready" : "Needs action",
      unread: !user?.email_verified,
      actionHref: "/security",
      actionLabel: "Review Security",
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
      const response = await api.updateNotificationPreferences(token, {
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
    <AccountPageLayout>
      <div className="notifications-route">
        <header className="notifications-route-head">
          <h1>Notifications</h1>
          <p>
            Đồng bộ trực tiếp với notification preferences, wishlist alerts và luồng order/payment
            thật từ back-end.
          </p>
        </header>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        <div className="notifications-route-prefs">
          {preferenceCards.map((item) => {
            const enabled = enabledTopics.get(item.topic) ?? true;
            const isBusy = busyTopic === item.topic;

            return (
              <article className="notifications-route-pref" key={item.topic}>
                <div className="notifications-route-pref-head">
                  <span className="notifications-route-pref-icon">{item.icon}</span>
                  <button
                    aria-busy={isBusy}
                    aria-pressed={enabled}
                    className={
                      enabled
                        ? "notifications-route-toggle notifications-route-toggle-active"
                        : "notifications-route-toggle"
                    }
                    disabled={isBusy}
                    type="button"
                    onClick={() => void handleToggle(item.topic, !enabled)}
                  >
                    <span />
                  </button>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            );
          })}
        </div>

        <section className="notifications-route-feed">
          <div className="notifications-route-feed-head">
            <h2>Wishlist Signals</h2>
            <Link className="notifications-route-mark" to="/wishlist">
              Open Wishlist
            </Link>
          </div>

          <div className="notifications-route-feed-list">
            {sortedWishlistAlerts.length === 0 ? (
              <article className="notifications-route-item">
                <div className="notifications-route-item-head">
                  <h3>No active wishlist alerts</h3>
                  <span>Quiet now</span>
                </div>
                <p>
                  Khi sản phẩm trong wishlist giảm giá hoặc có hàng trở lại, tín hiệu sẽ hiện ở đây
                  và được gửi theo preference bạn đã chọn.
                </p>
              </article>
            ) : (
              sortedWishlistAlerts.map((alert) => (
                <article
                  className="notifications-route-item notifications-route-item-unread"
                  key={`${alert.kind}-${alert.product_id}-${alert.detected_at}`}
                >
                  <div className="notifications-route-item-head">
                    <h3>{buildWishlistAlertTitle(alert)}</h3>
                    <span>{formatShortDate(alert.detected_at)}</span>
                  </div>
                  <p>{buildWishlistAlertDescription(alert)}</p>
                  <Link className="notifications-route-action" to="/wishlist">
                    Open Wishlist
                  </Link>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="notifications-route-feed">
          <div className="notifications-route-feed-head">
            <h2>Recent Activity</h2>
            <Link className="notifications-route-mark" to="/products">
              Explore New Arrivals
            </Link>
          </div>

          <div className="notifications-route-feed-list">
            {feedItems.map((item) => (
              <article
                className={
                  item.unread
                    ? "notifications-route-item notifications-route-item-unread"
                    : "notifications-route-item"
                }
                key={item.id}
              >
                <div className="notifications-route-item-head">
                  <h3>{item.title}</h3>
                  <span>{item.meta}</span>
                </div>
                <p>{item.description}</p>
                {item.actionHref && item.actionLabel ? (
                  <Link className="notifications-route-action" to={item.actionHref}>
                    {item.actionLabel}
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </AccountPageLayout>
  );
}

function buildWishlistAlertTitle(alert: WishlistAlert) {
  const name = alert.product_name || alert.product_id;
  if (alert.kind === "back_in_stock") {
    return `${name} is back in stock`;
  }
  if (alert.kind === "price_drop") {
    return `${name} just dropped in price`;
  }
  return `${name} has a new wishlist update`;
}

function buildWishlistAlertDescription(alert: WishlistAlert) {
  if (alert.kind === "back_in_stock") {
    return `${alert.product_name || alert.product_id} is available again with ${alert.current_stock ?? 0} items ready to order.`;
  }
  if (alert.kind === "price_drop") {
    return `${alert.product_name || alert.product_id} moved from ${formatCurrency(alert.baseline_price ?? 0)} to ${formatCurrency(alert.current_price ?? 0)}.`;
  }
  return "A product in your wishlist changed recently.";
}
