import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  type Location as RouterLocation,
} from "react-router-dom";

import { NotificationStack, type NotificationItem } from "@/components/feedback/notification-stack";
import { FormField } from "@/components/form/form-field";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  getVisibleErrors,
  inputClassName,
  type TouchedFields,
} from "@/features/auth/utils/auth-form";
import { getErrorMessage } from "@/services/api";
import type { EmailVerificationChallenge, PhoneVerificationChallenge } from "@/types/api";
import {
  sanitizeEmail,
  sanitizeIdentifier,
  sanitizePhoneNumber,
} from "@/utils/sanitize";
import { type RegisterFormValues, validateRegisterFields } from "@/utils/validation";
import "@/styles/pages/auth/auth-pages.css";

type AuthLocationState = {
  from?: RouterLocation;
};

type InlineFeedback = {
  tone: "info" | "success" | "error";
  message: string;
};

type IdentifierKind = "email" | "phone" | "unknown";

const defaultRegisterForm: RegisterFormValues = {
  identifier: "",
  password: "",
  confirmPassword: "",
};

function detectIdentifierKind(value: string): IdentifierKind {
  const normalized = sanitizeIdentifier(value);
  const phone = sanitizePhoneNumber(value);

  if (!normalized) {
    return "unknown";
  }
  if (normalized.includes("@")) {
    return "email";
  }
  if (phone.length >= 10) {
    return "phone";
  }
  return "unknown";
}

