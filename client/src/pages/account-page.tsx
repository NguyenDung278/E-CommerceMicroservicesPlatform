import { Bell, CreditCard, Heart, MapPin, PackageCheck, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PriceLabel } from "../components/price-label";
import { ProductImage } from "../components/product-image";
import { getGoogleOAuthStartUrl } from "../services/auth-service";
import { getOrderSummary, listOrders } from "../services/order-service";
import { listPaymentHistory } from "../services/payment-service";
import { getProduct } from "../services/product-service";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  listNotificationPreferences,
  setDefaultAddress,
  updateNotificationPreferences,
  updateProfile,
} from "../services/user-service";
import { listWishlistAlerts } from "../services/wishlist-service";
import { useAuth } from "../state/auth-context";
import { useWishlist } from "../state/wishlist-context";
import type {
  Address,
  NotificationPreference,
  Order,
  Payment,
  Product,
  WishlistAlert,
} from "../types/api";
import { formatCurrency, formatDate, getProductImage } from "../utils/format";

const emptyAddressForm = {
  recipient_name: "",
  phone: "",
  location: "",
  is_default: false,
};

const notificationTopics = [
  { topic: "order_updates", label: "Cập nhật đơn hàng" },
  { topic: "payment_updates", label: "Cập nhật thanh toán" },
  { topic: "return_updates", label: "Trả hàng/hoàn tiền" },
  { topic: "wishlist_back_in_stock", label: "Wishlist có hàng lại" },
  { topic: "wishlist_price_drop", label: "Wishlist giảm giá" },
];

function getInitials(firstName?: string, email?: string) {
  const source = firstName?.trim() || email?.trim() || "ND";
  return source.slice(0, 2).toUpperCase();
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    pending: "Chờ xử lý",
    paid: "Đã thanh toán",
    shipped: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy",
    refunded: "Đã hoàn tiền",
    completed: "Hoàn tất",
    failed: "Thất bại",
  };

  return labels[value] ?? value;
}

function alertLabel(alert: WishlistAlert) {
  if (alert.kind === "back_in_stock") {
    return "Có hàng lại";
  }
  if (alert.kind === "price_drop") {
    return "Giảm giá";
  }
  return alert.kind;
}

function preferenceEnabled(preferences: NotificationPreference[], topic: string) {
  return preferences.find((preference) => preference.topic === topic)?.enabled ?? true;
}

