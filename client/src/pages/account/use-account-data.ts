import { useEffect, useState } from "react";
import { markAllNotificationsRead, listNotifications } from "../../services/notification-service";
import { getOrderSummary, listOrders } from "../../services/order-service";
import { listPaymentHistory } from "../../services/payment-service";
import {
  listAddresses,
  listNotificationPreferences,
  updateNotificationPreferences,
} from "../../services/user-service";
import { listWishlistAlerts } from "../../services/wishlist-service";
import type {
  Address,
  NotificationInboxItem,
  NotificationPreference,
  Order,
  Payment,
  WishlistAlert,
} from "../../types/api";

/**
 * Tải toàn bộ dữ liệu account (đơn hàng, thanh toán, địa chỉ, thông báo,
 * wishlist alert) bằng một lượt Promise.allSettled — mỗi mảng con lỗi thì
 * chỉ báo lỗi phần đó, không chặn phần còn lại.
 */
export function useAccountData(token: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentsByOrder, setPaymentsByOrder] = useState<Record<string, Payment[]>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notifications, setNotifications] = useState<NotificationInboxItem[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference[]>(
    [],
  );
  const [wishlistAlerts, setWishlistAlerts] = useState<WishlistAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAccountData() {
      if (!token) {
        setOrders([]);
        setPaymentsByOrder({});
        setPayments([]);
        setAddresses([]);
        setNotifications([]);
        setNotificationPreferences([]);
        setWishlistAlerts([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const [
          summaryResult,
          fallbackOrdersResult,
          paymentResult,
          addressResult,
          notificationResult,
          preferenceResult,
          alertResult,
        ] = await Promise.allSettled([
          getOrderSummary(token),
          listOrders(token),
          listPaymentHistory(token),
          listAddresses(token),
          listNotifications(token, 20),
          listNotificationPreferences(token),
          listWishlistAlerts(token),
        ]);

        if (!active) {
          return;
        }

        const failures: string[] = [];
        if (summaryResult.status === "fulfilled") {
          setOrders(Array.isArray(summaryResult.value.orders) ? summaryResult.value.orders : []);
          setPaymentsByOrder(summaryResult.value.payments_by_order ?? {});
        } else if (fallbackOrdersResult.status === "fulfilled") {
          setOrders(Array.isArray(fallbackOrdersResult.value) ? fallbackOrdersResult.value : []);
          setPaymentsByOrder({});
        } else {
          failures.push("Không tải được tóm tắt đơn hàng");
        }
        if (paymentResult.status === "fulfilled") {
          setPayments(Array.isArray(paymentResult.value) ? paymentResult.value : []);
        } else {
          failures.push("Không tải được lịch sử thanh toán");
        }
        if (addressResult.status === "fulfilled") {
          setAddresses(Array.isArray(addressResult.value) ? addressResult.value : []);
        } else {
          failures.push("Không tải được sổ địa chỉ");
        }
        if (notificationResult.status === "fulfilled") {
          setNotifications(Array.isArray(notificationResult.value) ? notificationResult.value : []);
        }
        if (preferenceResult.status === "fulfilled") {
          setNotificationPreferences(
            Array.isArray(preferenceResult.value) ? preferenceResult.value : [],
          );
        } else {
          failures.push("Không tải được tùy chọn thông báo");
        }
        if (alertResult.status === "fulfilled") {
          setWishlistAlerts(Array.isArray(alertResult.value) ? alertResult.value : []);
        }

        setError(failures[0] ?? null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAccountData();

    return () => {
      active = false;
    };
  }, [token]);

  async function togglePreference(topic: string, enabled: boolean) {
    if (!token) {
      return;
    }

    const nextPreferences = await updateNotificationPreferences(token, [{ topic, enabled }]);
    setNotificationPreferences(Array.isArray(nextPreferences) ? nextPreferences : []);
  }

  async function markAllRead() {
    if (!token) {
      return;
    }

    await markAllNotificationsRead(token);
    const nextNotifications = await listNotifications(token, 20).catch(() =>
      notifications.map((notification) => ({
        ...notification,
        read_at: notification.read_at ?? new Date().toISOString(),
      })),
    );
    setNotifications(Array.isArray(nextNotifications) ? nextNotifications : []);
  }

  return {
    orders,
    paymentsByOrder,
    payments,
    addresses,
    setAddresses,
    notifications,
    notificationPreferences,
    wishlistAlerts,
    loading,
    error,
    setError,
    togglePreference,
    markAllRead,
  };
}

export type AccountData = ReturnType<typeof useAccountData>;
