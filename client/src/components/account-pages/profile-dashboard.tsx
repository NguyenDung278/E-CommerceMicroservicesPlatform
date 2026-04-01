"use client";

import {
  BadgeCheck,
  CreditCard,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { AccountShell } from "@/components/account-shell";
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
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { invalidateSavedAddressesResource } from "@/lib/resources/account-resources";
import { cn } from "@/lib/utils";
import type { PhoneVerificationChallenge, ProfileAddressPatch } from "@/types/api";
import {
  formatCurrency,
  formatShippingMethodLabel,
  formatShortDate,
  formatShortOrderId,
  getDisplayName,
  humanizeToken,
} from "@/utils/format";

import {
  formatMemberSince,
  formatSecondsLabel,
  getNetPaidAmount,
  isValidStoredPhone,
  isValidVietnamesePhone,
  normalizeInputText,
  normalizePhoneDigits,
  type ProfileFeedback,
  type ProfileFieldErrors,
} from "./shared";

export function ProfileDashboard() {
  const {
    token,
    user,
    updateProfile,
    refreshProfile,
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
  const [recipientName, setRecipientName] = useState("");
  const [street, setStreet] = useState("");
  const [ward, setWard] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationChallenge | null>(null);
  const [feedback, setFeedback] = useState<ProfileFeedback | null>(null);
  const [formErrors, setFormErrors] = useState<ProfileFieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [otpResendIn, setOtpResendIn] = useState(0);

  const recentOrders = orders.slice(0, 3);
  const paymentCount = Object.values(paymentsByOrder).flat().length;
  const totalPaid = getNetPaidAmount(paymentsByOrder);
  const defaultAddress = addresses.find((address) => address.is_default) ?? addresses[0] ?? null;
  const displayName = getDisplayName(user?.first_name, user?.last_name);

  useEffect(() => {
    setFirstName(user?.first_name || "");
    setLastName(user?.last_name || "");
    setPhone(user?.phone || "");
  }, [user?.first_name, user?.last_name, user?.phone]);

  useEffect(() => {
    setRecipientName(defaultAddress?.recipient_name || displayName);
    setStreet(defaultAddress?.street || "");
    setWard(defaultAddress?.ward || "");
    setDistrict(defaultAddress?.district || "");
    setCity(defaultAddress?.city || "");
  }, [
    defaultAddress?.city,
    defaultAddress?.district,
    defaultAddress?.recipient_name,
    defaultAddress?.street,
    defaultAddress?.ward,
    displayName,
  ]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    // Restore any existing OTP challenge so a refresh does not hide a pending verification.
    void getPhoneVerificationStatus()
      .then((status) => {
        if (!active) {
          return;
        }

        setPhoneVerification(status);
        setOtpExpiresIn(status?.expires_in_seconds ?? 0);
        setOtpResendIn(status?.resend_in_seconds ?? 0);

        if (status?.phone && normalizePhoneDigits(status.phone) !== normalizePhoneDigits(user?.phone || "")) {
          setPhone(status.phone);
        }
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
  }, [getPhoneVerificationStatus, token, user?.phone]);

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

  const normalizedCurrentPhone = normalizePhoneDigits(user?.phone || "");
  const normalizedDraftPhone = normalizePhoneDigits(phone);
  const verificationPhone = normalizePhoneDigits(phoneVerification?.phone || "");
  const normalizedCurrentAddressPhone = normalizePhoneDigits(defaultAddress?.phone || user?.phone || "");
  const phoneChanged = normalizedDraftPhone !== normalizedCurrentPhone;
  const hasValidPhoneDraft = phoneChanged && isValidVietnamesePhone(normalizedDraftPhone);
  const verificationMatchesDraft = verificationPhone !== "" && verificationPhone === normalizedDraftPhone;
  const phoneIsVerifiedForDraft =
    !phoneChanged || (phoneVerification?.status === "verified" && verificationMatchesDraft);
  const verificationPendingForDraft =
    phoneChanged && phoneVerification?.status === "pending" && verificationMatchesDraft;
  const otpPanelVisible = phoneChanged && !phoneIsVerifiedForDraft;
  const profileLocation = defaultAddress
    ? [defaultAddress.district, defaultAddress.city].filter(Boolean).join(", ")
    : "Thêm địa chỉ mặc định để hiển thị khu vực";
  const profilePhone = user?.phone || "Chưa cập nhật số điện thoại";
  const phoneStatusLabel = phoneChanged
    ? phoneIsVerifiedForDraft
      ? "pending_save"
      : "pending"
    : user?.phone_verified
      ? "verified"
      : "unverified";

  const firstNameValue = normalizeInputText(firstName);
  const lastNameValue = normalizeInputText(lastName);
  const recipientNameValue = normalizeInputText(recipientName);
  const streetValue = street.trim();
  const wardValue = ward.trim();
  const districtValue = district.trim();
  const cityValue = city.trim();
  const currentFirstNameValue = normalizeInputText(user?.first_name || "");
  const currentLastNameValue = normalizeInputText(user?.last_name || "");
  const fallbackRecipientName = defaultAddress?.recipient_name || displayName;
  const currentStreetValue = defaultAddress?.street || "";
  const currentWardValue = defaultAddress?.ward || "";
  const currentDistrictValue = defaultAddress?.district || "";
  const currentCityValue = defaultAddress?.city || "";
  const hasAddressFieldInput =
    streetValue !== "" ||
    wardValue !== "" ||
    districtValue !== "" ||
    cityValue !== "" ||
    (recipientNameValue !== "" && recipientNameValue !== fallbackRecipientName);
  const nameChanged =
    (firstNameValue !== "" && firstNameValue !== currentFirstNameValue) ||
    (lastNameValue !== "" && lastNameValue !== currentLastNameValue);
  const addressChanged =
    (!defaultAddress && hasAddressFieldInput) ||
    (recipientNameValue !== "" && recipientNameValue !== fallbackRecipientName) ||
    (streetValue !== "" && streetValue !== currentStreetValue) ||
    (wardValue !== "" && wardValue !== currentWardValue) ||
    (districtValue !== "" && districtValue !== currentDistrictValue) ||
    (cityValue !== "" && cityValue !== currentCityValue);
  const mergedAddressCandidate = {
    recipientName: recipientNameValue || fallbackRecipientName,
    phone: normalizedCurrentAddressPhone,
    street: streetValue || currentStreetValue,
    ward: wardValue || currentWardValue,
    district: districtValue || currentDistrictValue,
    city: cityValue || currentCityValue,
  };
  const canRequestPhoneVerification = hasValidPhoneDraft && !otpBusy;
  const hasProfileChanges = nameChanged || phoneChanged || addressChanged;

  function buildFormErrors(options?: { requireOtp?: boolean }) {
    const errors: ProfileFieldErrors = {};

    if (phoneChanged && !isValidVietnamesePhone(normalizedDraftPhone)) {
      errors.phone = "Số điện thoại hồ sơ phải đúng 10 chữ số và bắt đầu bằng số 0.";
    }
    if (addressChanged && !mergedAddressCandidate.recipientName) {
      errors.recipientName = "Tên người nhận không được để trống.";
    }
    if (addressChanged && !isValidStoredPhone(mergedAddressCandidate.phone)) {
      errors.street = "Hãy cập nhật số điện thoại hồ sơ hợp lệ trước khi lưu địa chỉ mặc định.";
    }
    if (addressChanged && mergedAddressCandidate.street.length < 5) {
      errors.street = "Địa chỉ cần ít nhất 5 ký tự.";
    }
    if (addressChanged && mergedAddressCandidate.district.length < 2) {
      errors.district = "Quận/Huyện không được để trống.";
    }
    if (addressChanged && mergedAddressCandidate.city.length < 2) {
      errors.city = "Tỉnh/Thành phố không được để trống.";
    }
    if (options?.requireOtp && otpCode.trim().length !== 6) {
      errors.otpCode = "OTP cần đúng 6 chữ số.";
    }

    return errors;
  }

  const canSaveProfile =
    !busy &&
    !otpBusy &&
    hasProfileChanges &&
    Object.keys(buildFormErrors()).length === 0 &&
    (!phoneChanged || phoneIsVerifiedForDraft);

  function resetVerificationState() {
    setPhoneVerification(null);
    setOtpCode("");
    setOtpExpiresIn(0);
    setOtpResendIn(0);
  }

  function handlePhoneChange(nextValue: string) {
    const sanitizedPhone = nextValue.replace(/\D/g, "").slice(0, 10);
    setPhone(sanitizedPhone);
    setFormErrors((current) => ({ ...current, phone: undefined, otpCode: undefined }));

    if (normalizePhoneDigits(phoneVerification?.phone || "") !== normalizePhoneDigits(sanitizedPhone)) {
      resetVerificationState();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = buildFormErrors();
    if (phoneChanged && !phoneIsVerifiedForDraft) {
      nextErrors.phone = nextErrors.phone || "Số điện thoại mới cần xác minh OTP trước khi lưu.";
    }
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({
        tone: "error",
        message: "Vui lòng kiểm tra lại thông tin hồ sơ trước khi lưu.",
      });
      return;
    }
    if (!hasProfileChanges) {
      setFeedback({
        tone: "info",
        message: "Chưa có thay đổi nào để lưu.",
      });
      return;
    }

    const profilePatch: {
      first_name?: string;
      last_name?: string;
      phone?: string;
      phone_verification_id?: string;
      default_address?: ProfileAddressPatch;
    } = {};

    if (firstNameValue !== "" && firstNameValue !== currentFirstNameValue) {
      profilePatch.first_name = firstNameValue;
    }
    if (lastNameValue !== "" && lastNameValue !== currentLastNameValue) {
      profilePatch.last_name = lastNameValue;
    }
    if (phoneChanged) {
      profilePatch.phone = normalizedDraftPhone;
      profilePatch.phone_verification_id = phoneVerification?.verification_id;
    }
    if (addressChanged) {
      const nextAddressPatch: ProfileAddressPatch = {};

      if (!defaultAddress && recipientNameValue !== "") {
        nextAddressPatch.recipient_name = recipientNameValue;
      } else if (recipientNameValue !== "" && recipientNameValue !== fallbackRecipientName) {
        nextAddressPatch.recipient_name = recipientNameValue;
      }
      if (streetValue !== "" && streetValue !== currentStreetValue) {
        nextAddressPatch.street = streetValue;
      }
      if (wardValue !== "" && wardValue !== currentWardValue) {
        nextAddressPatch.ward = wardValue;
      }
      if (districtValue !== "" && districtValue !== currentDistrictValue) {
        nextAddressPatch.district = districtValue;
      }
      if (cityValue !== "" && cityValue !== currentCityValue) {
        nextAddressPatch.city = cityValue;
      }
      if (Object.keys(nextAddressPatch).length > 0) {
        profilePatch.default_address = nextAddressPatch;
      }
    }

    try {
      setBusy(true);
      await updateProfile(profilePatch);
      if (token && profilePatch.default_address) {
        invalidateSavedAddressesResource(token);
      }
      await Promise.all([refreshProfile(), refreshAddresses()]);
      resetVerificationState();
      setFormErrors({});
      setFeedback({
        tone: "success",
        message: "Các thay đổi trên hồ sơ đã được cập nhật.",
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSendPhoneOtp() {
    const nextErrors = buildFormErrors();
    setFormErrors(nextErrors);
    if (nextErrors.phone) {
      setFeedback({
        tone: "error",
        message: nextErrors.phone || "Không thể gửi OTP cho số điện thoại hiện tại.",
      });
      return;
    }
    if (!phoneChanged) {
      setFeedback({
        tone: "info",
        message: "Hãy nhập số điện thoại mới trước khi yêu cầu xác minh.",
      });
      return;
    }

    try {
      setOtpBusy(true);
      const result = await sendPhoneOtp(normalizedDraftPhone);
      setPhoneVerification(result);
      setOtpExpiresIn(result.expires_in_seconds);
      setOtpResendIn(result.resend_in_seconds);
      setOtpCode("");
      setFormErrors((current) => ({ ...current, otpCode: undefined }));
      setFeedback({
        tone: "info",
        message: "OTP đã được gửi tới cuộc trò chuyện Telegram đã liên kết. Hãy nhập mã 6 chữ số để tiếp tục.",
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyOtp() {
    if (!phoneVerification?.verification_id) {
      return;
    }

    const nextErrors = buildFormErrors({ requireOtp: true });
    setFormErrors(nextErrors);
    if (nextErrors.otpCode) {
      setFeedback({
        tone: "error",
        message: nextErrors.otpCode,
      });
      return;
    }

    try {
      setOtpBusy(true);
      const result = await verifyPhoneOtp(phoneVerification.verification_id, otpCode.trim());
      setPhoneVerification(result);
      setOtpExpiresIn(result.expires_in_seconds);
      setOtpResendIn(result.resend_in_seconds);
      setFormErrors((current) => ({ ...current, otpCode: undefined }));
      setFeedback({
        tone: "success",
        message: "Số điện thoại mới đã được xác minh. Bạn có thể lưu hồ sơ ngay bây giờ.",
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
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
      setOtpCode("");
      setFormErrors((current) => ({ ...current, otpCode: undefined }));
      setFeedback({
        tone: "info",
        message: "OTP mới đã được gửi lại qua Telegram.",
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleResendVerification() {
    try {
      setBusy(true);
      await resendVerificationEmail();
      setFeedback({
        tone: "success",
        message: "Email xác minh mới đã được gửi.",
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell
      title="Hồ sơ tài khoản"
      description="Tổng hợp thông tin cá nhân, trạng thái xác minh, đơn hàng gần đây và các thiết lập thanh toán trong cùng một màn hình nhất quán với luồng account thực tế."
    >
      {feedback ? <InlineAlert tone={feedback.tone}>{feedback.message}</InlineAlert> : null}

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
                  <Link
                    href="/payments"
                    className={cn(
                      buttonStyles({ variant: "secondary" }),
                      "border-white/15 bg-white/10 text-white hover:bg-white/15",
                    )}
                  >
                    {paymentCount > 0 ? `Xem ${paymentCount} giao dịch` : "Mở lịch sử thanh toán"}
                  </Link>
                  <Link
                    href="/security"
                    className={cn(buttonStyles({ variant: "tertiary" }), "text-tertiary-fixed-dim hover:text-white")}
                  >
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
            <Field htmlFor="profile-first-name" label="Tên" error={formErrors.firstName}>
              <TextInput
                id="profile-first-name"
                maxLength={100}
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  setFormErrors((current) => ({ ...current, firstName: undefined }));
                }}
              />
            </Field>
            <Field htmlFor="profile-last-name" label="Họ" error={formErrors.lastName}>
              <TextInput
                id="profile-last-name"
                maxLength={100}
                value={lastName}
                onChange={(event) => {
                  setLastName(event.target.value);
                  setFormErrors((current) => ({ ...current, lastName: undefined }));
                }}
              />
            </Field>
            <Field htmlFor="profile-phone" label="Số điện thoại hồ sơ" error={formErrors.phone}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <TextInput
                  id="profile-phone"
                  className="flex-1"
                  inputMode="numeric"
                  value={phone}
                  onChange={(event) => handlePhoneChange(event.target.value)}
                  placeholder="Ví dụ 0912345678"
                />
                <button
                  type="button"
                  className={cn(
                    buttonStyles({ size: "lg" }),
                    "w-full sm:w-auto",
                    !hasValidPhoneDraft &&
                      "bg-primary/20 text-primary/55 shadow-none hover:translate-y-0 hover:bg-primary/20",
                  )}
                  disabled={!canRequestPhoneVerification}
                  onClick={() => void handleSendPhoneOtp()}
                >
                  {otpBusy ? "Đang gửi OTP..." : "Verification"}
                </button>
              </div>
              <p className="mt-2 text-xs leading-6 text-on-surface-variant">
                Nhập số điện thoại mới gồm đúng 10 chữ số để bật xác minh Telegram.
              </p>
            </Field>
            <Field htmlFor="profile-recipient-name" label="Tên người nhận" error={formErrors.recipientName}>
              <TextInput
                id="profile-recipient-name"
                maxLength={100}
                value={recipientName}
                onChange={(event) => {
                  setRecipientName(event.target.value);
                  setFormErrors((current) => ({ ...current, recipientName: undefined }));
                }}
              />
            </Field>
            <Field htmlFor="profile-street" label="Địa chỉ" error={formErrors.street}>
              <TextInput
                id="profile-street"
                value={street}
                onChange={(event) => {
                  setStreet(event.target.value);
                  setFormErrors((current) => ({ ...current, street: undefined }));
                }}
              />
            </Field>
            <Field htmlFor="profile-ward" label="Phường/Xã">
              <TextInput id="profile-ward" value={ward} onChange={(event) => setWard(event.target.value)} />
            </Field>
            <Field htmlFor="profile-district" label="Quận/Huyện" error={formErrors.district}>
              <TextInput
                id="profile-district"
                value={district}
                onChange={(event) => {
                  setDistrict(event.target.value);
                  setFormErrors((current) => ({ ...current, district: undefined }));
                }}
              />
            </Field>
            <Field htmlFor="profile-city" label="Tỉnh/Thành phố" error={formErrors.city}>
              <TextInput
                id="profile-city"
                value={city}
                onChange={(event) => {
                  setCity(event.target.value);
                  setFormErrors((current) => ({ ...current, city: undefined }));
                }}
              />
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
                        : verificationPendingForDraft
                          ? "OTP đã được gửi cho số mới. Hãy nhập mã để hoàn tất xác minh trước khi lưu."
                          : "Bạn cần gửi OTP và xác thực số điện thoại mới trước khi lưu."}
                  </p>
                </div>
              </div>

              {otpPanelVisible ? (
                <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                  <Field htmlFor="profile-otp-code" label="OTP 6 chữ số" required error={formErrors.otpCode}>
                    <TextInput
                      id="profile-otp-code"
                      inputMode="numeric"
                      value={otpCode}
                      onChange={(event) => {
                        setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                        setFormErrors((current) => ({ ...current, otpCode: undefined }));
                      }}
                      placeholder="Nhập mã OTP"
                    />
                  </Field>
                  <button
                    type="button"
                    className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full md:w-auto")}
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
                  <p>
                    Số đang xác minh:{" "}
                    <span className="font-semibold text-primary">{phoneVerification.phone_masked}</span>
                  </p>
                  <p>
                    Trạng thái challenge:{" "}
                    <span className="font-semibold text-primary">
                      {phoneVerification.status === "verified"
                        ? "verified - chờ lưu hồ sơ"
                        : phoneVerification.status}
                    </span>
                  </p>
                  <p>
                    OTP hết hạn sau:{" "}
                    <span className="font-semibold text-primary">{formatSecondsLabel(otpExpiresIn)}</span>
                  </p>
                  <p>
                    Có thể gửi lại sau:{" "}
                    <span className="font-semibold text-primary">{formatSecondsLabel(otpResendIn)}</span>
                  </p>
                  <p>
                    Số lần thử còn lại:{" "}
                    <span className="font-semibold text-primary">{phoneVerification.remaining_attempts}</span>
                  </p>
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
