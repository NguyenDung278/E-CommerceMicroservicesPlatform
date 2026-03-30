import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AccountPageLayout } from "../features/account/components/AccountPageLayout";
import { useOrderPayments } from "../features/account/hooks/useOrderPayments";
import { formatShortDate, formatShortOrderId, humanizeToken } from "../features/account/utils/accountPresentation";
import { useAuth } from "../features/auth/hooks/useAuth";
import { formatCurrency, formatStatusLabel } from "../shared/utils/format";
import "./NotificationsPage.css";

type NotificationPreferences = {
  emailAlerts: boolean;
  smsNotifications: boolean;
  orderUpdates: boolean;
  securityAlerts: boolean;
};

type NotificationFeedItem = {
  id: string;
  title: string;
  description: string;
  meta: string;
  unread?: boolean;
  actionHref?: string;
  actionLabel?: string;
};

type NotificationPreferenceKey = keyof NotificationPreferences;

export function NotificationsPage() {
  const { token, user } = useAuth();
  const { orders, paymentsByOrder } = useOrderPayments(token);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    emailAlerts: true,
    smsNotifications: false,
    orderUpdates: true,
    securityAlerts: true
  });
  const preferenceCards: Array<{
    key: NotificationPreferenceKey;
    icon: string;
    title: string;
    description: string;
  }> = [
    {
      key: "emailAlerts",
      icon: "EA",
      title: "Email Alerts",
      description: "Receive detailed order summaries and monthly lookbooks directly in your inbox."
    },
    {
      key: "smsNotifications",
      icon: "SM",
      title: "SMS Notifications",
      description: "Get instant shipping updates and important account alerts on your mobile device."
    },
    {
      key: "orderUpdates",
      icon: "OU",
      title: "Order Updates",
      description: "Be notified whenever an order changes stage, from confirmation to delivery."
    },
    {
      key: "securityAlerts",
      icon: "SA",
      title: "Security Alerts",
      description: "Receive recovery notices, login warnings and verification reminders when needed."
    }
  ];

  const latestPayment = useMemo(
    () =>
      Object.values(paymentsByOrder)
        .flat()
        .slice()
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0],
    [paymentsByOrder]
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
        actionLabel: "Track Shipment"
      });
    }

    if (latestPayment) {
      items.push({
        id: `payment-${latestPayment.id}`,
        title: `${humanizeToken(latestPayment.gateway_provider)} payment ${formatStatusLabel(latestPayment.status)}`,
        description: `${formatCurrency(latestPayment.amount)} via ${humanizeToken(latestPayment.payment_method)}.`,
        meta: formatShortDate(latestPayment.created_at)
      });
    }

    items.push({
      id: "security",
      title: user?.email_verified ? "Security: Verified account email" : "Security: Email verification pending",
      description: user?.email_verified
        ? "Your recovery email is verified and ready for account protection flows."
        : "Verify your email to strengthen recovery and important security notices.",
      meta: user?.email_verified ? "Today" : "Needs action",
      unread: !user?.email_verified,
        actionHref: "/security",
      actionLabel: "Review Security"
    });

    items.push({
      id: "collection",
      title: "Exclusive Access: New Arrivals",
      description: "Discover fresh pieces and editorial releases curated for your ND Shop account area.",
      meta: "Editorial"
    });

    return items;
  }, [latestPayment, orders, user?.email_verified]);

  return (
    <AccountPageLayout>
      <div className="notifications-route">
        <header className="notifications-route-head">
          <h1>Notifications</h1>
          <p>Stay updated with your orders, payment activity and account security in one clean feed.</p>
        </header>

        <div className="notifications-route-prefs">
          {preferenceCards.map((item) => (
            <article className="notifications-route-pref" key={item.key}>
              <div className="notifications-route-pref-head">
                <span className="notifications-route-pref-icon">{item.icon}</span>
                <button
                  aria-pressed={prefs[item.key]}
                  className={prefs[item.key] ? "notifications-route-toggle notifications-route-toggle-active" : "notifications-route-toggle"}
                  type="button"
                  onClick={() => setPrefs((current) => ({ ...current, [item.key]: !current[item.key] }))}
                >
                  <span />
                </button>
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>

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
                className={item.unread ? "notifications-route-item notifications-route-item-unread" : "notifications-route-item"}
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
