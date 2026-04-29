import {
  Bell,
  Camera,
  CreditCard,
  Heart,
  Inbox,
  KeyRound,
  MailCheck,
  MapPin,
  PackageCheck,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PriceLabel } from "../components/price-label";
import { ProductImage } from "../components/product-image";
import { forgotPassword, getGoogleOAuthStartUrl, resetPassword } from "../services/auth-service";
import { markAllNotificationsRead, listNotifications } from "../services/notification-service";
import { getOrderSummary, listOrders } from "../services/order-service";
import { listPaymentHistory } from "../services/payment-service";
import { listProductsByIDs } from "../services/product-service";
import {
  changePassword,
  createAddress,
  deleteAddress,
  getEmailVerificationStatus,
  getPhoneVerificationStatus,
  listAddresses,
  listNotificationPreferences,
  resendEmailVerificationOTP,
  resendPhoneVerificationOTP,
  setDefaultAddress,
  sendEmailVerificationOTP,
  sendPhoneVerificationOTP,
  updateAddress,
  updateNotificationPreferences,
  updateProfile,
  uploadAvatar,
  verifyEmailVerificationOTP,
  verifyPhoneVerificationOTP,
} from "../services/user-service";
import { listWishlistAlerts } from "../services/wishlist-service";
import { useAuth } from "../state/auth-context";
import { useWishlist } from "../state/wishlist-context";
import type {
  Address,
  EmailVerificationStatus,
  NotificationPreference,
  NotificationInboxItem,
  Order,
  Payment,
  PhoneVerificationStatus,
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

const emptyPasswordForm = {
  current_password: "",
  new_password: "",
  confirm_password: "",
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

function notificationHref(notification: NotificationInboxItem) {
  if (notification.action_href) {
    return notification.action_href;
  }
  if (notification.return_id) {
    return `/account/returns/${notification.return_id}`;
  }
  if (notification.order_id) {
    return `/account/orders/${notification.order_id}`;
  }
  if (notification.payment_id) {
    return `/payments/${notification.payment_id}`;
  }
  return "";
}

function notificationActionLabel(notification: NotificationInboxItem) {
  if (notification.action_label) {
    return notification.action_label;
  }
  if (notification.return_id) {
    return "Xem yêu cầu trả hàng";
  }
  if (notification.order_id) {
    return "Xem đơn hàng";
  }
  if (notification.payment_id) {
    return "Xem thanh toán";
  }
  return "";
}

function phoneVerificationLabel(status?: string) {
  const labels: Record<string, string> = {
    pending: "Đang chờ OTP",
    verified: "Đã xác thực OTP",
    locked: "Đã khóa",
    expired: "Hết hạn",
    consumed: "Đã dùng",
  };

  return status ? (labels[status] ?? status) : "Chưa gửi OTP";
}

export function AccountPage() {
  const { token, user, loading, login, register, refreshProfile, logout } = useAuth();
  const {
    items: wishlistItems,
    error: wishlistError,
    removeItem: removeWishlistItem,
  } = useWishlist();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [emailVerification, setEmailVerification] = useState<EmailVerificationStatus | null>(null);
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationStatus | null>(null);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editAddressForm, setEditAddressForm] = useState(emptyAddressForm);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentsByOrder, setPaymentsByOrder] = useState<Record<string, Payment[]>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notifications, setNotifications] = useState<NotificationInboxItem[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference[]>(
    [],
  );
  const [wishlistAlerts, setWishlistAlerts] = useState<WishlistAlert[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Record<string, Product>>({});
  const [error, setError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false);
  const [emailOtpResending, setEmailOtpResending] = useState(false);
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  const [phoneOtpVerifying, setPhoneOtpVerifying] = useState(false);
  const [phoneOtpResending, setPhoneOtpResending] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [notificationUpdating, setNotificationUpdating] = useState(false);
  const [preferenceUpdating, setPreferenceUpdating] = useState<string | null>(null);

  const safeOrders = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);
  const safePayments = useMemo(() => (Array.isArray(payments) ? payments : []), [payments]);
  const safeAddresses = useMemo(() => (Array.isArray(addresses) ? addresses : []), [addresses]);
  const safeNotifications = useMemo(
    () => (Array.isArray(notifications) ? notifications : []),
    [notifications],
  );
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
  const unreadNotifications = safeNotifications.filter((notification) => !notification.read_at);
  const defaultAddress = safeAddresses.find((address) => address.is_default);
  const requestedProfilePhone = profileForm.phone.trim();
  const currentProfilePhone = user?.phone?.trim() ?? "";
  const profilePhoneChanged = requestedProfilePhone !== currentProfilePhone;
  const verifiedPhoneMatchesProfile =
    phoneVerification?.status === "verified" && phoneVerification.phone === requestedProfilePhone;
  const canResendPhoneOtp =
    Boolean(phoneVerification?.verification_id) &&
    phoneVerification?.status === "pending" &&
    (phoneVerification.resend_in_seconds ?? 0) <= 0;
  const canResendEmailOtp =
    Boolean(emailVerification?.verification_id) &&
    emailVerification?.status === "pending" &&
    (emailVerification.resend_in_seconds ?? 0) <= 0;

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
      phone: user.phone ?? "",
    });
  }, [user]);

  useEffect(() => {
    let active = true;

    async function loadEmailVerification() {
      if (!token || user?.email_verified) {
        setEmailVerification(null);
        setEmailOtp("");
        return;
      }

      const status = await getEmailVerificationStatus(token).catch(() => null);
      if (active) {
        setEmailVerification(status);
      }
    }

    void loadEmailVerification();

    return () => {
      active = false;
    };
  }, [token, user?.email_verified]);

  useEffect(() => {
    let active = true;

    async function loadPhoneVerification() {
      if (!token) {
        setPhoneVerification(null);
        setPhoneOtp("");
        return;
      }

      const status = await getPhoneVerificationStatus(token).catch(() => null);
      if (active) {
        setPhoneVerification(status);
      }
    }

    void loadPhoneVerification();

    return () => {
      active = false;
    };
  }, [token]);

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
        setAccountLoading(true);
        setAccountError(null);
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
          setNotifications(
            Array.isArray(notificationResult.value) ? notificationResult.value : [],
          );
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

      const productIds = safeWishlistItems.map((item) => item.product_id);
      const products = await listProductsByIDs(productIds).catch(() => []);

      if (active) {
        setWishlistProducts(
          Object.fromEntries(products.map((product) => [product.id, product] as const)),
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

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      setAuthNotice(null);
      await forgotPassword({ email });
      setAuthNotice("Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.");
      setMode("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được yêu cầu đặt lại mật khẩu");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      setAuthNotice(null);
      await resetPassword({
        token: resetToken.trim(),
        new_password: resetPasswordValue,
      });
      setResetToken("");
      setResetPasswordValue("");
      setAuthNotice("Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.");
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đặt lại được mật khẩu");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    if (profilePhoneChanged) {
      if (!requestedProfilePhone) {
        setProfileStatus("Số điện thoại không được để trống khi cập nhật.");
        return;
      }
      if (!verifiedPhoneMatchesProfile) {
        setProfileStatus("Vui lòng xác thực số điện thoại bằng OTP Telegram trước khi lưu.");
        return;
      }
    }

    try {
      setProfileSubmitting(true);
      setProfileStatus(null);
      await updateProfile(token, {
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        ...(profilePhoneChanged
          ? {
              phone: requestedProfilePhone,
              phone_verification_id: phoneVerification?.verification_id,
            }
          : {}),
      });
      await refreshProfile();
      if (profilePhoneChanged) {
        setPhoneVerification(null);
      }
      setProfileStatus("Đã cập nhật hồ sơ");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không cập nhật được hồ sơ");
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function handleSendEmailOtp() {
    if (!token) {
      return;
    }

    try {
      setEmailOtpSending(true);
      setProfileStatus(null);
      setEmailOtp("");
      const status = await sendEmailVerificationOTP(token);
      setEmailVerification(status);
      setProfileStatus("Đã gửi OTP đến email. Nhập mã để xác thực.");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không gửi được OTP email");
    } finally {
      setEmailOtpSending(false);
    }
  }

  async function handleVerifyEmailOtp() {
    if (!token || !emailVerification?.verification_id) {
      return;
    }

    try {
      setEmailOtpVerifying(true);
      setProfileStatus(null);
      const status = await verifyEmailVerificationOTP(
        token,
        emailVerification.verification_id,
        emailOtp.trim(),
      );
      setEmailVerification(status);
      setEmailOtp("");
      await refreshProfile();
      setProfileStatus("Email đã được xác thực.");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "OTP email không hợp lệ");
    } finally {
      setEmailOtpVerifying(false);
    }
  }

  async function handleResendEmailOtp() {
    if (!token || !emailVerification?.verification_id) {
      return;
    }

    try {
      setEmailOtpResending(true);
      setProfileStatus(null);
      const status = await resendEmailVerificationOTP(token, emailVerification.verification_id);
      setEmailVerification(status);
      setEmailOtp("");
      setProfileStatus("Đã gửi lại OTP email.");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không gửi lại được OTP email");
    } finally {
      setEmailOtpResending(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!token || !file) {
      return;
    }

    try {
      setAvatarUploading(true);
      setProfileStatus(null);
      await uploadAvatar(token, file);
      await refreshProfile();
      setProfileStatus("Đã cập nhật ảnh đại diện");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không tải được ảnh đại diện");
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  }

  async function handleSendPhoneOtp() {
    if (!token) {
      return;
    }
    if (!requestedProfilePhone) {
      setProfileStatus("Nhập số điện thoại trước khi gửi OTP.");
      return;
    }

    try {
      setPhoneOtpSending(true);
      setProfileStatus(null);
      setPhoneOtp("");
      const status = await sendPhoneVerificationOTP(token, requestedProfilePhone);
      setPhoneVerification(status);
      setProfileForm((current) => ({ ...current, phone: status.phone || requestedProfilePhone }));
      setProfileStatus("Đã gửi OTP qua Telegram. Nhập mã để xác thực số điện thoại.");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không gửi được OTP Telegram");
    } finally {
      setPhoneOtpSending(false);
    }
  }

  async function handleVerifyPhoneOtp() {
    if (!token || !phoneVerification?.verification_id) {
      return;
    }

    try {
      setPhoneOtpVerifying(true);
      setProfileStatus(null);
      const status = await verifyPhoneVerificationOTP(
        token,
        phoneVerification.verification_id,
        phoneOtp.trim(),
      );
      setPhoneVerification(status);
      setPhoneOtp("");
      if (status.status === "verified") {
        setProfileForm((current) => ({ ...current, phone: status.phone }));
        setProfileStatus("Số điện thoại đã xác thực. Bấm Lưu hồ sơ để cập nhật.");
      }
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "OTP không hợp lệ");
    } finally {
      setPhoneOtpVerifying(false);
    }
  }

  async function handleResendPhoneOtp() {
    if (!token || !phoneVerification?.verification_id) {
      return;
    }

    try {
      setPhoneOtpResending(true);
      setProfileStatus(null);
      const status = await resendPhoneVerificationOTP(token, phoneVerification.verification_id);
      setPhoneVerification(status);
      setPhoneOtp("");
      setProfileStatus("Đã gửi lại OTP qua Telegram.");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không gửi lại được OTP Telegram");
    } finally {
      setPhoneOtpResending(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordStatus("Mật khẩu mới không khớp.");
      return;
    }

    try {
      setPasswordSubmitting(true);
      setPasswordStatus(null);
      await changePassword(token, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm(emptyPasswordForm);
      setPasswordStatus("Đã đổi mật khẩu.");
    } catch (err) {
      setPasswordStatus(err instanceof Error ? err.message : "Không đổi được mật khẩu");
    } finally {
      setPasswordSubmitting(false);
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

  function startEditAddress(address: Address) {
    setEditingAddressId(address.id);
    setEditAddressForm({
      recipient_name: address.recipient_name,
      phone: address.phone,
      location: address.location,
      is_default: address.is_default,
    });
  }

  async function handleUpdateAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editingAddressId) {
      return;
    }

    try {
      setAddressSubmitting(true);
      setAccountError(null);
      const updated = await updateAddress(token, editingAddressId, editAddressForm);
      setAddresses((current) =>
        (Array.isArray(current) ? current : []).map((address) => {
          if (updated.is_default && address.id !== updated.id) {
            return { ...address, is_default: false };
          }
          return address.id === updated.id ? updated : address;
        }),
      );
      setEditingAddressId(null);
      setEditAddressForm(emptyAddressForm);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Không cập nhật được địa chỉ");
    } finally {
      setAddressSubmitting(false);
    }
  }

  function cancelEditAddress() {
    setEditingAddressId(null);
    setEditAddressForm(emptyAddressForm);
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

  async function handleMarkAllNotificationsRead() {
    if (!token) {
      return;
    }

    try {
      setNotificationUpdating(true);
      setAccountError(null);
      await markAllNotificationsRead(token);
      const nextNotifications = await listNotifications(token, 20).catch(() =>
        safeNotifications.map((notification) => ({
          ...notification,
          read_at: notification.read_at ?? new Date().toISOString(),
        })),
      );
      setNotifications(nextNotifications);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Không cập nhật được thông báo");
    } finally {
      setNotificationUpdating(false);
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
          <h1>
            {mode === "register"
              ? "Tạo tài khoản"
              : mode === "forgot"
                ? "Quên mật khẩu"
                : mode === "reset"
                  ? "Đặt lại mật khẩu"
                  : "Đăng nhập"}
          </h1>
          {mode === "login" || mode === "register" ? (
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
              {authNotice ? <p className="inline-success">{authNotice}</p> : null}
              {error ? <p className="inline-error">{error}</p> : null}
              <button className="button button--primary" type="submit" disabled={submitting}>
                {submitting ? "Đang xử lý" : mode === "login" ? "Đăng nhập" : "Đăng ký"}
              </button>
              <div className="inline-actions">
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
                >
                  {mode === "login" ? "Tạo tài khoản mới" : "Tôi đã có tài khoản"}
                </button>
                {mode === "login" ? (
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => {
                      setError(null);
                      setAuthNotice(null);
                      setMode("forgot");
                    }}
                  >
                    Quên mật khẩu
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}

          {mode === "forgot" ? (
            <form className="auth-form" onSubmit={handleForgotPassword}>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              {authNotice ? <p className="inline-success">{authNotice}</p> : null}
              {error ? <p className="inline-error">{error}</p> : null}
              <button className="button button--primary" type="submit" disabled={submitting}>
                {submitting ? "Đang gửi" : "Gửi hướng dẫn"}
              </button>
              <div className="inline-actions">
                <button className="button button--ghost" type="button" onClick={() => setMode("login")}>
                  Đăng nhập
                </button>
                <button className="button button--ghost" type="button" onClick={() => setMode("reset")}>
                  Tôi đã có token
                </button>
              </div>
            </form>
          ) : null}

          {mode === "reset" ? (
            <form className="auth-form" onSubmit={handleResetPassword}>
              <label>
                Reset token
                <input
                  value={resetToken}
                  onChange={(event) => setResetToken(event.target.value)}
                  required
                />
              </label>
              <label>
                Mật khẩu mới
                <input
                  type="password"
                  value={resetPasswordValue}
                  onChange={(event) => setResetPasswordValue(event.target.value)}
                  required
                />
              </label>
              {authNotice ? <p className="inline-success">{authNotice}</p> : null}
              {error ? <p className="inline-error">{error}</p> : null}
              <button className="button button--primary" type="submit" disabled={submitting}>
                {submitting ? "Đang lưu" : "Đặt lại mật khẩu"}
              </button>
              <div className="inline-actions">
                <button className="button button--ghost" type="button" onClick={() => setMode("login")}>
                  Đăng nhập
                </button>
                <button className="button button--ghost" type="button" onClick={() => setMode("forgot")}>
                  Gửi lại hướng dẫn
                </button>
              </div>
            </form>
          ) : null}
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
        <a href="#profile">Hồ sơ</a>
        <a href="#orders">Đơn hàng</a>
        <Link to="/account/returns">Trả hàng</Link>
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

      <section className="surface-section" id="profile">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Profile</span>
            <h2>Hồ sơ mua hàng</h2>
          </div>
          <ShieldCheck size={24} />
        </div>
        <div className="profile-layout">
          <aside className="avatar-upload-card">
            <div className="account-avatar account-avatar--large">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.first_name || user.email} />
              ) : (
                <span>{getInitials(user.first_name, user.email)}</span>
              )}
            </div>
            <div>
              <strong>Ảnh đại diện</strong>
              <p>JPG, PNG hoặc WebP tối đa 5MB.</p>
            </div>
            <label className="button button--secondary avatar-upload-button">
              <Camera size={16} />
              {avatarUploading ? "Đang tải" : "Đổi ảnh"}
              <input
                type="file"
                accept="image/*"
                disabled={avatarUploading}
                onChange={handleAvatarChange}
              />
            </label>
          </aside>

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

            <div className="profile-verification-card">
              <div className="phone-verification-status">
                <MailCheck size={18} />
                <span className={user.email_verified ? "status-pill is-good" : "status-pill"}>
                  Email {user.email_verified ? "đã xác thực" : phoneVerificationLabel(emailVerification?.status)}
                </span>
                {emailVerification?.email_masked ? <span>{emailVerification.email_masked}</span> : null}
                {emailVerification?.status === "pending" ? (
                  <>
                    <span>Còn {Math.ceil(emailVerification.expires_in_seconds / 60)} phút</span>
                    <span>{emailVerification.remaining_attempts} lần nhập còn lại</span>
                  </>
                ) : null}
              </div>

              {!user.email_verified ? (
                <>
                  <div className="inline-actions">
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={emailOtpSending}
                      onClick={() => void handleSendEmailOtp()}
                    >
                      <Send size={16} />
                      {emailOtpSending ? "Đang gửi" : "Gửi OTP email"}
                    </button>
                    {emailVerification?.verification_id ? (
                      <button
                        className="button button--ghost"
                        type="button"
                        disabled={!canResendEmailOtp || emailOtpResending}
                        onClick={() => void handleResendEmailOtp()}
                      >
                        <RefreshCw size={16} />
                        {emailOtpResending
                          ? "Đang gửi lại"
                          : emailVerification.resend_in_seconds > 0
                            ? `Gửi lại (${emailVerification.resend_in_seconds}s)`
                            : "Gửi lại"}
                      </button>
                    ) : null}
                  </div>

                  {emailVerification?.verification_id &&
                  emailVerification.status !== "verified" ? (
                    <div className="otp-row">
                      <input
                        inputMode="numeric"
                        maxLength={6}
                        value={emailOtp}
                        onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, ""))}
                        placeholder="Mã OTP"
                      />
                      <button
                        className="button button--primary"
                        type="button"
                        disabled={emailOtp.trim().length !== 6 || emailOtpVerifying}
                        onClick={() => void handleVerifyEmailOtp()}
                      >
                        {emailOtpVerifying ? "Đang xác thực" : "Xác thực"}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <label>
              Số điện thoại
              <input
                inputMode="tel"
                value={profileForm.phone}
                onChange={(event) => {
                  const nextPhone = event.target.value;
                  setProfileForm((current) => ({ ...current, phone: nextPhone }));
                  setPhoneVerification((current) =>
                    current?.phone === nextPhone.trim() ? current : null,
                  );
                }}
                placeholder="0987654321"
              />
            </label>

            <div className="profile-verification-card">
              <div className="phone-verification-status">
                <span
                  className={
                    verifiedPhoneMatchesProfile || (!profilePhoneChanged && user.phone_verified)
                      ? "status-pill is-good"
                      : "status-pill"
                  }
                >
                  {profilePhoneChanged
                    ? phoneVerificationLabel(phoneVerification?.status)
                    : user.phone_verified
                      ? "SĐT đã xác thực"
                      : "SĐT chưa xác thực"}
                </span>
                {phoneVerification?.phone_masked ? (
                  <span>{phoneVerification.phone_masked}</span>
                ) : null}
                {phoneVerification?.status === "pending" ? (
                  <>
                    <span>Còn {Math.ceil(phoneVerification.expires_in_seconds / 60)} phút</span>
                    <span>{phoneVerification.remaining_attempts} lần nhập còn lại</span>
                  </>
                ) : null}
              </div>

              <div className="inline-actions">
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={!requestedProfilePhone || phoneOtpSending}
                  onClick={() => void handleSendPhoneOtp()}
                >
                  <Send size={16} />
                  {phoneOtpSending ? "Đang gửi" : "Gửi OTP Telegram"}
                </button>
                {phoneVerification?.verification_id ? (
                  <button
                    className="button button--ghost"
                    type="button"
                    disabled={!canResendPhoneOtp || phoneOtpResending}
                    onClick={() => void handleResendPhoneOtp()}
                  >
                    <RefreshCw size={16} />
                    {phoneOtpResending
                      ? "Đang gửi lại"
                      : phoneVerification.resend_in_seconds > 0
                        ? `Gửi lại (${phoneVerification.resend_in_seconds}s)`
                        : "Gửi lại"}
                  </button>
                ) : null}
              </div>

              {phoneVerification?.verification_id && phoneVerification.status !== "verified" ? (
                <div className="otp-row">
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={phoneOtp}
                    onChange={(event) => setPhoneOtp(event.target.value.replace(/\D/g, ""))}
                    placeholder="Mã OTP"
                  />
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={phoneOtp.trim().length !== 6 || phoneOtpVerifying}
                    onClick={() => void handleVerifyPhoneOtp()}
                  >
                    {phoneOtpVerifying ? "Đang xác thực" : "Xác thực"}
                  </button>
                </div>
              ) : null}

              {verifiedPhoneMatchesProfile && profilePhoneChanged ? (
                <p className="inline-success">OTP hợp lệ, sẵn sàng lưu số mới.</p>
              ) : null}
            </div>

            {profileStatus ? <p className="muted-text">{profileStatus}</p> : null}
            <button className="button button--secondary" type="submit" disabled={profileSubmitting}>
              {profileSubmitting ? "Đang lưu" : "Lưu hồ sơ"}
            </button>
          </form>
        </div>
      </section>

      <section className="surface-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Security</span>
            <h2>Đổi mật khẩu</h2>
          </div>
          <KeyRound size={24} />
        </div>
        <form className="profile-form" onSubmit={handleChangePassword}>
          <div className="form-grid">
            <label>
              Mật khẩu hiện tại
              <input
                type="password"
                value={passwordForm.current_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    current_password: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Mật khẩu mới
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    new_password: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Nhập lại mật khẩu mới
              <input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    confirm_password: event.target.value,
                  }))
                }
                required
              />
            </label>
          </div>
          {passwordStatus ? <p className="muted-text">{passwordStatus}</p> : null}
          <button className="button button--secondary" type="submit" disabled={passwordSubmitting}>
            {passwordSubmitting ? "Đang đổi" : "Đổi mật khẩu"}
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
                    <Link to={`/account/orders/${order.id}`}>{order.id}</Link>
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
                  <Link to={`/payments/${payment.id}`}>{payment.payment_method}</Link>
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
              safeAddresses.map((address) => {
                const isEditing = editingAddressId === address.id;
                return (
                  <article key={address.id} className="address-card">
                    {isEditing ? (
                      <form className="address-edit-form" onSubmit={handleUpdateAddress}>
                        <label>
                          Người nhận
                          <input
                            value={editAddressForm.recipient_name}
                            onChange={(event) =>
                              setEditAddressForm((current) => ({
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
                            value={editAddressForm.phone}
                            onChange={(event) =>
                              setEditAddressForm((current) => ({
                                ...current,
                                phone: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                        <label>
                          Địa chỉ
                          <input
                            value={editAddressForm.location}
                            onChange={(event) =>
                              setEditAddressForm((current) => ({
                                ...current,
                                location: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={editAddressForm.is_default}
                            onChange={(event) =>
                              setEditAddressForm((current) => ({
                                ...current,
                                is_default: event.target.checked,
                              }))
                            }
                          />
                          Đặt làm mặc định
                        </label>
                        <div className="inline-actions">
                          <button
                            className="button button--secondary"
                            type="submit"
                            disabled={addressSubmitting}
                          >
                            Lưu
                          </button>
                          <button
                            className="button button--ghost"
                            type="button"
                            onClick={cancelEditAddress}
                          >
                            <X size={16} />
                            Hủy
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
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
                            onClick={() => startEditAddress(address)}
                          >
                            <Pencil size={16} />
                            Sửa
                          </button>
                          <button
                            className="button button--ghost"
                            type="button"
                            onClick={() => void handleDeleteAddress(address.id)}
                          >
                            Xóa
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })
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

          {safeNotifications.length === 0 ? (
            <p className="muted-text">Chưa có thông báo.</p>
          ) : (
            <div className="notification-list">
              {safeNotifications.map((notification) => {
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