export function AccountPage() {
  const { token, user, loading, login, register, refreshProfile, logout } = useAuth();
  const {
    items: wishlistItems,
    error: wishlistError,
    removeItem: removeWishlistItem,
  } = useWishlist();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "" });
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentsByOrder, setPaymentsByOrder] = useState<Record<string, Payment[]>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference[]>(
    [],
  );
  const [wishlistAlerts, setWishlistAlerts] = useState<WishlistAlert[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Record<string, Product>>({});
  const [error, setError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [preferenceUpdating, setPreferenceUpdating] = useState<string | null>(null);

  const safeOrders = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);
  const safePayments = useMemo(() => (Array.isArray(payments) ? payments : []), [payments]);
  const safeAddresses = useMemo(() => (Array.isArray(addresses) ? addresses : []), [addresses]);
  const safeNotificationPreferences = useMemo(
    () => (Array.isArray(notificationPreferences) ? notificationPreferences : []),
    [notificationPreferences],
  );
  const safeWishlistAlerts = useMemo(
    () => (Array.isArray(wishlistAlerts) ? wishlistAlerts : []),
    [wishlistAlerts],
  );
  const safeWishlistItems = useMemo(
    () => (Array.isArray(wishlistItems) ? wishlistItems : []),
    [wishlistItems],
  );

  const totalPaid = useMemo(
    () =>
      safePayments
        .filter((payment) => payment.status === "completed")
        .reduce((total, payment) => total + payment.amount, 0),
    [safePayments],
  );

  const pendingOrders = safeOrders.filter((order) => order.status === "pending").length;
  const defaultAddress = safeAddresses.find((address) => address.is_default);

  useEffect(() => {
    const state = location.state as { authError?: string } | null;
    if (state?.authError) {
      setError(state.authError);
    }
  }, [location.state]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setProfileForm({
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
    });
  }, [user]);

  useEffect(() => {
    let active = true;

    async function loadAccountData() {
      if (!token) {
        setOrders([]);
        setPaymentsByOrder({});
        setPayments([]);
        setAddresses([]);
        setNotificationPreferences([]);
        setWishlistAlerts([]);
        return;
      }

      try {
        setAccountLoading(true);
        setAccountError(null);
        const [
          summaryResult,
          fallbackOrdersResult,
          paymentResult,
          addressResult,
          preferenceResult,
          alertResult,
        ] = await Promise.allSettled([
          getOrderSummary(token),
          listOrders(token),
          listPaymentHistory(token),
          listAddresses(token),
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

        setAccountError(failures[0] ?? null);
      } finally {
        if (active) {
          setAccountLoading(false);
        }
      }
    }

    void loadAccountData();

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    let active = true;

    async function loadWishlistProducts() {
      if (!token || safeWishlistItems.length === 0) {
        setWishlistProducts({});
        return;
      }

      const entries = await Promise.all(
        safeWishlistItems.map(async (item) => {
          const product = await getProduct(item.product_id).catch(() => null);
          return product ? ([item.product_id, product] as const) : null;
        }),
      );

      if (active) {
        setWishlistProducts(
          Object.fromEntries(
            entries.filter((entry): entry is readonly [string, Product] => Boolean(entry)),
          ),
        );
      }
    }

    void loadWishlistProducts();

    return () => {
      active = false;
    };
  }, [token, safeWishlistItems]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      await login(email, password);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      await register({
        email,
        phone: phone.trim() || undefined,
        password,
        first_name: firstName,
        last_name: lastName,
      });
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    try {
      setProfileStatus(null);
      await updateProfile(token, {
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
      });
      await refreshProfile();
      setProfileStatus("Đã cập nhật hồ sơ");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không cập nhật được hồ sơ");
    }
  }

  async function handleCreateAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    try {
      setAddressSubmitting(true);
      setAccountError(null);
      const created = await createAddress(token, {
        ...addressForm,
        is_default: addressForm.is_default || safeAddresses.length === 0,
      });
      setAddresses((current) => {
        const currentAddresses = Array.isArray(current) ? current : [];
        const rest = created.is_default
          ? currentAddresses.map((address) => ({ ...address, is_default: false }))
          : currentAddresses;
        return [created, ...rest];
      });
      setAddressForm(emptyAddressForm);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Không tạo được địa chỉ");
    } finally {
      setAddressSubmitting(false);
    }
  }

  async function handleSetDefaultAddress(addressId: string) {
    if (!token) {
      return;
    }

    const updated = await setDefaultAddress(token, addressId).catch((err) => {
      setAccountError(err instanceof Error ? err.message : "Không đặt được địa chỉ mặc định");
      return null;
    });
    if (!updated) {
      return;
    }

    setAddresses((current) =>
      (Array.isArray(current) ? current : []).map((address) => ({
        ...address,
        is_default: address.id === updated.id,
      })),
    );
  }

  async function handleDeleteAddress(addressId: string) {
    if (!token) {
      return;
    }

    await deleteAddress(token, addressId)
      .then(() => {
        setAddresses((current) =>
          (Array.isArray(current) ? current : []).filter((address) => address.id !== addressId),
        );
      })
      .catch((err) => {
        setAccountError(err instanceof Error ? err.message : "Không xóa được địa chỉ");
      });
  }

  async function handleTogglePreference(topic: string, enabled: boolean) {
    if (!token) {
      return;
    }

    try {
      setPreferenceUpdating(topic);
      const nextPreferences = await updateNotificationPreferences(token, [{ topic, enabled }]);
      setNotificationPreferences(nextPreferences);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Không cập nhật được thông báo");
    } finally {
      setPreferenceUpdating(null);
    }
  }

  function handleGoogleLogin() {
    setError(null);
    window.location.assign(getGoogleOAuthStartUrl("/account"));
  }

  if (loading) {
    return (
      <div className="surface-section">
        <p>Đang tải tài khoản...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="account-layout">
        <section className="surface-section account-panel">
          <span className="eyebrow">Account</span>
          <h1>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h1>
          <form className="auth-form" onSubmit={mode === "login" ? handleLogin : handleRegister}>
            <button className="button button--google" type="button" onClick={handleGoogleLogin}>
              Đăng nhập bằng Gmail
            </button>
            <div className="auth-divider">
              <span>hoặc</span>
            </div>
            {mode === "register" ? (
              <div className="form-grid">
                <label>
                  Tên
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Họ
                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </label>
              </div>
            ) : null}
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            {mode === "register" ? (
              <label>
                Số điện thoại
                <input value={phone} onChange={(event) => setPhone(event.target.value)} />
              </label>
            ) : null}
            <label>
              Mật khẩu
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {error ? <p className="inline-error">{error}</p> : null}
            <button className="button button--primary" type="submit" disabled={submitting}>
              {submitting ? "Đang xử lý" : mode === "login" ? "Đăng nhập" : "Đăng ký"}
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
            >
              {mode === "login" ? "Tạo tài khoản mới" : "Tôi đã có tài khoản"}
            </button>
          </form>
        </section>
      </div>
    );
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
        <a href="#orders">Đơn hàng</a>
        <a href="#payments">Thanh toán</a>
        <a href="#addresses">Địa chỉ</a>
        <a href="#wishlist">Wishlist</a>
        <a href="#notifications">Thông báo</a>
      </div>

      {accountError ? <p className="inline-error">{accountError}</p> : null}
      {accountLoading ? <p className="muted-text">Đang đồng bộ dữ liệu tài khoản...</p> : null}

      <section className="account-stat-grid">
        <article className="stat-card">
          <PackageCheck size={22} />
          <span>Đơn hàng</span>
          <strong>{safeOrders.length}</strong>
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
          <strong>{safeAddresses.length}</strong>
        </article>
      </section>

      <section className="surface-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Profile</span>
            <h2>Hồ sơ mua hàng</h2>
          </div>
          <ShieldCheck size={24} />
        </div>
        <form className="profile-form" onSubmit={handleProfileSubmit}>
          <div className="form-grid">
            <label>
              Tên
              <input
                value={profileForm.first_name}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    first_name: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Họ
              <input
                value={profileForm.last_name}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    last_name: event.target.value,
                  }))
                }
                required
              />
            </label>
          </div>
          {profileStatus ? <p className="muted-text">{profileStatus}</p> : null}
          <button className="button button--secondary" type="submit">
            Lưu hồ sơ
          </button>
        </form>
      </section>

      <section className="surface-section" id="orders">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Orders</span>
            <h2>Đơn hàng</h2>
            <p>{pendingOrders} đơn đang chờ xử lý</p>
          </div>
          <Link to="/products">Mua thêm</Link>
        </div>
        {safeOrders.length === 0 ? (
          <p>Chưa có đơn hàng.</p>
        ) : (
          <div className="order-list">
            {safeOrders.map((order) => {
              const orderPayments = paymentsByOrder[order.id] ?? [];
              const lastPayment = orderPayments[0];
              return (
                <article key={order.id} className="order-card order-card--rich">
                  <div>
                    <strong>{order.id}</strong>
                    <p>{formatDate(order.created_at)}</p>
                  </div>
                  <span className="status-pill">{statusLabel(order.status)}</span>
                  <strong>{formatCurrency(order.total_price)}</strong>
                  <span>
                    {lastPayment ? statusLabel(lastPayment.status) : "Chưa có thanh toán"}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="surface-section" id="payments">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Payments</span>
            <h2>Lịch sử thanh toán</h2>
          </div>
          <CreditCard size={24} />
        </div>
        {safePayments.length === 0 ? (
          <p>Chưa có thanh toán.</p>
        ) : (
          <div className="payment-list">
            {safePayments.map((payment) => (
              <article key={payment.id} className="payment-card">
                <div>
                  <strong>{payment.payment_method}</strong>
                  <p>{payment.order_id}</p>
                </div>
                <span className="status-pill">{statusLabel(payment.status)}</span>
                <strong>{formatCurrency(payment.amount)}</strong>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="surface-section" id="addresses">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Address book</span>
            <h2>Sổ địa chỉ</h2>
            <p>
              {defaultAddress ? `Mặc định: ${defaultAddress.location}` : "Chưa có địa chỉ mặc định"}
            </p>
          </div>
          <MapPin size={24} />
        </div>
        <div className="account-split">
          <form className="address-form" onSubmit={handleCreateAddress}>
            <label>
              Người nhận
              <input
                value={addressForm.recipient_name}
                onChange={(event) =>
                  setAddressForm((current) => ({
                    ...current,
                    recipient_name: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Số điện thoại
              <input
                value={addressForm.phone}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, phone: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Địa chỉ
              <input
                value={addressForm.location}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, location: event.target.value }))
                }
                required
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={addressForm.is_default}
                onChange={(event) =>
                  setAddressForm((current) => ({
                    ...current,
                    is_default: event.target.checked,
                  }))
                }
              />
              Đặt làm mặc định
            </label>
            <button className="button button--secondary" type="submit" disabled={addressSubmitting}>
              {addressSubmitting ? "Đang lưu" : "Thêm địa chỉ"}
            </button>
          </form>

          <div className="address-list">
            {safeAddresses.length === 0 ? (
              <p>Chưa có địa chỉ.</p>
            ) : (
              safeAddresses.map((address) => (
                <article key={address.id} className="address-card">
                  <div>
                    <strong>{address.recipient_name}</strong>
                    <p>{address.phone}</p>
                    <p>{address.location}</p>
                  </div>
                  {address.is_default ? (
                    <span className="status-pill is-good">Mặc định</span>
                  ) : null}
                  <div className="inline-actions">
                    {!address.is_default ? (
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={() => void handleSetDefaultAddress(address.id)}
                      >
                        Đặt mặc định
                      </button>
                    ) : null}
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => void handleDeleteAddress(address.id)}
                    >
                      Xóa
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="surface-section" id="wishlist">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Wishlist</span>
            <h2>Sản phẩm yêu thích</h2>
          </div>
          <Link to="/products">Xem sản phẩm</Link>
        </div>
        {wishlistError ? <p className="inline-error">{wishlistError}</p> : null}
        {safeWishlistAlerts.length > 0 ? (
          <div className="alert-strip">
            {safeWishlistAlerts.map((alert) => (
              <article key={`${alert.product_id}-${alert.kind}`} className="alert-card">
                <strong>{alertLabel(alert)}</strong>
                <span>{alert.product_name || alert.product_id}</span>
                {alert.kind === "price_drop" && alert.current_price ? (
                  <PriceLabel value={alert.current_price} />
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
        {safeWishlistItems.length === 0 ? (
          <p>Chưa có sản phẩm yêu thích.</p>
        ) : (
          <div className="wishlist-list">
            {safeWishlistItems.map((item) => {
              const product = wishlistProducts[item.product_id];
              return (
                <article key={item.product_id} className="wishlist-card">
                  <Link to={`/products/${item.product_id}`} className="wishlist-card__media">
                    <ProductImage
                      src={product ? getProductImage(product) : ""}
                      alt={product?.name ?? item.product_id}
                    />
                  </Link>
                  <div>
                    <Link to={`/products/${item.product_id}`}>
                      <strong>{product?.name ?? item.product_id}</strong>
                    </Link>
                    <p>{formatDate(item.updated_at)}</p>
                  </div>
                  {typeof product?.price === "number" ? (
                    <PriceLabel value={product.price} />
                  ) : item.baseline_price ? (
                    <PriceLabel value={item.baseline_price} />
                  ) : (
                    <span>Đã lưu</span>
                  )}
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => void removeWishlistItem(item.product_id)}
                  >
                    Xóa
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="surface-section" id="notifications">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Notifications</span>
            <h2>Tùy chọn thông báo</h2>
          </div>
          <Bell size={24} />
        </div>
        <div className="preference-list">
          {notificationTopics.map((item) => {
            const enabled = preferenceEnabled(safeNotificationPreferences, item.topic);
            return (
              <label key={item.topic} className="preference-row">
                <span>{item.label}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={preferenceUpdating === item.topic}
                  onChange={(event) =>
                    void handleTogglePreference(item.topic, event.target.checked)
                  }
                />
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
