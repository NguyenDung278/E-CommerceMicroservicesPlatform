import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useOrderPayments } from "../hooks/useOrderPayments";
import { AccountPageFrame } from "../ui/account/AccountPageFrame";
import { formatShortDate, formatShortOrderId, humanizeToken } from "../ui/account/accountConfig";
import { formatCurrency, formatStatusLabel } from "../utils/format";
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

export function NotificationsPage() {
  const { token, user } = useAuth();
  const { orders, paymentsByOrder } = useOrderPayments(token);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    emailAlerts: true,
    smsNotifications: false,
    orderUpdates: true,
    securityAlerts: true
  });

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
      actionHref: "/profile/security",
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
    <AccountPageFrame>
      <div className="notifications-route">
        <header className="notifications-route-head">
          <h1>Notifications</h1>
          <p>Stay updated with your orders, payment activity and account security in one clean feed.</p>
        </header>

        <div className="notifications-route-prefs">
          <article className="notifications-route-pref">
            <div className="notifications-route-pref-head">
              <span className="notifications-route-pref-icon">EA</span>
              <button
                aria-pressed={prefs.emailAlerts}
                className={prefs.emailAlerts ? "notifications-route-toggle notifications-route-toggle-active" : "notifications-route-toggle"}
                type="button"
                onClick={() => setPrefs((current) => ({ ...current, emailAlerts: !current.emailAlerts }))}
              >
                <span />
              </button>
            </div>
            <h3>Email Alerts</h3>
            <p>Receive detailed order summaries and monthly lookbooks directly in your inbox.</p>
          </article>

          <article className="notifications-route-pref">
            <div className="notifications-route-pref-head">
              <span className="notifications-route-pref-icon">SM</span>
              <button
                aria-pressed={prefs.smsNotifications}
                className={prefs.smsNotifications ? "notifications-route-toggle notifications-route-toggle-active" : "notifications-route-toggle"}
                type="button"
                onClick={() => setPrefs((current) => ({ ...current, smsNotifications: !current.smsNotifications }))}
              >
                <span />
              </button>
            </div>
            <h3>SMS Notifications</h3>
            <p>Get instant shipping updates and important account alerts on your mobile device.</p>
          </article>
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
    </AccountPageFrame>
  );
}
