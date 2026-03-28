import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useOrderPayments } from "../hooks/useOrderPayments";
import { useSavedAddresses } from "../hooks/useSavedAddresses";
import { getErrorMessage } from "../lib/api";
import type { PhoneVerificationChallenge } from "../types/api";
import { AccountPageFrame } from "../ui/account/AccountPageFrame";
import { formatShortDate, formatShortOrderId } from "../ui/account/accountConfig";
import { formatCurrency, formatStatusLabel } from "../utils/format";
import { getUserDisplayName, isDevelopmentAccount } from "../utils/devAccounts";
import "./ProfilePage.css";

type ProfileFormState = {
  firstName: string;
  lastName: string;
  phone: string;
  telegramChatId: string;
  recipientName: string;
  addressPhone: string;
  street: string;
  ward: string;
  district: string;
  city: string;
  otpCode: string;
};

const emptyForm: ProfileFormState = {
  firstName: "",
  lastName: "",
  phone: "",
  telegramChatId: "",
  recipientName: "",
  addressPhone: "",
  street: "",
  ward: "",
  district: "",
  city: "",
  otpCode: ""
};

type ProfileFieldErrors = Partial<
  Record<
    | "firstName"
    | "lastName"
    | "phone"
    | "telegramChatId"
    | "recipientName"
    | "addressPhone"
    | "street"
    | "ward"
    | "district"
    | "city"
    | "otpCode",
    string
  >
>;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizePhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function isValidVietnamesePhone(value: string) {
  return /^0\d{9,10}$/.test(value);
}

