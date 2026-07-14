import { CreditCard, Heart, MapPin, PackageCheck } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/auth-context";
import { useWishlist } from "../state/wishlist-context";
import { formatCurrency } from "../utils/format";
import { getInitials } from "./account/account-helpers";
import { AddressSection } from "./account/address-section";
import { AuthPanel } from "./account/auth-panel";
import { NotificationsSection } from "./account/notifications-section";
import { OrdersSection, PaymentsSection } from "./account/orders-section";
import { ProfileSection } from "./account/profile-section";
import { SecuritySection } from "./account/security-section";
import { WishlistSection } from "./account/wishlist-section";
import { useAccountData } from "./account/use-account-data";

/**
 * Trang tài khoản: đăng nhập/đăng ký khi chưa có session, ngược lại là
 * account center. Mỗi section tự quản form state của nó; dữ liệu dùng chung
 * (orders/payments/addresses/notifications) nằm ở useAccountData.
 */
export function AccountPage() {
  const { token, user, loading, logout } = useAuth();
  const { items: wishlistItems } = useWishlist();
  const account = useAccountData(token);

  const safeWishlistItems = useMemo(
    () => (Array.isArray(wishlistItems) ? wishlistItems : []),
    [wishlistItems],
  );

  const totalPaid = useMemo(
    () =>
      account.payments
        .filter((payment) => payment.status === "completed")
        .reduce((total, payment) => total + payment.amount, 0),
    [account.payments],
  );

  if (loading) {
    return (
      <div className="surface-section">
        <p>Đang tải tài khoản...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPanel />;
  }

  return (
    <div className="page-stack">
      <section className="account-hero">
        <div className="account-identity">
          <div className="account-avatar">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.first_name || user.email} />
            ) : (
              <span>{getInitials(user.first_name, user.email)}</span>
            )}
          </div>
          <div>
            <span className="eyebrow">Account center</span>
            <h1>{user.first_name || user.email}</h1>
            <p>{user.email}</p>
            <div className="account-badges">
              <span className={user.email_verified ? "status-pill is-good" : "status-pill"}>
                Email {user.email_verified ? "đã xác thực" : "chưa xác thực"}
              </span>
              <span className={user.phone_verified ? "status-pill is-good" : "status-pill"}>
                SĐT {user.phone_verified ? "đã xác thực" : "chưa xác thực"}
              </span>
            </div>
          </div>
        </div>
        <button className="button button--ghost" type="button" onClick={logout}>
          Đăng xuất
        </button>
      </section>

      <div className="account-quick-nav">
        <a href="#profile">Hồ sơ</a>
        <a href="#orders">Đơn hàng</a>
        <Link to="/account/returns">Trả hàng</Link>
        <a href="#payments">Thanh toán</a>
        <a href="#addresses">Địa chỉ</a>
        <a href="#wishlist">Wishlist</a>
        <a href="#notifications">Thông báo</a>
      </div>

      {account.error ? <p className="inline-error">{account.error}</p> : null}
      {account.loading ? <p className="muted-text">Đang đồng bộ dữ liệu tài khoản...</p> : null}

      <section className="account-stat-grid">
        <article className="stat-card">
          <PackageCheck size={22} />
          <span>Đơn hàng</span>
          <strong>{account.orders.length}</strong>
        </article>
        <article className="stat-card">
          <CreditCard size={22} />
          <span>Đã thanh toán</span>
          <strong>{formatCurrency(totalPaid)}</strong>
        </article>
        <article className="stat-card">
          <Heart size={22} />
          <span>Wishlist</span>
          <strong>{safeWishlistItems.length}</strong>
        </article>
        <article className="stat-card">
          <MapPin size={22} />
          <span>Địa chỉ</span>
          <strong>{account.addresses.length}</strong>
        </article>
      </section>

      <ProfileSection />
      <SecuritySection />
      <OrdersSection orders={account.orders} paymentsByOrder={account.paymentsByOrder} />
      <PaymentsSection payments={account.payments} />
      <AddressSection
        addresses={account.addresses}
        setAddresses={account.setAddresses}
        onError={account.setError}
      />
      <WishlistSection alerts={account.wishlistAlerts} />
      <NotificationsSection
        notifications={account.notifications}
        preferences={account.notificationPreferences}
        onMarkAllRead={account.markAllRead}
        onTogglePreference={account.togglePreference}
        onError={account.setError}
      />
    </div>
  );
}
