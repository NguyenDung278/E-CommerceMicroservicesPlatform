import { Bell, Inbox } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { NotificationInboxItem, NotificationPreference } from "../../types/api";
import { formatDate } from "../../utils/format";
import {
  notificationActionLabel,
  notificationHref,
  notificationTopics,
  preferenceEnabled,
} from "./account-helpers";

/** Inbox thông báo + bật/tắt preference theo topic. */
export function NotificationsSection({
  notifications,
  preferences,
  onMarkAllRead,
  onTogglePreference,
  onError,
}: {
  notifications: NotificationInboxItem[];
  preferences: NotificationPreference[];
  onMarkAllRead: () => Promise<void>;
  onTogglePreference: (topic: string, enabled: boolean) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [notificationUpdating, setNotificationUpdating] = useState(false);
  const [preferenceUpdating, setPreferenceUpdating] = useState<string | null>(null);

  const unreadNotifications = notifications.filter((notification) => !notification.read_at);

  async function handleTogglePreference(topic: string, enabled: boolean) {
    try {
      setPreferenceUpdating(topic);
      await onTogglePreference(topic, enabled);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không cập nhật được thông báo");
    } finally {
      setPreferenceUpdating(null);
    }
  }

  async function handleMarkAllNotificationsRead() {
    try {
      setNotificationUpdating(true);
      onError(null);
      await onMarkAllRead();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không cập nhật được thông báo");
    } finally {
      setNotificationUpdating(false);
    }
  }

  return (
    <section className="surface-section" id="notifications">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Notifications</span>
          <h2>Thông báo</h2>
          <p>{unreadNotifications.length} thông báo chưa đọc</p>
        </div>
        <Bell size={24} />
      </div>

      <div className="notification-inbox">
        <div className="section-heading section-heading--compact">
          <div>
            <strong>Inbox</strong>
            <p>Thông báo mới nhất từ đơn hàng, thanh toán, trả hàng và wishlist.</p>
          </div>
          <button
            className="button button--secondary"
            type="button"
            disabled={notificationUpdating || unreadNotifications.length === 0}
            onClick={() => void handleMarkAllNotificationsRead()}
          >
            <Inbox size={16} />
            {notificationUpdating ? "Đang cập nhật" : "Đánh dấu đã đọc"}
          </button>
        </div>

        {notifications.length === 0 ? (
          <p className="muted-text">Chưa có thông báo.</p>
        ) : (
          <div className="notification-list">
            {notifications.map((notification) => {
              const href = notificationHref(notification);
              const actionLabel = notificationActionLabel(notification);
              return (
                <article
                  key={notification.id}
                  className={`notification-card${notification.read_at ? "" : " is-unread"}`}
                >
                  <div>
                    <div className="notification-card__heading">
                      <strong>{notification.title || notification.topic}</strong>
                      <span className="status-pill">
                        {notification.read_at ? "Đã đọc" : "Mới"}
                      </span>
                    </div>
                    <p>{notification.message}</p>
                    <small>{formatDate(notification.created_at)}</small>
                  </div>
                  {href && actionLabel ? (
                    <Link className="button button--ghost" to={href}>
                      {actionLabel}
                    </Link>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="section-heading section-heading--compact">
        <div>
          <strong>Tùy chọn thông báo</strong>
          <p>Bật/tắt các nhóm notification bạn muốn nhận.</p>
        </div>
      </div>
      <div className="preference-list">
        {notificationTopics.map((item) => {
          const enabled = preferenceEnabled(preferences, item.topic);
          return (
            <label key={item.topic} className="preference-row">
              <span>{item.label}</span>
              <input
                type="checkbox"
                checked={enabled}
                disabled={preferenceUpdating === item.topic}
                onChange={(event) => void handleTogglePreference(item.topic, event.target.checked)}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
