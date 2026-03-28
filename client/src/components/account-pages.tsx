"use client";

import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { AccountShell } from "@/components/account-shell";
import { StorefrontImage } from "@/components/storefront-image";
import {
  Badge,
  EmptyState,
  Field,
  InlineAlert,
  LoadingScreen,
  StatusPill,
  SurfaceCard,
  TextInput,
} from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { useOrderPayments } from "@/hooks/useOrderPayments";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { orderApi, paymentApi, productApi, userApi } from "@/lib/api";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { cn, fallbackImageForProduct } from "@/lib/utils";
import type { Address, Order, OrderEvent, Payment, PhoneVerificationChallenge, Product } from "@/types/api";
import {
  formatCurrency,
  formatDateTime,
  formatLongDate,
  formatShippingMethodLabel,
  formatShortDate,
  formatShortOrderId,
  formatStatusLabel,
  getDisplayName,
  humanizeToken,
} from "@/utils/format";

const memberSinceFormatter = new Intl.DateTimeFormat("vi-VN", {
  month: "long",
  year: "numeric",
});

function formatMemberSince(createdAt?: string) {
  if (!createdAt) {
    return "Tài khoản mới kích hoạt";
  }

  const parsedDate = new Date(createdAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Tài khoản đã kích hoạt";
  }

  return `Thành viên từ ${memberSinceFormatter.format(parsedDate)}`;
}

function getLeadOrderItem(order: Order) {
  return order.items[0] ?? null;
}

function getOrderPreviewImage(order: Order, productLookup: Record<string, Product>) {
  const leadItem = getLeadOrderItem(order);

  if (!leadItem) {
    return fallbackImageForProduct("Đơn hàng");
  }

  const product = productLookup[leadItem.product_id];
  return product?.image_urls[0] || product?.image_url || fallbackImageForProduct(leadItem.name);
}

function getPaymentMethodIcon(method: string) {
  return method === "credit_card" ? CreditCard : Wallet;
}

function useOrderProductLookup(orders: Order[]) {
  const previewProductIds = useMemo(
    () =>
      Array.from(
        new Set(
          orders
            .map((order) => getLeadOrderItem(order)?.product_id)
            .filter((productId): productId is string => Boolean(productId)),
        ),
      ),
    [orders],
  );
  const [productLookup, setProductLookup] = useState<Record<string, Product>>({});

  useEffect(() => {
    let active = true;

    if (previewProductIds.length === 0) {
      return () => {
        active = false;
      };
    }

    void Promise.allSettled(previewProductIds.map((productId) => productApi.getProductById(productId)))
      .then((results) => {
        if (!active) {
          return;
        }

        const nextLookup: Record<string, Product> = {};
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            nextLookup[result.value.data.id] = result.value.data;
          }
        });
        setProductLookup(nextLookup);
      })
      .catch(() => {
        if (active) {
          setProductLookup({});
        }
      });

    return () => {
      active = false;
    };
  }, [previewProductIds]);

  return useMemo(
    () =>
      Object.fromEntries(
        previewProductIds
          .map((productId) => [productId, productLookup[productId]] as const)
          .filter((entry): entry is [string, Product] => Boolean(entry[1])),
      ),
    [previewProductIds, productLookup],
  );
}