function formatCountdown(seconds: number) {
  if (seconds <= 0) {
    return "0s";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
}

export function ProfilePage() {
  const {
    token,
    user,
    refreshProfile,
    updateProfile,
    resendVerificationEmail,
    getPhoneVerificationStatus,
    sendPhoneOtp,
    verifyPhoneOtp,
    resendPhoneOtp
  } = useAuth();
  const { orders, isLoading } = useOrderPayments(token);
  const { addresses, refreshAddresses } = useSavedAddresses(token);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<ProfileFieldErrors>({});
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isOtpBusy, setIsOtpBusy] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationChallenge | null>(null);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [otpResendIn, setOtpResendIn] = useState(0);

  const defaultAddress = useMemo(() => addresses.find((item) => item.is_default) ?? addresses[0] ?? null, [addresses]);
  const displayName = getUserDisplayName(user);

  useEffect(() => {
    setProfileForm({
      firstName: user?.first_name || "",
      lastName: user?.last_name || "",
      phone: user?.phone || "",
      telegramChatId: "",
      recipientName: defaultAddress?.recipient_name || getUserDisplayName(user),
      addressPhone: defaultAddress?.phone || user?.phone || "",
      street: defaultAddress?.street || "",
      ward: defaultAddress?.ward || "",
      district: defaultAddress?.district || "",
      city: defaultAddress?.city || "",
      otpCode: ""
    });
  }, [defaultAddress, user]);

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

        if (status?.phone) {
          setProfileForm((current) => ({
            ...current,
            phone: status.phone
          }));
          setIsEditingProfile(true);
        }
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setPhoneVerification(null);
        setOtpExpiresIn(0);
        setOtpResendIn(0);
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

  const initials = buildInitials(displayName);
  const recentOrders = useMemo(() => orders.slice(0, 3), [orders]);
  const memberSince = useMemo(() => buildMemberSinceLabel(user?.created_at), [user?.created_at]);
  const locationLabel = defaultAddress
    ? [defaultAddress.city, defaultAddress.district].filter(Boolean).join(", ")
    : "No saved address yet";
  const showDevBadge = isDevelopmentAccount(user);
  const normalizedCurrentPhone = normalizePhoneDigits(user?.phone || "");
  const normalizedDraftPhone = normalizePhoneDigits(profileForm.phone);
  const normalizedAddressPhone = normalizePhoneDigits(profileForm.addressPhone);
  const verificationPhone = normalizePhoneDigits(phoneVerification?.phone || "");
  const phoneChanged = normalizedDraftPhone !== normalizedCurrentPhone;
  const verificationMatchesDraft = verificationPhone !== "" && verificationPhone === normalizedDraftPhone;
  const phoneIsVerifiedForDraft =
    !phoneChanged || (phoneVerification?.status === "verified" && verificationMatchesDraft);
  const verificationPendingForDraft =
    phoneChanged && phoneVerification?.status === "pending" && verificationMatchesDraft;
  const otpPanelVisible = phoneChanged && !phoneIsVerifiedForDraft;

  function setField<K extends keyof ProfileFormState>(field: K, value: ProfileFormState[K]) {
    setProfileForm((current) => ({
      ...current,
      [field]: value
    }));
    setFormErrors((current) => ({
      ...current,
      [field]: undefined
    }));
  }

  function resetVerificationState() {
    setPhoneVerification(null);
    setOtpExpiresIn(0);
    setOtpResendIn(0);
    setProfileForm((current) => ({
      ...current,
      otpCode: ""
    }));
  }

  function handlePhoneChange(value: string) {
    setField("phone", value);
    if (normalizePhoneDigits(phoneVerification?.phone || "") !== normalizePhoneDigits(value)) {
      resetVerificationState();
    }
  }

  function buildErrors(options?: { requireTelegramChatId?: boolean; requireOtp?: boolean }) {
    const errors: ProfileFieldErrors = {};

    if (!normalizeText(profileForm.firstName)) {
      errors.firstName = "First name is required.";
    }
    if (!normalizeText(profileForm.lastName)) {
      errors.lastName = "Last name is required.";
    }
    if (normalizedDraftPhone && !isValidVietnamesePhone(normalizedDraftPhone)) {
      errors.phone = "Phone number must be a valid Vietnamese number.";
    }
    if (options?.requireTelegramChatId && !profileForm.telegramChatId.trim()) {
      errors.telegramChatId = "Telegram chat ID is required to receive OTP.";
    }
    if (!normalizeText(profileForm.recipientName)) {
      errors.recipientName = "Recipient name is required.";
    }
    if (!isValidVietnamesePhone(normalizedAddressPhone)) {
      errors.addressPhone = "Delivery phone must be a valid Vietnamese number.";
    }
    if (profileForm.street.trim().length < 5) {
      errors.street = "Street address must be at least 5 characters.";
    }
    if (profileForm.district.trim().length < 2) {
      errors.district = "District is required.";
    }
    if (profileForm.city.trim().length < 2) {
      errors.city = "City is required.";
    }
    if (options?.requireOtp && profileForm.otpCode.trim().length !== 6) {
      errors.otpCode = "OTP must contain exactly 6 digits.";
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = buildErrors();
    if (phoneChanged && !phoneIsVerifiedForDraft) {
      errors.phone = errors.phone || "Phone change must be verified with OTP before saving.";
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFeedback("Please review the profile form before saving.");
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile({
        first_name: normalizeText(profileForm.firstName),
        last_name: normalizeText(profileForm.lastName),
        phone: normalizedDraftPhone || undefined,
        phone_verification_id: phoneChanged ? phoneVerification?.verification_id : undefined,
        default_address: {
          recipient_name: normalizeText(profileForm.recipientName),
          phone: normalizedAddressPhone,
          street: profileForm.street.trim(),
          ward: profileForm.ward.trim() || undefined,
          district: profileForm.district.trim(),
          city: profileForm.city.trim()
        }
      });
      await Promise.all([refreshProfile(), refreshAddresses()]);
      resetVerificationState();
      setFormErrors({});
      setFeedback("Your profile, delivery address, and phone status were updated successfully.");
      setIsEditingProfile(false);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendPhoneOtp() {
    const errors = buildErrors({ requireTelegramChatId: true });
    setFormErrors(errors);
    if (errors.phone || errors.telegramChatId) {
      setFeedback(errors.phone || errors.telegramChatId || "Unable to send OTP for this phone number.");
      return;
    }

    try {
      setIsOtpBusy(true);
      const result = await sendPhoneOtp(normalizedDraftPhone, profileForm.telegramChatId.trim());
      setPhoneVerification(result ?? null);
      setOtpExpiresIn(result?.expires_in_seconds ?? 0);
      setOtpResendIn(result?.resend_in_seconds ?? 0);
      setField("otpCode", "");
      setFeedback("OTP has been sent to Telegram. Enter the 6-digit code to continue.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsOtpBusy(false);
    }
  }

  async function handleVerifyPhoneOtp() {
    if (!phoneVerification?.verification_id) {
      return;
    }

    const errors = buildErrors({ requireOtp: true });
    setFormErrors(errors);
    if (errors.otpCode) {
      setFeedback(errors.otpCode);
      return;
    }

    try {
      setIsOtpBusy(true);
      const result = await verifyPhoneOtp(phoneVerification.verification_id, profileForm.otpCode.trim());
      setPhoneVerification(result ?? null);
      setOtpExpiresIn(result?.expires_in_seconds ?? 0);
      setOtpResendIn(result?.resend_in_seconds ?? 0);
      setFeedback("Phone verification succeeded. Save the profile to apply the new number.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsOtpBusy(false);
    }
  }

  async function handleResendPhoneOtp() {
    if (!phoneVerification?.verification_id) {
      return;
    }

    try {
      setIsOtpBusy(true);
      const result = await resendPhoneOtp(phoneVerification.verification_id);
      setPhoneVerification(result ?? null);
      setOtpExpiresIn(result?.expires_in_seconds ?? 0);
      setOtpResendIn(result?.resend_in_seconds ?? 0);
      setField("otpCode", "");
      setFeedback("A fresh OTP has been sent to Telegram.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsOtpBusy(false);
    }
  }

  async function handleResendVerification() {
    try {
      setIsResendingVerification(true);
      await resendVerificationEmail();
      setFeedback("A new verification email has been sent to your inbox.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsResendingVerification(false);
    }
  }

  return (
    <AccountPageFrame>
      <div className="profile-route">
        {feedback ? (
          <div className="profile-route-feedback">
            <span className="profile-route-feedback-icon" aria-hidden="true" />
            <span>{feedback}</span>
          </div>
        ) : null}

        <section className="profile-route-section profile-route-profile-shell">
          <div className="profile-route-hero">
            <div className="profile-route-avatar-column">
              <div className="profile-route-avatar-shell">
                <div className="profile-route-avatar">
                  <span>{initials}</span>
                </div>
                <button
                  className="profile-route-avatar-action"
                  type="button"
                  onClick={() => setIsEditingProfile((current) => !current)}
                >
                  <span className="profile-route-avatar-pencil" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="profile-route-hero-copy">
              <div className="profile-route-identity-row">
                <div className="profile-route-identity">
                  <h1>{displayName}</h1>
                  <p className="profile-route-membership">
                    <span className="profile-route-membership-icon" aria-hidden="true" />
                    <span>{memberSince}</span>
                  </p>
                </div>

                {showDevBadge ? <span className="profile-route-dev-badge">Dev Only: Profile_v2</span> : null}
              </div>

              <div className="profile-route-divider" />

              <div className="profile-route-fields">
                <div className="profile-route-field">
                  <label>Email Address</label>
                  <p>{user?.email || "Not available"}</p>
                </div>

                <div className="profile-route-field">
                  <label>Phone Number</label>
                  <p>{user?.phone || "Not set yet"}</p>
                </div>

                <div className="profile-route-field">
                  <label>Location</label>
                  <p>{locationLabel}</p>
                </div>
              </div>
            </div>
          </div>

          {isEditingProfile ? (
            <form className="profile-route-form" onSubmit={handleSubmit}>
              <div className="profile-route-form-head">
                <div>
                  <h2>Edit Profile</h2>
                  <p>Update your profile, delivery address, and verify any new phone number before saving.</p>
                </div>

                <button className="ghost-button" type="button" onClick={() => setIsEditingProfile(false)}>
                  Close
                </button>
              </div>

              <div className="profile-route-form-grid">
                <label className="profile-route-form-field">
                  <span>First Name</span>
                  <input
                    value={profileForm.firstName}
                    onChange={(event) => setField("firstName", event.target.value)}
                  />
                  {formErrors.firstName ? <small className="profile-route-form-error">{formErrors.firstName}</small> : null}
                </label>

                <label className="profile-route-form-field">
                  <span>Last Name</span>
                  <input
                    value={profileForm.lastName}
                    onChange={(event) => setField("lastName", event.target.value)}
                  />
                  {formErrors.lastName ? <small className="profile-route-form-error">{formErrors.lastName}</small> : null}
                </label>

                <label className="profile-route-form-field">
                  <span>Profile Phone</span>
                  <input
                    inputMode="numeric"
                    value={profileForm.phone}
                    onChange={(event) => handlePhoneChange(event.target.value)}
                    placeholder="0912345678"
                  />
                  {formErrors.phone ? <small className="profile-route-form-error">{formErrors.phone}</small> : null}
                </label>

                <label className="profile-route-form-field">
                  <span>Telegram Chat ID</span>
                  <input
                    inputMode="numeric"
                    value={profileForm.telegramChatId}
                    onChange={(event) => setField("telegramChatId", event.target.value)}
                    placeholder="Required only when sending OTP"
                  />
                  {formErrors.telegramChatId ? <small className="profile-route-form-error">{formErrors.telegramChatId}</small> : null}
                </label>

                <label className="profile-route-form-field">
                  <span>Recipient Name</span>
                  <input
                    value={profileForm.recipientName}
                    onChange={(event) => setField("recipientName", event.target.value)}
                  />
                  {formErrors.recipientName ? <small className="profile-route-form-error">{formErrors.recipientName}</small> : null}
                </label>

                <label className="profile-route-form-field">
                  <span>Delivery Phone</span>
                  <input
                    inputMode="numeric"
                    value={profileForm.addressPhone}
                    onChange={(event) => setField("addressPhone", event.target.value)}
                    placeholder="0901122334"
                  />
                  {formErrors.addressPhone ? <small className="profile-route-form-error">{formErrors.addressPhone}</small> : null}
                </label>

                <label className="profile-route-form-field profile-route-form-field-full">
                  <span>Street Address</span>
                  <input value={profileForm.street} onChange={(event) => setField("street", event.target.value)} />
                  {formErrors.street ? <small className="profile-route-form-error">{formErrors.street}</small> : null}
                </label>

                <label className="profile-route-form-field">
                  <span>Ward</span>
                  <input value={profileForm.ward} onChange={(event) => setField("ward", event.target.value)} />
                </label>

                <label className="profile-route-form-field">
                  <span>District</span>
                  <input value={profileForm.district} onChange={(event) => setField("district", event.target.value)} />
                  {formErrors.district ? <small className="profile-route-form-error">{formErrors.district}</small> : null}
                </label>

                <label className="profile-route-form-field">
                  <span>City</span>
                  <input value={profileForm.city} onChange={(event) => setField("city", event.target.value)} />
                  {formErrors.city ? <small className="profile-route-form-error">{formErrors.city}</small> : null}
                </label>
              </div>

              <div className="profile-route-verification-panel">
                <div className="profile-route-form-head profile-route-form-head-inline">
                  <div>
                    <h2>Phone Verification</h2>
                    <p>
                      {!phoneChanged
                        ? user?.phone_verified
                          ? "Your current profile phone is already verified."
                          : "Your current profile phone has not been verified yet."
                        : phoneIsVerifiedForDraft
                          ? "The new phone number has been verified. Save the profile to apply it."
                          : verificationPendingForDraft
                            ? "OTP has been sent to the new number. Enter it below to finish verification."
                            : "Changing the profile phone requires Telegram OTP verification first."}
                    </p>
                  </div>

                  {otpPanelVisible ? (
                    <button
                      className="secondary-button"
                      disabled={isOtpBusy || !normalizedDraftPhone || !profileForm.telegramChatId.trim()}
                      type="button"
                      onClick={() => void handleSendPhoneOtp()}
                    >
                      {isOtpBusy ? "Sending..." : "Send OTP"}
                    </button>
                  ) : null}
                </div>

                {otpPanelVisible ? (
                  <div className="profile-route-form-grid">
                    <label className="profile-route-form-field">
                      <span>OTP Code</span>
                      <input
                        inputMode="numeric"
                        value={profileForm.otpCode}
                        onChange={(event) => setField("otpCode", event.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="6 digits"
                      />
                      {formErrors.otpCode ? <small className="profile-route-form-error">{formErrors.otpCode}</small> : null}
                    </label>

                    <div className="profile-route-form-actions profile-route-form-actions-stacked">
                      <button
                        className="primary-button"
                        disabled={isOtpBusy || !phoneVerification?.verification_id || profileForm.otpCode.trim().length !== 6}
                        type="button"
                        onClick={() => void handleVerifyPhoneOtp()}
                      >
                        {isOtpBusy ? "Verifying..." : "Verify OTP"}
                      </button>
                      <button
                        className="secondary-button"
                        disabled={isOtpBusy || !phoneVerification?.verification_id || otpResendIn > 0}
                        type="button"
                        onClick={() => void handleResendPhoneOtp()}
                      >
                        {otpResendIn > 0 ? `Resend in ${otpResendIn}s` : "Resend OTP"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {phoneVerification ? (
                  <div className="profile-route-verification-meta">
                    <p><strong>Masked phone:</strong> {phoneVerification.phone_masked}</p>
                    <p><strong>Status:</strong> {phoneVerification.status === "verified" ? "verified - waiting for save" : phoneVerification.status}</p>
                    <p><strong>Expires in:</strong> {formatCountdown(otpExpiresIn)}</p>
                    <p><strong>Resend in:</strong> {formatCountdown(otpResendIn)}</p>
                    <p><strong>Remaining attempts:</strong> {phoneVerification.remaining_attempts}</p>
                  </div>
                ) : null}
              </div>

              <div className="profile-route-form-actions">
                <button className="primary-button" disabled={isSaving || isOtpBusy || !phoneIsVerifiedForDraft || Object.keys(buildErrors()).length > 0} type="submit">
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="profile-route-section profile-route-section-compact">
          <div className="profile-route-subhead">
            <h2>Recent Orders</h2>
            <Link className="profile-route-text-link" to="/myorders">
              View all history <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="profile-route-orders-panel">
            {isLoading ? (
              <div className="page-state">Đang tải lịch sử giao dịch...</div>
            ) : recentOrders.length === 0 ? (
              <div className="empty-card history-empty profile-route-empty-state">
                <h3>You have not placed an order yet</h3>
                <p>Your most recent orders will appear here once checkout is complete.</p>
              </div>
            ) : (
              <table className="profile-route-orders-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link className="profile-route-order-link" to={`/orders/${order.id}`}>
                          {formatShortOrderId(order.id)}
                        </Link>
                      </td>
                      <td>{formatShortDate(order.created_at)}</td>
                      <td>{formatCurrency(order.total_price)}</td>
                      <td>
                        <span className={getOrderStatusClassName(order.status)}>{formatStatusLabel(order.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="profile-route-cards">
          <article className="profile-route-card">
            <span className="profile-route-card-icon" aria-hidden="true" />
            <div className="profile-route-card-copy">
              <h3>Two-Factor Auth</h3>
              <p>Enhance your account security by adding an extra layer of verification for all logins.</p>
            </div>
            <Link className="profile-route-card-link" to="/security">
              Setup Now <span aria-hidden="true">—</span>
            </Link>
          </article>

          <article className="profile-route-card profile-route-card-accent">
            <span className="profile-route-card-icon profile-route-card-icon-accent" aria-hidden="true" />
            <div className="profile-route-card-copy">
              <h3>ND Membership</h3>
              <p>
                {user?.email_verified
                  ? `Member since ${extractYear(user?.created_at)}. You have ${orders.length} orders and ${addresses.length} saved addresses in your account.`
                  : "Verify your email to strengthen account recovery and unlock a more complete membership profile."}
              </p>
            </div>

            {user?.email_verified ? (
              <Link className="profile-route-card-link" to="/myorders">
                View Rewards <span aria-hidden="true">—</span>
              </Link>
            ) : (
              <button className="profile-route-card-link" type="button" onClick={() => void handleResendVerification()}>
                {isResendingVerification ? "Sending..." : "Verify Email"} <span aria-hidden="true">—</span>
              </button>
            )}
          </article>
        </section>
      </div>
    </AccountPageFrame>
  );
}

function buildInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "ND";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function buildMemberSinceLabel(value?: string) {
  const year = extractYear(value);

  return `Member since ${year}`;
}

function extractYear(value?: string) {
  const parsed = value ? new Date(value) : null;

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "this year";
  }

  return String(parsed.getFullYear());
}

function getOrderStatusClassName(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("deliver") || normalized.includes("paid") || normalized.includes("success")) {
    return "profile-route-status profile-route-status-success";
  }
  if (normalized.includes("process") || normalized.includes("pending")) {
    return "profile-route-status profile-route-status-processing";
  }

  return "profile-route-status";
}