function deriveNameFromIdentifier(value: string) {
  const normalized = sanitizeIdentifier(value);
  const localPart = normalized.includes("@") ? normalized.split("@")[0] ?? "" : normalized;
  const sanitized = localPart.replace(/[._-]+/g, " ").replace(/\d+/g, " ").trim();
  const parts = sanitized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

  if (parts.length === 0) {
    return {
      firstName: "ND",
      lastName: "Shop",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "Customer",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function maskEmail(value: string) {
  const trimmedValue = value.trim();
  const [localPart, domain] = trimmedValue.split("@");

  if (!localPart || !domain) {
    return trimmedValue;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? "*"}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

function formatSecondsLabel(seconds: number) {
  if (seconds <= 0) {
    return "0s";
  }

  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainSeconds = seconds % 60;

    return remainSeconds > 0 ? `${minutes}m ${remainSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

export function RegisterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    register,
    beginOAuthLogin,
    getEmailVerificationStatus,
    sendEmailVerificationOtp,
    verifyEmailOtp,
    resendEmailVerificationOtp,
    sendPhoneSignupOtp,
    verifyPhoneSignupOtp,
    resendPhoneSignupOtp,
    refreshProfile,
    error,
    clearError,
  } = useAuth();
  const [form, setForm] = useState(defaultRegisterForm);
  const [touched, setTouched] = useState<TouchedFields<RegisterFormValues>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [holdRedirect, setHoldRedirect] = useState(false);
  const [stage, setStage] = useState<"form" | "verify_email">("form");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailVerification, setEmailVerification] = useState<EmailVerificationChallenge | null>(null);
  const [emailOtpExpiresIn, setEmailOtpExpiresIn] = useState(0);
  const [emailOtpResendIn, setEmailOtpResendIn] = useState(0);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationChallenge | null>(null);
  const [phoneOtpExpiresIn, setPhoneOtpExpiresIn] = useState(0);
  const [phoneOtpResendIn, setPhoneOtpResendIn] = useState(0);
  const [verificationFeedback, setVerificationFeedback] = useState<InlineFeedback | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const navigationState = location.state as AuthLocationState | null;
  const redirectTo = navigationState?.from
    ? `${navigationState.from.pathname}${navigationState.from.search}${navigationState.from.hash}`
    : "/profile";
  const formErrors = validateRegisterFields(form);
  const visibleErrors = getVisibleErrors(formErrors, touched, submitted);
  const identifierKind = detectIdentifierKind(form.identifier);
  const normalizedIdentifier = sanitizeIdentifier(form.identifier);
  const normalizedPhone = sanitizePhoneNumber(form.identifier);

  useEffect(() => {
    if (!error) {
      return;
    }

    pushNotification("error", "Có lỗi xác thực", error);
  }, [error]);

  useEffect(() => {
    if (!isAuthenticated || !holdRedirect || stage !== "verify_email") {
      return;
    }

    let active = true;
    setEmailBusy(true);

    void (async () => {
      const status = (await getEmailVerificationStatus()) ?? (await sendEmailVerificationOtp());
      return status;
    })()
      .then((status) => {
        if (!active) {
          return;
        }

        applyEmailVerificationStatus(status, registeredEmail);
        setVerificationFeedback({
          tone: "info",
          message: status
            ? `Mã OTP đã được gửi tới ${status.email_masked}.`
            : `Tài khoản đã được tạo cho ${maskEmail(registeredEmail)}.`,
        });
      })
      .catch((reason) => {
        if (!active) {
          return;
        }

        setVerificationFeedback({
          tone: "error",
          message: getErrorMessage(reason),
        });
      })
      .finally(() => {
        if (active) {
          setEmailBusy(false);
        }
      });

    return () => {
      active = false;
    };
  }, [getEmailVerificationStatus, holdRedirect, isAuthenticated, registeredEmail, sendEmailVerificationOtp, stage]);

  useEffect(() => {
    if (!emailVerification?.verification_id && !phoneVerification?.verification_id) {
      return;
    }

    const timer = window.setInterval(() => {
      setEmailOtpExpiresIn((current) => (current > 0 ? current - 1 : 0));
      setEmailOtpResendIn((current) => (current > 0 ? current - 1 : 0));
      setPhoneOtpExpiresIn((current) => (current > 0 ? current - 1 : 0));
      setPhoneOtpResendIn((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [emailVerification?.verification_id, phoneVerification?.verification_id]);

  function pushNotification(tone: NotificationItem["tone"], title: string, message: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);

    setNotifications((current) => [...current, { id, tone, title, message }]);

    window.setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }

  function dismissNotification(id: number) {
    setNotifications((current) => current.filter((item) => item.id !== id));
  }

  function updateField<Key extends keyof RegisterFormValues>(
    field: Key,
    value: RegisterFormValues[Key]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    if (stage === "form") {
      setVerificationFeedback(null);
    }
    if (field === "identifier") {
      setPhoneOtpCode("");
      setPhoneVerification(null);
      setPhoneOtpExpiresIn(0);
      setPhoneOtpResendIn(0);
    }
    clearError();
  }

  function markTouched<Key extends keyof RegisterFormValues>(field: Key) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function applyEmailVerificationStatus(
    status: EmailVerificationChallenge | null,
    fallbackEmail = ""
  ) {
    setEmailVerification(status);
    setEmailOtpExpiresIn(status?.expires_in_seconds ?? 0);
    setEmailOtpResendIn(status?.resend_in_seconds ?? 0);

    const nextEmail = status?.email || fallbackEmail;
    if (nextEmail) {
      setRegisteredEmail(nextEmail);
    }
  }

  function applyPhoneVerificationStatus(status: PhoneVerificationChallenge | null) {
    setPhoneVerification(status);
    setPhoneOtpExpiresIn(status?.expires_in_seconds ?? 0);
    setPhoneOtpResendIn(status?.resend_in_seconds ?? 0);
  }

  async function handleSendPhoneOtp() {
    if (formErrors.identifier || formErrors.password || formErrors.confirmPassword) {
      setTouched({
        identifier: true,
        password: true,
        confirmPassword: true,
      });
      setVerificationFeedback({
        tone: "error",
        message: "Hãy hoàn tất số điện thoại, mật khẩu và xác nhận mật khẩu trước khi gửi OTP.",
      });
      return;
    }

    if (normalizedPhone.length < 10) {
      setVerificationFeedback({
        tone: "error",
        message: "Số điện thoại chưa đúng định dạng để gửi Telegram OTP.",
      });
      return;
    }

    try {
      setPhoneBusy(true);
      const challenge = await sendPhoneSignupOtp(
        normalizedPhone,
        form.password.trim(),
        form.confirmPassword.trim()
      );
      applyPhoneVerificationStatus(challenge ?? null);
      setPhoneOtpCode("");
      setVerificationFeedback({
        tone: "info",
        message: "OTP đã được gửi tới bot Telegram. Hãy nhập 6 chữ số để hoàn tất đăng ký bằng số điện thoại.",
      });
      pushNotification(
        "success",
        "Đã gửi Telegram OTP",
        "Kiểm tra bot Telegram của bạn để lấy mã OTP vừa được gửi."
      );
    } catch (reason) {
      const message = getErrorMessage(reason);
      setVerificationFeedback({
        tone: "error",
        message,
      });
      pushNotification("error", "Không thể gửi Telegram OTP", message);
    } finally {
      setPhoneBusy(false);
    }
  }

  async function handleVerifyPhoneOtp() {
    const verificationID = phoneVerification?.verification_id;

    if (!verificationID) {
      setVerificationFeedback({
        tone: "error",
        message: "Hiện chưa có phiên Telegram OTP nào. Hãy yêu cầu gửi mã trước.",
      });
      return;
    }

    if (phoneOtpCode.trim().length !== 6) {
      setVerificationFeedback({
        tone: "error",
        message: "Mã Telegram OTP cần đúng 6 chữ số.",
      });
      return;
    }

    try {
      setPhoneBusy(true);
      await verifyPhoneSignupOtp(verificationID, phoneOtpCode.trim());
      const challenge = phoneVerification;
      applyPhoneVerificationStatus(challenge);
      setPhoneOtpCode("");
      setVerificationFeedback({
        tone: "success",
        message: "Số điện thoại đã được xác minh qua Telegram OTP. Hệ thống đang đăng nhập cho bạn.",
      });
      pushNotification(
        "success",
        "Telegram OTP hợp lệ",
        "Số điện thoại đã được xác minh và tài khoản đã được tạo thành công."
      );
    } catch (reason) {
      const message = getErrorMessage(reason);
      setVerificationFeedback({
        tone: "error",
        message,
      });
      pushNotification("error", "Xác minh Telegram OTP thất bại", message);
    } finally {
      setPhoneBusy(false);
    }
  }

  async function handleResendPhoneOtp() {
    const verificationID = phoneVerification?.verification_id;

    if (!verificationID) {
      setVerificationFeedback({
        tone: "error",
        message: "Hiện chưa có phiên Telegram OTP để gửi lại.",
      });
      return;
    }

    try {
      setPhoneBusy(true);
      const challenge = await resendPhoneSignupOtp(verificationID);
      applyPhoneVerificationStatus(challenge);
      setPhoneOtpCode("");
      setVerificationFeedback({
        tone: "info",
        message: "Một mã Telegram OTP mới đã được gửi tới bot Telegram của bạn.",
      });
    } catch (reason) {
      setVerificationFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setPhoneBusy(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    clearError();
    setVerificationFeedback(null);

    if (Object.keys(formErrors).length > 0) {
      setTouched({
        identifier: true,
        password: true,
        confirmPassword: true,
      });
      pushNotification(
        "error",
        "Đăng ký chưa hoàn tất",
        "Thông tin còn thiếu hoặc chưa đúng định dạng. Hãy kiểm tra lại các trường đang được báo lỗi."
      );
      return;
    }

    if (identifierKind === "phone") {
      await handleSendPhoneOtp();
      return;
    }

    const name = deriveNameFromIdentifier(normalizedIdentifier);
    const normalizedEmail = sanitizeEmail(normalizedIdentifier);

    try {
      setIsBusy(true);
      await register(
        {
          email: normalizedEmail,
          phone: "",
          password: form.password.trim(),
          first_name: name.firstName,
          last_name: name.lastName,
        },
        { remember: false }
      );

      setHoldRedirect(true);
      setStage("verify_email");
      setRegisteredEmail(normalizedEmail);
      setEmailOtpCode("");
      applyEmailVerificationStatus(null, normalizedEmail);
      setVerificationFeedback({
        tone: "info",
        message: `Tài khoản đã được tạo. Hệ thống đang chuẩn bị mã OTP cho ${maskEmail(normalizedEmail)}.`,
      });
      pushNotification(
        "success",
        "Tạo tài khoản thành công",
        "Tài khoản đã được tạo. Hãy nhập OTP được gửi tới email của bạn để hoàn tất xác minh."
      );
    } catch (reason) {
      pushNotification("error", "Không thể tạo tài khoản", getErrorMessage(reason));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleVerifyEmailOtp() {
    const verificationID = emailVerification?.verification_id;

    if (!verificationID) {
      setVerificationFeedback({
        tone: "error",
        message: "Hiện chưa có phiên OTP email nào. Hãy yêu cầu gửi mã mới.",
      });
      return;
    }

    if (emailOtpCode.trim().length !== 6) {
      setVerificationFeedback({
        tone: "error",
        message: "Mã OTP email cần đúng 6 chữ số.",
      });
      return;
    }

    try {
      setEmailBusy(true);
      const challenge = await verifyEmailOtp(verificationID, emailOtpCode.trim());
      applyEmailVerificationStatus(challenge, registeredEmail);
      const refreshedProfile = await refreshProfile();
      setRegisteredEmail(refreshedProfile.email || registeredEmail);
      setEmailOtpCode("");
      setVerificationFeedback({
        tone: "success",
        message: `Email ${maskEmail(refreshedProfile.email || registeredEmail)} đã được xác minh thành công.`,
      });
      pushNotification(
        "success",
        "Xác minh hoàn tất",
        "Email đã được xác minh. Bạn có thể tiếp tục vào tài khoản."
      );
    } catch (reason) {
      setVerificationFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleResendEmailOtp() {
    try {
      setEmailBusy(true);
      const challenge = emailVerification?.verification_id
        ? await resendEmailVerificationOtp(emailVerification.verification_id)
        : await sendEmailVerificationOtp();
      applyEmailVerificationStatus(challenge, registeredEmail);
      setEmailOtpCode("");
      setVerificationFeedback({
        tone: "info",
        message: challenge
          ? `Một mã OTP mới đã được gửi tới ${challenge.email_masked}.`
          : `Hệ thống đã gửi lại mã tới ${maskEmail(registeredEmail)}.`,
      });
    } catch (reason) {
      setVerificationFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setEmailBusy(false);
    }
  }

  function handleOAuthLogin(provider: "google") {
    clearError();
    beginOAuthLogin(provider, {
      redirectTo,
      remember: false,
    });
  }

  if (isAuthenticated && !holdRedirect) {
    return <Navigate replace to={redirectTo} />;
  }

  const identifierBadgeLabel =
    identifierKind === "email"
      ? "Email"
      : identifierKind === "phone"
        ? "Phone"
        : "Auto";

  return (
    <div className="auth-page auth-page-register">
      <NotificationStack items={notifications} onDismiss={dismissNotification} />

      <header className="auth-register-topbar">
        <div className="auth-register-topbar-inner">
          <Link className="auth-register-brand" to="/">
            ND Shop
          </Link>
          <button className="auth-register-help" type="button">
            ?
          </button>
        </div>
      </header>

      <main className="auth-register-shell">
        <section className="auth-register-visual">
          <div className="auth-register-visual-image" />
          <div className="auth-register-visual-copy">
            <p>
              Join the <span>Atelier</span> of Curated Essentials.
            </p>
            <small>Experience a sanctuary of quality, crafted for the modern aesthetic.</small>
          </div>
        </section>

        <section className="auth-register-form-panel">
          <div className="auth-register-form-card">
            <header className="auth-register-head auth-register-head-compact">
              <h1>{stage === "verify_email" ? "Verify Email OTP" : "Create Account"}</h1>
              <p>
                {stage === "verify_email"
                  ? "Nhập OTP một lần được gửi tới email của bạn để hoàn tất xác minh."
                  : "Hệ thống sẽ tự nhận diện email hoặc số điện thoại ngay khi bạn nhập."}
              </p>
            </header>

            {stage === "form" ? (
              <form className="auth-register-form auth-register-form-compact" noValidate onSubmit={handleRegister}>
                <div className="auth-register-fields auth-register-fields-compact">
                  <FormField
                    action={
                      <span className={`auth-register-detection-badge auth-register-detection-badge-${identifierKind}`}>
                        {identifierBadgeLabel}
                      </span>
                    }
                    error={visibleErrors.identifier}
                    hint={
                      identifierKind === "email"
                        ? "Đã nhận diện email. Sau khi tạo tài khoản, OTP sẽ được gửi qua email."
                        : identifierKind === "phone"
                          ? "Đã nhận diện số điện thoại. Hệ thống sẽ gửi Telegram OTP ngay sau khi bạn bấm nút đăng ký."
                          : "Bạn có thể nhập email hoặc số điện thoại Việt Nam."
                    }
                    htmlFor="register-identifier"
                    label="Email Or Phone Number"
                    required
                  >
                    <input
                      aria-invalid={Boolean(visibleErrors.identifier)}
                      autoComplete="username"
                      className={inputClassName(Boolean(visibleErrors.identifier))}
                      id="register-identifier"
                      inputMode={identifierKind === "phone" ? "tel" : "email"}
                      placeholder={
                        identifierKind === "phone" ? "09xxxxxxxx" : "hello@example.com"
                      }
                      type="text"
                      value={form.identifier}
                      onBlur={() => markTouched("identifier")}
                      onChange={(event) => updateField("identifier", event.target.value)}
                    />
                  </FormField>

                  <FormField
                    error={visibleErrors.password}
                    htmlFor="register-password"
                    label="Password"
                    required
                  >
                    <input
                      aria-invalid={Boolean(visibleErrors.password)}
                      autoComplete="new-password"
                      className={inputClassName(Boolean(visibleErrors.password))}
                      id="register-password"
                      placeholder="••••••••"
                      type="password"
                      value={form.password}
                      onBlur={() => markTouched("password")}
                      onChange={(event) => updateField("password", event.target.value)}
                    />
                  </FormField>

                  <FormField
                    error={visibleErrors.confirmPassword}
                    htmlFor="register-confirm-password"
                    label="Confirm Password"
                    required
                  >
                    <input
                      aria-invalid={Boolean(visibleErrors.confirmPassword)}
                      autoComplete="new-password"
                      className={inputClassName(Boolean(visibleErrors.confirmPassword))}
                      id="register-confirm-password"
                      placeholder="••••••••"
                      type="password"
                      value={form.confirmPassword}
                      onBlur={() => markTouched("confirmPassword")}
                      onChange={(event) => updateField("confirmPassword", event.target.value)}
                    />
                  </FormField>
                </div>

                {identifierKind === "phone" ? (
                  <div className="auth-register-detected-card">
                    <div className="auth-register-detected-head">
                      <strong>Telegram OTP</strong>
                      <span>{normalizedPhone || "Phone detected"}</span>
                    </div>
                    <p className="auth-register-inline-note">
                      Hệ thống sẽ tạo tài khoản bằng số điện thoại sau khi bạn nhập đúng Telegram
                      OTP gồm 6 chữ số được gửi từ bot.
                    </p>
                    {phoneVerification ? (
                      <div className="auth-register-otp-meta">
                        <span>Hết hạn sau {formatSecondsLabel(phoneOtpExpiresIn)}</span>
                        <span>Gửi lại sau {formatSecondsLabel(phoneOtpResendIn)}</span>
                        <span>Còn {phoneVerification.remaining_attempts} lượt nhập</span>
                      </div>
                    ) : null}
                    <input
                      autoComplete="one-time-code"
                      className="auth-field-input"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Nhập Telegram OTP"
                      type="text"
                      value={phoneOtpCode}
                      onChange={(event) => setPhoneOtpCode(event.target.value)}
                    />
                    <div className="auth-register-inline-actions">
                      <button
                        className="auth-social-button auth-register-inline-button"
                        disabled={phoneBusy}
                        type="button"
                        onClick={() => void handleSendPhoneOtp()}
                      >
                        {phoneBusy ? "Đang gửi..." : "Send Telegram OTP"}
                      </button>
                      <button
                        className="auth-social-button auth-register-inline-button"
                        disabled={phoneBusy || phoneOtpCode.trim().length !== 6}
                        type="button"
                        onClick={() => void handleVerifyPhoneOtp()}
                      >
                        Verify OTP
                      </button>
                      {phoneVerification ? (
                        <button
                          className="auth-social-button auth-register-inline-button"
                          disabled={phoneBusy || phoneOtpResendIn > 0}
                          type="button"
                          onClick={() => void handleResendPhoneOtp()}
                        >
                          {phoneOtpResendIn > 0
                            ? `Resend in ${phoneOtpResendIn}s`
                            : "Resend OTP"}
                        </button>
                      ) : null}
                    </div>
                    <p>
                      Bạn cũng có thể chuyển sang email để nhận OTP email hoặc tiếp tục với Google
                      nếu thuận tiện hơn.
                    </p>
                  </div>
                ) : null}

                {verificationFeedback ? (
                  <div className={`feedback feedback-${verificationFeedback.tone}`}>
                    {verificationFeedback.message}
                  </div>
                ) : null}

                <button
                  className="primary-button auth-submit-full auth-submit-compact"
                  disabled={isBusy || phoneBusy}
                  type="submit"
                >
                  {identifierKind === "phone"
                    ? phoneBusy
                      ? "Đang gửi Telegram OTP..."
                      : "Send Telegram OTP"
                    : isBusy
                      ? "Đang tạo tài khoản..."
                      : "Register"}
                </button>

                <div className="auth-login-separator auth-login-separator-compact">
                  <span>Or continue with</span>
                </div>

                <div className="auth-social-grid auth-social-grid-compact">
                  <button
                    className="auth-social-button"
                    type="button"
                    onClick={() => handleOAuthLogin("google")}
                  >
                    <span>G</span>
                    <span>Continue with Google</span>
                  </button>
                </div>

                <div className="auth-register-footer auth-register-footer-compact">
                  <p>
                    Already have an account?
                    <Link state={location.state} to="/login">
                      Login
                    </Link>
                  </p>
                </div>
              </form>
            ) : (
              <div className="auth-register-verify-stack">
                <div className="auth-register-detected-card auth-register-detected-card-email">
                  <div className="auth-register-detected-head">
                    <strong>Email OTP</strong>
                    <span>{maskEmail(registeredEmail)}</span>
                  </div>
                  <p>
                    Nhập OTP gồm 6 chữ số. Hệ thống sẽ gửi lại mã qua email nếu phiên xác minh vẫn
                    còn hiệu lực.
                  </p>
                  {emailVerification ? (
                    <div className="auth-register-otp-meta">
                      <span>Hết hạn sau {formatSecondsLabel(emailOtpExpiresIn)}</span>
                      <span>Gửi lại sau {formatSecondsLabel(emailOtpResendIn)}</span>
                      <span>Còn {emailVerification.remaining_attempts} lượt nhập</span>
                    </div>
                  ) : null}
                </div>

                {verificationFeedback ? (
                  <div className={`feedback feedback-${verificationFeedback.tone}`}>
                    {verificationFeedback.message}
                  </div>
                ) : null}

                <FormField
                  htmlFor="register-email-otp"
                  label="Email OTP"
                  required
                >
                  <input
                    autoComplete="one-time-code"
                    className="auth-field-input"
                    id="register-email-otp"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    type="text"
                    value={emailOtpCode}
                    onChange={(event) => setEmailOtpCode(event.target.value)}
                  />
                </FormField>

                <div className="auth-register-verify-actions">
                  <button
                    className="primary-button auth-submit-full auth-submit-compact"
                    disabled={emailBusy || emailOtpCode.trim().length !== 6}
                    type="button"
                    onClick={() => void handleVerifyEmailOtp()}
                  >
                    {emailBusy ? "Đang xác minh..." : "Verify OTP"}
                  </button>
                  <button
                    className="auth-social-button"
                    disabled={emailBusy || emailOtpResendIn > 0}
                    type="button"
                    onClick={() => void handleResendEmailOtp()}
                  >
                    {emailOtpResendIn > 0
                      ? `Resend in ${emailOtpResendIn}s`
                      : "Resend Email OTP"}
                  </button>
                </div>

                <div className="auth-register-footer auth-register-footer-compact">
                  <p>
                    Ready to continue?
                    <button
                      className="auth-register-inline-link"
                      type="button"
                      onClick={() => {
                        setHoldRedirect(false);
                        navigate(redirectTo, { replace: true });
                      }}
                    >
                      Go to account
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="auth-global-footer auth-global-footer-muted">
        <div className="auth-global-footer-inner">
          <div className="auth-global-footer-brand">ND Shop</div>
          <div className="auth-global-footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Contact Support</a>
          </div>
          <div className="auth-global-footer-copy">© 2024 ND Shop. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