export function ProfileDashboard() {
  const {
    token,
    user,
    updateProfile,
    resendVerificationEmail,
    getPhoneVerificationStatus,
    sendPhoneOtp,
    verifyPhoneOtp,
    resendPhoneOtp,
  } = useAuth();
  const { orders, paymentsByOrder, isLoading } = useOrderPayments(token);
  const { addresses, refreshAddresses } = useSavedAddresses(token);
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [street, setStreet] = useState("");
  const [ward, setWard] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationChallenge | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [otpResendIn, setOtpResendIn] = useState(0);

  useEffect(() => {
    setFirstName(user?.first_name || "");
    setLastName(user?.last_name || "");
    setPhone(user?.phone || "");
  }, [user?.first_name, user?.last_name, user?.phone]);

  const recentOrders = orders.slice(0, 3);
  const paymentCount = Object.values(paymentsByOrder).flat().length;
  const totalPaid = Object.values(paymentsByOrder)
    .flat()
    .reduce((sum, payment) => {
      const direction = payment.transaction_type === "refund" ? -1 : 1;
      return sum + payment.amount * direction;
    }, 0);
  const defaultAddress = addresses.find((address) => address.is_default) ?? addresses[0] ?? null;

  useEffect(() => {
    setStreet(defaultAddress?.street || "");
    setWard(defaultAddress?.ward || "");
    setDistrict(defaultAddress?.district || "");
    setCity(defaultAddress?.city || "");
  }, [defaultAddress?.city, defaultAddress?.district, defaultAddress?.street, defaultAddress?.ward]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    void getPhoneVerificationStatus()
      .then((status) => {
        if (!active) {
          return;
        }
        setPhoneVerification(status);
        setOtpExpiresIn(status?.expires_in_seconds ?? 0);
        setOtpResendIn(status?.resend_in_seconds ?? 0);
      })
      .catch(() => {
        if (active) {
          setPhoneVerification(null);
          setOtpExpiresIn(0);
          setOtpResendIn(0);
        }
      });

    return () => {
      active = false;
    };
  }, [getPhoneVerificationStatus, token]);

  useEffect(() => {
    if (!phoneVerification) {
      setOtpExpiresIn(0);
      setOtpResendIn(0);
      return;
    }

    setOtpExpiresIn(phoneVerification.expires_in_seconds);
    setOtpResendIn(phoneVerification.resend_in_seconds);

    const timer = window.setInterval(() => {
      setOtpExpiresIn((current) => (current > 0 ? current - 1 : 0));
      setOtpResendIn((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [phoneVerification]);

  const profileLocation = defaultAddress
    ? [defaultAddress.district, defaultAddress.city].filter(Boolean).join(", ")
    : "Thêm địa chỉ mặc định để hiển thị khu vực";
  const normalizedCurrentPhone = (user?.phone || "").replace(/\D/g, "");
  const normalizedDraftPhone = phone.replace(/\D/g, "");
  const phoneChanged = normalizedDraftPhone !== normalizedCurrentPhone;
  const phoneIsVerifiedForDraft =
    !phoneChanged ||
    (phoneVerification?.status === "verified" &&
      phoneVerification.phone.replace(/\D/g, "") === normalizedDraftPhone);
  const canSaveProfile = Boolean(firstName.trim() && lastName.trim()) && (!phoneChanged || phoneIsVerifiedForDraft);
  const profilePhone = user?.phone || defaultAddress?.phone || "Chưa cập nhật số điện thoại";
  const phoneStatusLabel = phoneChanged
    ? phoneIsVerifiedForDraft
      ? "pending_save"
      : "pending"
    : user?.phone_verified
      ? "verified"
      : "unverified";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setBusy(true);
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: normalizedDraftPhone || undefined,
        phone_verification_id: phoneChanged ? phoneVerification?.verification_id : undefined,
        default_address: {
          recipient_name: `${firstName} ${lastName}`.trim(),
          phone: normalizedDraftPhone || normalizedCurrentPhone,
          street: street.trim(),
          ward: ward.trim() || undefined,
          district: district.trim(),
          city: city.trim(),
        },
      });
      await refreshAddresses();
      setPhoneVerification(null);
      setOtpCode("");
      setOtpExpiresIn(0);
      setOtpResendIn(0);
      setFeedback("Thông tin hồ sơ đã được cập nhật.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendPhoneOtp() {
    try {
      setOtpBusy(true);
      const result = await sendPhoneOtp(normalizedDraftPhone, telegramChatId.trim());
      setPhoneVerification(result);
      setOtpExpiresIn(result.expires_in_seconds);
      setOtpResendIn(result.resend_in_seconds);
      setOtpCode("");
      setFeedback("OTP đã được gửi qua Telegram.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyOtp() {
    if (!phoneVerification?.verification_id) {
      return;
    }

    try {
      setOtpBusy(true);
      const result = await verifyPhoneOtp(phoneVerification.verification_id, otpCode.trim());
      setPhoneVerification(result);
      setOtpExpiresIn(result.expires_in_seconds);
      setOtpResendIn(result.resend_in_seconds);
      setFeedback("Số điện thoại mới đã xác minh thành công. Bạn có thể lưu hồ sơ.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleResendOtp() {
    if (!phoneVerification?.verification_id) {
      return;
    }

    try {
      setOtpBusy(true);
      const result = await resendPhoneOtp(phoneVerification.verification_id);
      setPhoneVerification(result);
      setOtpExpiresIn(result.expires_in_seconds);
      setOtpResendIn(result.resend_in_seconds);
      setFeedback("OTP mới đã được gửi lại qua Telegram.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleResendVerification() {
    try {
      setBusy(true);
      await resendVerificationEmail();
      setFeedback("Email xác minh mới đã được gửi.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell
      title="Hồ sơ tài khoản"
      description="Tổng hợp thông tin cá nhân, trạng thái xác minh, đơn hàng gần đây và các thiết lập thanh toán trong cùng một màn hình nhất quán với luồng account thực tế."
    >
      {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

      <section className="border-b border-outline-variant/30 pb-10">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-on-primary shadow-editorial">
              {getDisplayName(user?.first_name, user?.last_name)
                .split(" ")
                .map((part) => part.charAt(0))
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <h2 className="font-serif text-4xl font-semibold tracking-[-0.04em] text-primary md:text-5xl">
                {getDisplayName(user?.first_name, user?.last_name)}
              </h2>
              <p className="mt-3 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.22em] text-secondary">
                <BadgeCheck className="h-4 w-4" />
                {formatMemberSince(user?.created_at)}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusPill status={user?.email_verified ? "verified" : "pending"} />
                <Badge className="bg-primary/10 text-primary">{humanizeToken(user?.role || "customer")}</Badge>
                <StatusPill status={phoneStatusLabel} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:min-w-[28rem]">
            <div className="rounded-[1.5rem] bg-surface-container-low px-5 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Orders
              </p>
              <p className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                {orders.length}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-surface-container-low px-5 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Net paid
              </p>
              <p className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                {formatCurrency(totalPaid)}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-surface-container-low px-5 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Addresses
              </p>
              <p className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                {addresses.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-3">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
            <Mail className="h-4 w-4" />
            Email
          </p>
          <p className="text-lg text-primary">{user?.email}</p>
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
            <Phone className="h-4 w-4" />
            Phone
          </p>
          <p className="text-lg text-primary">{profilePhone}</p>
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
            <MapPin className="h-4 w-4" />
            Location
          </p>
          <p className="text-lg text-primary">{profileLocation}</p>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <SurfaceCard className="overflow-hidden">
          <div className="flex flex-col gap-4 px-6 pb-6 pt-6 md:flex-row md:items-end md:justify-between md:px-8 md:pt-8">
            <div>
              <p className="eyebrow">Recent orders</p>
              <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                Đơn hàng gần đây
              </h2>
            </div>
            <Link href="/myorders" className={buttonStyles({ variant: "tertiary" })}>
              Xem toàn bộ
            </Link>
          </div>

          {isLoading ? (
            <div className="px-6 pb-6 md:px-8">
              <LoadingScreen label="Đang tải lịch sử đơn hàng..." />
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="px-6 pb-6 md:px-8">
              <EmptyState
                title="Chưa có đơn hàng"
                description="Sau khi hoàn tất checkout, các đơn gần đây sẽ xuất hiện tại đây."
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto px-6 pb-6 md:block md:px-8">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/20 text-on-surface-variant">
                      <th className="pb-4 text-[10px] font-semibold uppercase tracking-[0.24em]">Order ID</th>
                      <th className="pb-4 text-[10px] font-semibold uppercase tracking-[0.24em]">Date</th>
                      <th className="pb-4 text-[10px] font-semibold uppercase tracking-[0.24em]">Total</th>
                      <th className="pb-4 text-[10px] font-semibold uppercase tracking-[0.24em]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="transition hover:bg-surface-container-high/50">
                        <td className="py-5">
                          <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                            {formatShortOrderId(order.id)}
                          </Link>
                        </td>
                        <td className="py-5 text-sm text-on-surface-variant">{formatShortDate(order.created_at)}</td>
                        <td className="py-5 text-sm font-semibold text-primary">{formatCurrency(order.total_price)}</td>
                        <td className="py-5">
                          <StatusPill status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 px-6 pb-6 md:hidden">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="rounded-[1.5rem] bg-surface px-5 py-5 transition hover:bg-surface-container-high"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold text-primary">{formatShortOrderId(order.id)}</p>
                      <StatusPill status={order.status} />
                    </div>
                    <p className="mt-3 text-sm text-on-surface-variant">
                      {formatShortDate(order.created_at)} · {formatShippingMethodLabel(order.shipping_method)}
                    </p>
                    <p className="mt-3 font-semibold text-primary">{formatCurrency(order.total_price)}</p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </SurfaceCard>

        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <p className="eyebrow">Default address</p>
            {defaultAddress ? (
              <div className="mt-4 space-y-3 text-sm leading-7 text-on-surface-variant">
                <p className="font-semibold text-primary">{defaultAddress.recipient_name}</p>
                <p>{defaultAddress.street}</p>
                <p>
                  {[defaultAddress.ward, defaultAddress.district, defaultAddress.city]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p>{defaultAddress.phone}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-on-surface-variant">
                Chưa có địa chỉ lưu sẵn. Bạn có thể thêm mới tại màn Địa chỉ.
              </p>
            )}
            <Link href="/addresses" className={cn(buttonStyles({ variant: "secondary" }), "mt-6 w-full")}>
              Quản lý địa chỉ
            </Link>
          </SurfaceCard>

          <SurfaceCard className="bg-primary p-6 text-on-primary">
            <div className="flex items-start gap-4">
              <div className="rounded-[1rem] bg-white/10 p-3 text-tertiary-fixed-dim">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-surface">
                  Bảo mật và thanh toán
                </h3>
                <p className="mt-3 text-sm leading-7 text-on-primary/80">
                  {user?.email_verified
                    ? "Email của bạn đã được xác minh. Tiếp theo bạn có thể kiểm tra lịch sử thanh toán hoặc cập nhật mật khẩu."
                    : "Hoàn tất xác minh email để tăng độ an toàn cho tài khoản trước khi tiếp tục mua sắm."}
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <Link href="/payments" className={cn(buttonStyles({ variant: "secondary" }), "border-white/15 bg-white/10 text-white hover:bg-white/15")}>
                    {paymentCount > 0 ? `Xem ${paymentCount} giao dịch` : "Mở lịch sử thanh toán"}
                  </Link>
                  <Link href="/security" className={cn(buttonStyles({ variant: "tertiary" }), "text-tertiary-fixed-dim hover:text-white")}>
                    Đi tới bảo mật
                  </Link>
                </div>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <SurfaceCard className="p-6 md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Profile details</p>
              <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                Cập nhật thông tin cá nhân
              </h2>
            </div>
            <p className="text-sm text-on-surface-variant">{user?.email}</p>
          </div>

          <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
            <Field htmlFor="profile-first-name" label="Tên" required>
              <TextInput
                id="profile-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </Field>
            <Field htmlFor="profile-last-name" label="Họ" required>
              <TextInput
                id="profile-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </Field>
            <Field htmlFor="profile-phone" label="Số điện thoại" required>
              <TextInput
                id="profile-phone"
                inputMode="numeric"
                value={phone}
                onChange={(event) => {
                  const nextPhone = event.target.value;
                  setPhone(nextPhone);
                  if ((phoneVerification?.phone || "").replace(/\D/g, "") !== nextPhone.replace(/\D/g, "")) {
                    setPhoneVerification(null);
                    setOtpCode("");
                    setOtpExpiresIn(0);
                    setOtpResendIn(0);
                  }
                }}
              />
            </Field>
            <Field htmlFor="profile-telegram-chat-id" label="Telegram chat ID" required={phoneChanged && !phoneIsVerifiedForDraft}>
              <TextInput
                id="profile-telegram-chat-id"
                inputMode="numeric"
                value={telegramChatId}
                onChange={(event) => setTelegramChatId(event.target.value)}
                placeholder="Nhập chat ID Telegram để nhận OTP"
              />
            </Field>
            <Field htmlFor="profile-street" label="Địa chỉ" required>
              <TextInput id="profile-street" value={street} onChange={(event) => setStreet(event.target.value)} />
            </Field>
            <Field htmlFor="profile-ward" label="Phường/Xã">
              <TextInput id="profile-ward" value={ward} onChange={(event) => setWard(event.target.value)} />
            </Field>
            <Field htmlFor="profile-district" label="Quận/Huyện" required>
              <TextInput id="profile-district" value={district} onChange={(event) => setDistrict(event.target.value)} />
            </Field>
            <Field htmlFor="profile-city" label="Tỉnh/Thành phố" required>
              <TextInput id="profile-city" value={city} onChange={(event) => setCity(event.target.value)} />
            </Field>
            <div className="md:col-span-2 rounded-[1.5rem] bg-surface px-5 py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">Trạng thái xác thực số điện thoại</p>
                  <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                    {!phoneChanged
                      ? user?.phone_verified
                        ? "Số điện thoại hiện tại đã được xác thực."
                        : "Số điện thoại hiện tại chưa được xác thực."
                      : phoneIsVerifiedForDraft
                        ? "Số điện thoại mới đã xác thực, hãy bấm lưu để cập nhật hồ sơ."
                        : "Bạn cần gửi OTP và xác thực số điện thoại mới trước khi lưu."}
                  </p>
                </div>
                {phoneChanged ? (
                  <button
                    type="button"
                    className={cn(buttonStyles({ variant: "secondary" }), "w-full md:w-auto")}
                    disabled={otpBusy || !normalizedDraftPhone || !telegramChatId.trim() || phoneIsVerifiedForDraft}
                    onClick={() => void handleSendPhoneOtp()}
                  >
                    {otpBusy ? "Đang gửi OTP..." : "Gửi OTP qua Telegram"}
                  </button>
                ) : null}
              </div>

              {phoneChanged ? (
                <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                  <Field htmlFor="profile-otp-code" label="OTP 6 chữ số" required>
                    <TextInput
                      id="profile-otp-code"
                      inputMode="numeric"
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Nhập mã OTP"
                    />
                  </Field>
                  <button
                    type="button"
                    className={cn(buttonStyles({ size: "lg" }), "w-full md:w-auto")}
                    disabled={otpBusy || !phoneVerification?.verification_id || otpCode.trim().length !== 6}
                    onClick={() => void handleVerifyOtp()}
                  >
                    {otpBusy ? "Đang xác minh..." : "Xác minh OTP"}
                  </button>
                  <button
                    type="button"
                    className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full md:w-auto")}
                    disabled={otpBusy || !phoneVerification?.verification_id || otpResendIn > 0}
                    onClick={() => void handleResendOtp()}
                  >
                    {otpResendIn > 0 ? `Gửi lại sau ${otpResendIn}s` : "Gửi lại OTP"}
                  </button>
                </div>
              ) : null}

              {phoneVerification ? (
                <div className="mt-4 text-sm leading-7 text-on-surface-variant">
                  <p>Trạng thái challenge: <span className="font-semibold text-primary">{phoneVerification.status}</span></p>
                  <p>OTP hết hạn sau: <span className="font-semibold text-primary">{otpExpiresIn}s</span></p>
                  <p>Số lần thử còn lại: <span className="font-semibold text-primary">{phoneVerification.remaining_attempts}</span></p>
                </div>
              ) : null}
            </div>
            <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className={cn(buttonStyles({ size: "lg" }), "w-full sm:w-auto")}
                disabled={busy || !canSaveProfile}
              >
                {busy ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
              {!user?.email_verified ? (
                <button
                  type="button"
                  className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full sm:w-auto")}
                  disabled={busy}
                  onClick={() => void handleResendVerification()}
                >
                  Gửi lại email xác minh
                </button>
              ) : null}
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-6 md:p-8">
          <p className="eyebrow">Account snapshot</p>
          <div className="mt-6 space-y-5">
            <div className="rounded-[1.5rem] bg-surface px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-primary" />
                  <span className="font-medium text-primary">Đơn hàng đã đồng bộ</span>
                </div>
                <strong className="font-serif text-2xl font-semibold text-primary">{orders.length}</strong>
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-surface px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span className="font-medium text-primary">Giao dịch ghi nhận</span>
                </div>
                <strong className="font-serif text-2xl font-semibold text-primary">{paymentCount}</strong>
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-surface px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span className="font-medium text-primary">Địa chỉ sẵn sàng checkout</span>
                </div>
                <strong className="font-serif text-2xl font-semibold text-primary">{addresses.length}</strong>
              </div>
            </div>
          </div>
        </SurfaceCard>
      </section>
    </AccountShell>
  );
}

export function OrdersPageView() {
  const { token } = useAuth();
  const { orders, isLoading, error } = useOrderPayments(token);
  const productLookup = useOrderProductLookup(orders);

  return (
    <AccountShell
      title="Lịch sử đơn hàng"
      description="Xem lại toàn bộ đơn đã đặt, trạng thái hiện tại, mặt hàng đại diện và tổng tiền thanh toán trong bố cục bám sát visual language của Stitch."
    >
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      {isLoading ? (
        <LoadingScreen label="Đang tải lịch sử đơn hàng..." />
      ) : orders.length === 0 ? (
        <EmptyState title="Bạn chưa có đơn hàng nào" description="Hoàn tất checkout để order-service bắt đầu ghi nhận lịch sử mua sắm." />
      ) : (
        <div className="space-y-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm leading-7 text-on-surface-variant">
              Đang hiển thị toàn bộ <span className="font-semibold text-primary">{orders.length}</span> đơn hàng đã đồng bộ.
            </p>
            <Badge>Order archive</Badge>
          </div>

          <div className="grid gap-8">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="group overflow-hidden rounded-[2rem] bg-surface-container-low transition duration-500 hover:bg-surface-container"
            >
              <div className="flex h-full flex-col md:flex-row">
                <div className="relative h-64 w-full overflow-hidden md:w-64 md:shrink-0">
                  <StorefrontImage
                    alt={getLeadOrderItem(order)?.name || formatShortOrderId(order.id)}
                    src={getOrderPreviewImage(order, productLookup)}
                    fill
                    sizes="(min-width: 768px) 256px, 100vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.05]"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between p-6 md:p-8 lg:p-10">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                        Order reference
                      </span>
                      <h2 className="mt-3 font-serif text-[1.9rem] font-semibold tracking-[-0.03em] text-primary">
                        {formatShortOrderId(order.id)}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                        {formatShortDate(order.created_at)} · {getLeadOrderItem(order)?.name || `${order.items.length} mặt hàng`}
                      </p>
                      <p className="text-sm leading-7 text-on-surface-variant">
                        {formatShippingMethodLabel(order.shipping_method)} · {order.items.length} mặt hàng
                      </p>
                    </div>

                    <StatusPill status={order.status} />
                  </div>

                  <div className="mt-8 flex items-end justify-between gap-4 border-t border-outline-variant/20 pt-6">
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                        Total amount
                      </span>
                      <p className="mt-3 font-serif text-[2rem] font-semibold tracking-[-0.03em] text-primary">
                        {formatCurrency(order.total_price)}
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                      Xem chi tiết
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          </div>

          <div className="flex flex-col items-center gap-6 pt-4">
            <div className="h-px w-24 bg-outline-variant/30" />
            <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">
              Lịch sử đơn hàng được lấy trực tiếp từ order-service
            </p>
          </div>
        </div>
      )}
    </AccountShell>
  );
}

export function OrderDetailPageView({ orderId }: { orderId: string }) {
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [productLookup, setProductLookup] = useState<Record<string, Product>>({});
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isConfirmation = searchParams.get("confirmation") === "1";
  const selectedPaymentId = searchParams.get("paymentId") ?? "";

  useEffect(() => {
    let active = true;

    if (!token) {
      return () => {
        active = false;
      };
    }

    setIsLoading(true);
    void Promise.all([
      orderApi.getOrderById(token, orderId),
      orderApi.getOrderEvents(token, orderId).catch(() => ({ data: [] as OrderEvent[] })),
      paymentApi.listPaymentsByOrder(token, orderId).catch(() => ({ data: [] as Payment[] })),
    ])
      .then(async ([orderResponse, eventsResponse, paymentsResponse]) => {
        if (!active) {
          return;
        }

        setOrder(orderResponse.data);
        setEvents(eventsResponse.data);
        setPayments(paymentsResponse.data);

        const productIds = Array.from(new Set(orderResponse.data.items.map((item) => item.product_id).filter(Boolean)));
        const results = await Promise.allSettled(productIds.map((productId) => productApi.getProductById(productId)));
        const nextLookup: Record<string, Product> = {};
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            nextLookup[result.value.data.id] = result.value.data;
          }
        });
        if (active) {
          setProductLookup(nextLookup);
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [orderId, token]);

  async function handleCancelOrder() {
    if (!token || !order) {
      return;
    }

    try {
      setBusy(true);
      await orderApi.cancelOrder(token, order.id);
      const refreshedOrder = await orderApi.getOrderById(token, order.id);
      const refreshedEvents = await orderApi.getOrderEvents(token, order.id).catch(() => ({ data: [] as OrderEvent[] }));
      setOrder(refreshedOrder.data);
      setEvents(refreshedEvents.data);
      setFeedback("Đơn hàng đã được hủy.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  const latestPayment = selectedPaymentId
    ? payments.find((payment) => payment.id === selectedPaymentId) ?? payments[0]
    : payments[0];

  return (
    <AccountShell title={isConfirmation ? "Xác nhận đơn hàng" : "Chi tiết đơn hàng"} description="Theo dõi trạng thái đơn, timeline sự kiện, thanh toán và toàn bộ line items từ backend thật.">
      {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

      {isLoading ? (
        <LoadingScreen label="Đang tải chi tiết đơn hàng..." />
      ) : !order ? (
        <EmptyState title="Không tìm thấy đơn hàng" description="Order ID có thể không tồn tại hoặc bạn không có quyền truy cập." />
      ) : (
        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Order summary</p>
                <h2 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary">
                  {formatShortOrderId(order.id)}
                </h2>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                  {formatLongDate(order.created_at)} · {formatShippingMethodLabel(order.shipping_method)}
                </p>
              </div>
              <div className="text-right">
                <StatusPill status={order.status} />
                <p className="mt-3 font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">
                  {formatCurrency(order.total_price)}
                </p>
              </div>
            </div>

            {latestPayment?.checkout_url ? (
              <div className="mt-6">
                <InlineAlert tone="info">
                  Payment provider đã trả về một hosted checkout URL. Bạn có thể mở lại bất cứ lúc nào tại{" "}
                  <a className="font-medium underline" href={latestPayment.checkout_url} rel="noreferrer" target="_blank">
                    đây
                  </a>
                  .
                </InlineAlert>
              </div>
            ) : null}

            {order.status === "pending" ? (
              <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "mt-6")} disabled={busy} onClick={() => void handleCancelOrder()}>
                {busy ? "Đang hủy..." : "Hủy đơn hàng"}
              </button>
            ) : null}
          </SurfaceCard>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <SurfaceCard className="p-6">
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Sản phẩm trong đơn</h3>
                <div className="mt-6 grid gap-4">
                  {order.items.map((item) => {
                    const product = productLookup[item.product_id];
                    return (
                      <div key={item.id} className="flex gap-4 rounded-[1.5rem] bg-surface p-4">
                        <div className="relative h-24 w-20 overflow-hidden rounded-[1rem] bg-surface-container-low">
                          <StorefrontImage
                            alt={item.name}
                            src={product?.image_urls[0] || product?.image_url || fallbackImageForProduct(item.name)}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-primary">{item.name}</p>
                          <p className="mt-2 text-sm text-on-surface-variant">{product?.brand || "Commerce Platform"}</p>
                          <p className="mt-2 text-sm text-on-surface-variant">Số lượng: {item.quantity}</p>
                        </div>
                        <strong className="text-sm text-primary">{formatCurrency(item.price * item.quantity)}</strong>
                      </div>
                    );
                  })}
                </div>
              </SurfaceCard>

              <SurfaceCard className="p-6">
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Timeline xử lý</h3>
                <div className="mt-6 space-y-4">
                  {events.length === 0 ? (
                    <p className="text-sm leading-7 text-on-surface-variant">Chưa có event timeline chi tiết.</p>
                  ) : (
                    events.map((event) => (
                      <div key={event.id} className="rounded-[1.25rem] bg-surface p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold text-primary">{event.message || formatStatusLabel(event.status)}</p>
                          <StatusPill status={event.status} />
                        </div>
                        <p className="mt-2 text-sm text-on-surface-variant">{formatDateTime(event.created_at)}</p>
                      </div>
                    ))
                  )}
                </div>
              </SurfaceCard>
            </div>

            <div className="space-y-6">
              <SurfaceCard className="p-6">
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Tổng thanh toán</h3>
                <div className="mt-6 space-y-3 text-sm text-on-surface-variant">
                  <div className="flex items-center justify-between">
                    <span>Tạm tính</span>
                    <strong className="text-primary">{formatCurrency(order.subtotal_price)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Giảm giá</span>
                    <strong className="text-primary">-{formatCurrency(order.discount_amount)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{formatShippingMethodLabel(order.shipping_method)}</span>
                    <strong className="text-primary">{formatCurrency(order.shipping_fee)}</strong>
                  </div>
                  <div className="flex items-center justify-between border-t border-outline-variant/20 pt-3">
                    <span>Tổng cộng</span>
                    <strong className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">{formatCurrency(order.total_price)}</strong>
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard className="p-6">
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Thanh toán</h3>
                <div className="mt-6 space-y-4">
                  {payments.length === 0 ? (
                    <p className="text-sm leading-7 text-on-surface-variant">Chưa có payment records cho đơn này.</p>
                  ) : (
                    payments.map((payment) => (
                      <div key={payment.id} className="rounded-[1.25rem] bg-surface p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-primary">{humanizeToken(payment.payment_method)} · {humanizeToken(payment.gateway_provider)}</p>
                          <StatusPill status={payment.status} />
                        </div>
                        <p className="mt-2 text-sm text-on-surface-variant">{formatDateTime(payment.created_at)}</p>
                        <p className="mt-2 text-sm text-on-surface-variant">Số tiền: {formatCurrency(payment.amount)}</p>
                      </div>
                    ))
                  )}
                </div>
              </SurfaceCard>
            </div>
          </div>
        </div>
      )}
    </AccountShell>
  );
}

export function AddressesPageView() {
  const { token } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({
    recipient_name: "",
    phone: "",
    street: "",
    ward: "",
    district: "",
    city: "",
    is_default: false,
  });

  const reload = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await userApi.listAddresses(token);
      setAddresses(response.data);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function resetForm() {
    setEditingId("");
    setForm({
      recipient_name: "",
      phone: "",
      street: "",
      ward: "",
      district: "",
      city: "",
      is_default: false,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      if (editingId) {
        await userApi.updateAddress(token, editingId, form);
        setFeedback("Địa chỉ đã được cập nhật.");
      } else {
        await userApi.createAddress(token, form);
        setFeedback("Địa chỉ mới đã được lưu.");
      }
      resetForm();
      await reload();
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(addressId: string) {
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      await userApi.deleteAddress(token, addressId);
      setFeedback("Địa chỉ đã được xóa.");
      await reload();
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleSetDefault(addressId: string) {
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      await userApi.setDefaultAddress(token, addressId);
      setFeedback("Đã cập nhật địa chỉ mặc định.");
      await reload();
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell title="Địa chỉ giao hàng" description="Quản lý đầy đủ create, update, delete và set default cho địa chỉ người dùng bằng API thật của user-service.">
      {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <SurfaceCard className="p-6">
          <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
            {editingId ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}
          </h2>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <TextInput placeholder="Tên người nhận" value={form.recipient_name} onChange={(event) => setForm((current) => ({ ...current, recipient_name: event.target.value }))} />
            <TextInput placeholder="Số điện thoại" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            <TextInput placeholder="Địa chỉ" value={form.street} onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))} />
            <TextInput placeholder="Phường / xã" value={form.ward} onChange={(event) => setForm((current) => ({ ...current, ward: event.target.value }))} />
            <TextInput placeholder="Quận / huyện" value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} />
            <TextInput placeholder="Tỉnh / thành phố" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
            <label className="flex items-center gap-3 text-sm text-on-surface-variant">
              <input checked={form.is_default} type="checkbox" onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked }))} />
              Đặt làm địa chỉ mặc định
            </label>
            <div className="flex flex-col gap-3">
              <button type="submit" className={cn(buttonStyles({ size: "lg" }), "w-full")} disabled={busy}>
                {busy ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Tạo địa chỉ"}
              </button>
              {editingId ? (
                <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")} onClick={resetForm}>
                  Hủy chỉnh sửa
                </button>
              ) : null}
            </div>
          </form>
        </SurfaceCard>

        <div>
          {isLoading ? (
            <LoadingScreen label="Đang tải sổ địa chỉ..." />
          ) : addresses.length === 0 ? (
            <EmptyState title="Chưa có địa chỉ" description="Tạo địa chỉ đầu tiên để checkout nhanh hơn trong các lần mua tiếp theo." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {addresses.map((address) => (
                <SurfaceCard key={address.id} className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-primary">{address.recipient_name}</p>
                      <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                        {address.street}
                        <br />
                        {[address.ward, address.district, address.city].filter(Boolean).join(", ")}
                      </p>
                      <p className="mt-2 text-sm text-on-surface-variant">{address.phone}</p>
                    </div>
                    {address.is_default ? <StatusPill status="default" /> : null}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" className={buttonStyles({ variant: "secondary" })} onClick={() => { setEditingId(address.id); setForm({ ...address, ward: address.ward || "" }); }}>
                      Sửa
                    </button>
                    {!address.is_default ? (
                      <button type="button" className={buttonStyles({ variant: "secondary" })} onClick={() => void handleSetDefault(address.id)}>
                        Đặt mặc định
                      </button>
                    ) : null}
                    <button type="button" className={buttonStyles({ variant: "tertiary" })} onClick={() => void handleDelete(address.id)}>
                      Xóa
                    </button>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </AccountShell>
  );
}

export function PaymentsPageView() {
  const { token } = useAuth();
  const { orders, paymentsByOrder, isLoading, error } = useOrderPayments(token);

  const paymentEntries = useMemo(
    () =>
      orders
        .flatMap((order) => (paymentsByOrder[order.id] ?? []).map((payment) => ({ payment, order })))
        .sort((left, right) => Date.parse(right.payment.created_at) - Date.parse(left.payment.created_at)),
    [orders, paymentsByOrder],
  );
  const paymentMethodCards = useMemo(() => {
    const paymentMethodMap = new Map<
      string,
      {
        key: string;
        paymentMethod: string;
        gatewayProvider: string;
        lastUsedAt: string;
        usageCount: number;
        totalAmount: number;
      }
    >();

    paymentEntries.forEach(({ payment }) => {
      const key = `${payment.payment_method}:${payment.gateway_provider}`;
      const existingEntry = paymentMethodMap.get(key);

      if (existingEntry) {
        existingEntry.usageCount += 1;
        existingEntry.totalAmount += payment.amount;
        if (Date.parse(payment.created_at) > Date.parse(existingEntry.lastUsedAt)) {
          existingEntry.lastUsedAt = payment.created_at;
        }
        return;
      }

      paymentMethodMap.set(key, {
        key,
        paymentMethod: payment.payment_method,
        gatewayProvider: payment.gateway_provider,
        lastUsedAt: payment.created_at,
        usageCount: 1,
        totalAmount: payment.amount,
      });
    });

    return Array.from(paymentMethodMap.values()).sort((left, right) => {
      if (right.usageCount !== left.usageCount) {
        return right.usageCount - left.usageCount;
      }
      return Date.parse(right.lastUsedAt) - Date.parse(left.lastUsedAt);
    });
  }, [paymentEntries]);

  const totalPaid = paymentEntries.reduce((sum, entry) => {
    const direction = entry.payment.transaction_type === "refund" ? -1 : 1;
    return sum + entry.payment.amount * direction;
  }, 0);

  return (
    <AccountShell
      title="Lịch sử thanh toán"
      description="Tổng hợp giao dịch, phương thức thanh toán đã dùng và billing history theo đúng dữ liệu từ payment-service."
    >
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      {isLoading ? (
        <LoadingScreen label="Đang tải lịch sử thanh toán..." />
      ) : paymentEntries.length === 0 ? (
        <EmptyState title="Chưa có giao dịch nào" description="Sau khi thanh toán thành công, payment records sẽ xuất hiện tại đây." />
      ) : (
        <div className="space-y-12">
          <section className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge className="bg-secondary text-on-secondary">Secure billing</Badge>
                <div className="mt-4 space-y-2">
                  <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                    Payment methods
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-on-surface-variant">
                    {paymentEntries.length} giao dịch trên {orders.length} đơn hàng, giá trị ròng{" "}
                    <span className="font-semibold text-primary">{formatCurrency(totalPaid)}</span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {paymentMethodCards.slice(0, 2).map((methodCard, index) => {
                const Icon = getPaymentMethodIcon(methodCard.paymentMethod);
                const isPrimary = index === 0;

                return (
                  <SurfaceCard key={methodCard.key} className="p-7 transition duration-300 hover:bg-surface-container">
                    <div className="flex items-start justify-between gap-4">
                      <Icon className="h-7 w-7 text-primary" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                        {humanizeToken(methodCard.gatewayProvider)}
                      </span>
                    </div>
                    <div className="mt-10">
                      <p className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                        {humanizeToken(methodCard.paymentMethod)}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                        Dùng {methodCard.usageCount} lần · gần nhất {formatShortDate(methodCard.lastUsedAt)}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                        Tổng giá trị xử lý {formatCurrency(methodCard.totalAmount)}
                      </p>
                    </div>
                    <div className="mt-8 flex items-center gap-2">
                      {isPrimary ? (
                        <>
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                            Primary usage
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                          Transaction derived
                        </span>
                      )}
                    </div>
                  </SurfaceCard>
                );
              })}

              <div className="flex min-h-[18rem] flex-col items-center justify-center gap-4 rounded-[1.5rem] border border-dashed border-outline-variant bg-transparent px-7 py-8 text-center transition duration-300 hover:border-primary hover:bg-surface-container-low">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-primary">Phương thức mới sẽ xuất hiện sau checkout</p>
                  <p className="text-sm leading-7 text-on-surface-variant">
                    Repo hiện chưa có API quản lý thẻ lưu sẵn, nên màn này hiển thị phương thức thực sự đã được dùng.
                  </p>
                </div>
                <Link href="/checkout" className={buttonStyles({ variant: "secondary" })}>
                  Đi tới checkout
                </Link>
              </div>
            </div>
          </section>

          <section className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                Billing history
              </h2>
              <p className="text-sm leading-7 text-on-surface-variant">
                Lịch sử này được tổng hợp trực tiếp từ endpoint `/api/v1/payments/history`.
              </p>
            </div>

            <SurfaceCard className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-on-surface-variant">
                    <th className="px-8 py-6 text-[10px] font-semibold uppercase tracking-[0.24em]">Order ID</th>
                    <th className="px-8 py-6 text-[10px] font-semibold uppercase tracking-[0.24em]">Date</th>
                    <th className="px-8 py-6 text-[10px] font-semibold uppercase tracking-[0.24em]">Method</th>
                    <th className="px-8 py-6 text-[10px] font-semibold uppercase tracking-[0.24em]">Status</th>
                    <th className="px-8 py-6 text-right text-[10px] font-semibold uppercase tracking-[0.24em]">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {paymentEntries.map(({ payment }) => {
                    const Icon = getPaymentMethodIcon(payment.payment_method);

                    return (
                      <tr key={payment.id} className="transition hover:bg-surface-container-high/60">
                        <td className="px-8 py-6">
                          <Link href={`/orders/${payment.order_id}`} className="font-medium text-primary hover:underline">
                            {formatShortOrderId(payment.order_id)}
                          </Link>
                        </td>
                        <td className="px-8 py-6 text-sm text-on-surface-variant">{formatShortDate(payment.created_at)}</td>
                        <td className="px-8 py-6 text-sm text-primary">
                          <span className="inline-flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {humanizeToken(payment.payment_method)} · {humanizeToken(payment.gateway_provider)}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <StatusPill status={payment.status} />
                        </td>
                        <td className="px-8 py-6 text-right text-sm font-semibold text-primary">
                          {formatCurrency(payment.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SurfaceCard>

            <div className="grid gap-4 md:hidden">
              {paymentEntries.map(({ payment, order }) => {
                const Icon = getPaymentMethodIcon(payment.payment_method);

                return (
                  <Link
                    key={payment.id}
                    href={`/orders/${payment.order_id}`}
                    className="block rounded-[1.75rem] bg-surface-container-low px-5 py-5 transition hover:bg-surface-container"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-primary">{formatShortOrderId(payment.order_id)}</p>
                        <p className="mt-2 text-sm text-on-surface-variant">{formatDateTime(payment.created_at)}</p>
                        <p className="mt-3 inline-flex items-center gap-2 text-sm text-on-surface-variant">
                          <Icon className="h-4 w-4 text-primary" />
                          {humanizeToken(payment.payment_method)} · {humanizeToken(payment.gateway_provider)}
                        </p>
                        <p className="mt-2 text-sm text-on-surface-variant">
                          Đơn hàng tạo ngày {formatShortDate(order.created_at)}
                        </p>
                      </div>
                      <StatusPill status={payment.status} />
                    </div>
                    <p className="mt-4 font-semibold text-primary">{formatCurrency(payment.amount)}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </AccountShell>
  );
}

export function SecurityPageView() {
  const { user, changePassword, resendVerificationEmail, token } = useAuth();
  const { orders, paymentsByOrder } = useOrderPayments(token);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const latestPayment = useMemo(
    () =>
      Object.values(paymentsByOrder)
        .flat()
        .slice()
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0],
    [paymentsByOrder],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setFeedback("Mật khẩu mới cần tối thiểu 8 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    try {
      setBusy(true);
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback("Mật khẩu đã được cập nhật.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendVerification() {
    try {
      setBusy(true);
      await resendVerificationEmail();
      setFeedback("Email xác minh mới đã được gửi.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell title="Bảo mật tài khoản" description="Đổi mật khẩu bằng API thật của user-service và theo dõi các tín hiệu hoạt động gần nhất của tài khoản.">
      {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SurfaceCard className="p-6">
          <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">Đổi mật khẩu</h2>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <TextInput autoComplete="current-password" placeholder="Mật khẩu hiện tại" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            <TextInput autoComplete="new-password" placeholder="Mật khẩu mới" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            <TextInput autoComplete="new-password" placeholder="Xác nhận mật khẩu mới" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            <button type="submit" className={cn(buttonStyles({ size: "lg" }), "w-full")} disabled={busy}>
              {busy ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
            </button>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Xác minh email</h3>
          <p className="mt-4 text-sm leading-7 text-on-surface-variant">
            {user?.email_verified ? "Email đã được xác minh." : "Email chưa được xác minh. Hãy gửi lại email xác minh để tăng độ an toàn của tài khoản."}
          </p>
          {!user?.email_verified ? (
            <button type="button" className={cn(buttonStyles({ variant: "secondary" }), "mt-6 w-full")} disabled={busy} onClick={() => void handleResendVerification()}>
              Gửi lại email xác minh
            </button>
          ) : null}
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-6">
        <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Hoạt động gần đây</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.25rem] bg-surface p-4">
            <p className="font-semibold text-primary">Email tài khoản</p>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">{user?.email}</p>
          </div>
          <div className="rounded-[1.25rem] bg-surface p-4">
            <p className="font-semibold text-primary">Đơn hàng gần nhất</p>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">{orders[0] ? formatLongDate(orders[0].updated_at) : "Chưa có dữ liệu"}</p>
          </div>
          <div className="rounded-[1.25rem] bg-surface p-4">
            <p className="font-semibold text-primary">Thanh toán gần nhất</p>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">{latestPayment ? formatLongDate(latestPayment.created_at) : "Chưa có dữ liệu"}</p>
          </div>
        </div>
      </SurfaceCard>
    </AccountShell>
  );
}

export function NotificationsPageView() {
  const { token, user } = useAuth();
  const { orders, paymentsByOrder } = useOrderPayments(token);
  const [prefs, setPrefs] = useState({
    emailAlerts: true,
    smsNotifications: false,
    orderUpdates: true,
    securityAlerts: true,
  });

  const latestPayment = useMemo(
    () =>
      Object.values(paymentsByOrder)
        .flat()
        .slice()
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0],
    [paymentsByOrder],
  );

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
    <AccountShell title="Thông báo & activity" description="Trang này gom các tín hiệu quan trọng từ orders, payments và trạng thái tài khoản để người dùng xử lý nhanh hơn.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["emailAlerts", "Email alerts", "Nhận tóm tắt đơn hàng và cập nhật giao dịch qua email."],
          ["smsNotifications", "SMS notifications", "Thông báo ngắn gọn cho các trạng thái cần chú ý."],
          ["orderUpdates", "Order updates", "Cập nhật mọi bước xử lý đơn hàng."],
          ["securityAlerts", "Security alerts", "Nhắc nhở về email verification và password changes."],
        ].map(([key, title, description]) => (
          <SurfaceCard key={key} className="p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-primary">{title}</p>
              <input checked={prefs[key as keyof typeof prefs]} type="checkbox" onChange={(event) => setPrefs((current) => ({ ...current, [key]: event.target.checked }))} />
            </div>
            <p className="mt-4 text-sm leading-7 text-on-surface-variant">{description}</p>
          </SurfaceCard>
        ))}
      </div>

      <SurfaceCard className="p-6">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">Activity feed</h2>
        <div className="mt-6 grid gap-4">
          {feed.map((item) => (
            <Link key={item.id} href={item.href} className="rounded-[1.5rem] bg-surface p-5 transition hover:bg-surface-container-high">
              <p className="font-semibold text-primary">{item.title}</p>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">{item.description}</p>
            </Link>
          ))}
        </div>
      </SurfaceCard>
    </AccountShell>
  );
}
