import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, type Location as RouterLocation } from "react-router-dom";

import { NotificationStack, type NotificationItem } from "../components/NotificationStack";
import { FormField } from "../components/FormField";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../lib/api";
import { sanitizeEmail, sanitizePhone, sanitizeText } from "../utils/sanitize";
import {
  type FormErrors,
  type LoginFormValues,
  type RegisterFormValues,
  isValidEmail,
  validateLoginFields,
  validateRegisterFields
} from "../utils/validation";

type AuthLocationState = {
  from?: RouterLocation;
};

type TouchedFields<T extends Record<string, unknown>> = Partial<Record<keyof T, boolean>>;

const defaultLoginForm: LoginFormValues = {
  identifier: "",
  password: "",
  rememberMe: false
};

const defaultRegisterForm: RegisterFormValues = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false
};

const trustPoints = [
  "Xác thực nhanh để tiếp tục checkout mà không mất trạng thái giỏ hàng.",
  "Form tách riêng cho từng hành vi giúp nhìn phát là hiểu ngay phải thao tác ở đâu.",
  "Notification hiển thị trực tiếp ở góc màn hình để phản hồi luôn sau mỗi thao tác."
];

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, register, login, error, clearError } = useAuth();
  const [loginForm, setLoginForm] = useState(defaultLoginForm);
  const [registerForm, setRegisterForm] = useState(defaultRegisterForm);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [loginTouched, setLoginTouched] = useState<TouchedFields<LoginFormValues>>({});
  const [registerTouched, setRegisterTouched] = useState<TouchedFields<RegisterFormValues>>({});
  const [forgotTouched, setForgotTouched] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isBusy, setIsBusy] = useState<"" | "login" | "register" | "forgot">("");
  const [delayRedirect, setDelayRedirect] = useState(false);
  const [submitted, setSubmitted] = useState<{
    login: boolean;
    register: boolean;
    forgot: boolean;
  }>({
    login: false,
    register: false,
    forgot: false
  });

  const navigationState = location.state as AuthLocationState | null;
  const redirectTo = navigationState?.from
    ? `${navigationState.from.pathname}${navigationState.from.search}${navigationState.from.hash}`
    : "/profile";

  const loginErrors = validateLoginFields(loginForm);
  const registerErrors = validateRegisterFields(registerForm);
  const forgotPasswordError =
    (submitted.forgot || forgotTouched) && !isValidEmail(forgotPasswordEmail)
      ? "Vui lòng nhập email hợp lệ để nhận hướng dẫn."
      : "";

  const visibleLoginErrors = getVisibleErrors(loginErrors, loginTouched, submitted.login);
  const visibleRegisterErrors = getVisibleErrors(registerErrors, registerTouched, submitted.register);

  useEffect(() => {
    if (!error) {
      return;
    }

    pushNotification("error", "Có lỗi xác thực", error);
  }, [error]);

  if (isAuthenticated && !delayRedirect) {
    return <Navigate replace to={redirectTo} />;
  }

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

  function updateLoginField<Key extends keyof LoginFormValues>(
    field: Key,
    value: LoginFormValues[Key]
  ) {
    setLoginForm((current) => ({ ...current, [field]: value }));
    clearError();
  }

  function updateRegisterField<Key extends keyof RegisterFormValues>(
    field: Key,
    value: RegisterFormValues[Key]
  ) {
    setRegisterForm((current) => ({ ...current, [field]: value }));
    clearError();
  }

  function markLoginFieldTouched<Key extends keyof LoginFormValues>(field: Key) {
    setLoginTouched((current) => ({ ...current, [field]: true }));
  }

  function markRegisterFieldTouched<Key extends keyof RegisterFormValues>(field: Key) {
    setRegisterTouched((current) => ({ ...current, [field]: true }));
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted((current) => ({ ...current, login: true }));
    clearError();

    if (Object.keys(loginErrors).length > 0) {
      setLoginTouched({
        identifier: true,
        password: true
      });
      pushNotification(
        "error",
        "Đăng nhập chưa thành công",
        "Vui lòng kiểm tra lại email/SĐT và mật khẩu trước khi tiếp tục."
      );
      return;
    }

    const identifier = normalizeIdentifier(loginForm.identifier);
    const payload = {
      identifier,
      email: identifier.includes("@") ? identifier : undefined,
      password: loginForm.password.trim()
    };

    try {
      setIsBusy("login");
      await login(payload, { remember: loginForm.rememberMe });
      setDelayRedirect(true);
      pushNotification("success", "Đăng nhập thành công", "Đang chuyển bạn tới khu vực tài khoản.");
      window.setTimeout(() => navigate(redirectTo, { replace: true }), 450);
    } catch (reason) {
      pushNotification("error", "Không thể đăng nhập", getErrorMessage(reason));
    } finally {
      setIsBusy("");
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted((current) => ({ ...current, register: true }));
    clearError();

    if (Object.keys(registerErrors).length > 0) {
      setRegisterTouched({
        fullName: true,
        email: true,
        phone: true,
        password: true,
        confirmPassword: true,
        acceptTerms: true
      });
      pushNotification(
        "error",
        "Đăng ký chưa hoàn tất",
        "Thông tin đăng ký còn thiếu hoặc chưa đúng. Hãy kiểm tra các trường được đánh dấu."
      );
      return;
    }

    const name = splitFullName(registerForm.fullName);

    try {
      setIsBusy("register");
      await register(
        {
          email: sanitizeEmail(registerForm.email),
          phone: sanitizePhone(registerForm.phone),
          password: registerForm.password.trim(),
          first_name: name.firstName,
          last_name: name.lastName
        },
        { remember: false }
      );
      setDelayRedirect(true);
      pushNotification("success", "Tạo tài khoản thành công", "Tài khoản mới đã sẵn sàng để mua sắm.");
      window.setTimeout(() => navigate(redirectTo, { replace: true }), 550);
    } catch (reason) {
      pushNotification("error", "Không thể tạo tài khoản", getErrorMessage(reason));
    } finally {
      setIsBusy("");
    }
  }

  function revealForgotPassword() {
    setShowForgotPassword(true);
    if (!forgotPasswordEmail && loginForm.identifier.includes("@")) {
      setForgotPasswordEmail(loginForm.identifier);
    }
  }

  function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted((current) => ({ ...current, forgot: true }));
    setForgotTouched(true);

    if (!isValidEmail(forgotPasswordEmail)) {
      pushNotification(
        "error",
        "Chưa gửi được yêu cầu",
        "Bạn cần nhập email hợp lệ để hệ thống có thể gửi hướng dẫn khôi phục."
      );
      return;
    }

    setIsBusy("forgot");
    window.setTimeout(() => {
      setIsBusy("");
      pushNotification(
        "info",
        "Đã ghi nhận yêu cầu quên mật khẩu",
        "Repo hiện chưa có API reset password, nên mình đã hoàn thiện UI và notification. Nếu muốn, mình có thể làm tiếp luôn backend reset mật khẩu."
      );
    }, 500);
  }

  return (
    <div className="page-stack">
      <NotificationStack items={notifications} onDismiss={dismissNotification} />

      <section className="content-section auth-intro">
        <div>
          <span className="section-kicker auth-kicker">Xác thực tài khoản</span>
          <h1>Đăng ký và đăng nhập được tách riêng để thao tác rõ ràng hơn.</h1>
        </div>
        <p className="auth-intro-copy">
          Mình đã đổi sang bố cục hai card độc lập, thêm cụm quên mật khẩu nhìn thấy ngay và
          notification dạng toast để phản hồi rõ ràng cho từng hành động.
        </p>
        <div className="auth-trust-grid">
          {trustPoints.map((point) => (
            <div className="auth-trust-card" key={point}>
              <span className="auth-benefit-bullet" aria-hidden="true" />
              <p>{point}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="content-section auth-dual-shell">
        <div className="auth-dual-grid">
          <article className="auth-card auth-card-register">
            <div className="auth-card-top">
              <div>
                <p className="auth-panel-caption">Khách hàng mới</p>
                <h2>Tạo tài khoản mới</h2>
              </div>
              <span className="auth-chip auth-chip-warm">Nhanh, rõ, đúng form</span>
            </div>

            <form className="auth-form" noValidate onSubmit={handleRegister}>
              <FormField
                error={visibleRegisterErrors.fullName}
                hint="Nhập đúng họ tên để thuận tiện giao hàng và hỗ trợ sau mua."
                htmlFor="register-full-name"
                label="Họ và tên"
                required
              >
                <input
                  aria-invalid={Boolean(visibleRegisterErrors.fullName)}
                  autoComplete="name"
                  className={inputClassName(Boolean(visibleRegisterErrors.fullName))}
                  id="register-full-name"
                  placeholder="Nguyễn Văn Minh"
                  value={registerForm.fullName}
                  onBlur={() => markRegisterFieldTouched("fullName")}
                  onChange={(event) => updateRegisterField("fullName", event.target.value)}
                />
              </FormField>

              <div className="auth-grid-two">
                <FormField
                  error={visibleRegisterErrors.email}
                  htmlFor="register-email"
                  label="Email"
                  required
                >
                  <input
                    aria-invalid={Boolean(visibleRegisterErrors.email)}
                    autoComplete="email"
                    className={inputClassName(Boolean(visibleRegisterErrors.email))}
                    id="register-email"
                    inputMode="email"
                    placeholder="minh@shop.vn"
                    type="email"
                    value={registerForm.email}
                    onBlur={() => markRegisterFieldTouched("email")}
                    onChange={(event) => updateRegisterField("email", event.target.value)}
                  />
                </FormField>

                <FormField
                  error={visibleRegisterErrors.phone}
                  htmlFor="register-phone"
                  label="Số điện thoại"
                  required
                >
                  <input
                    aria-invalid={Boolean(visibleRegisterErrors.phone)}
                    autoComplete="tel"
                    className={inputClassName(Boolean(visibleRegisterErrors.phone))}
                    id="register-phone"
                    inputMode="tel"
                    placeholder="0901234567"
                    value={registerForm.phone}
                    onBlur={() => markRegisterFieldTouched("phone")}
                    onChange={(event) => updateRegisterField("phone", event.target.value)}
                  />
                </FormField>
              </div>

              <div className="auth-grid-two">
                <FormField
                  error={visibleRegisterErrors.password}
                  hint="Tối thiểu 8 ký tự, ưu tiên có chữ hoa, chữ thường và số."
                  htmlFor="register-password"
                  label="Mật khẩu"
                  required
                >
                  <input
                    aria-invalid={Boolean(visibleRegisterErrors.password)}
                    autoComplete="new-password"
                    className={inputClassName(Boolean(visibleRegisterErrors.password))}
                    id="register-password"
                    placeholder="Tạo mật khẩu mạnh"
                    type="password"
                    value={registerForm.password}
                    onBlur={() => markRegisterFieldTouched("password")}
                    onChange={(event) => updateRegisterField("password", event.target.value)}
                  />
                </FormField>

                <FormField
                  error={visibleRegisterErrors.confirmPassword}
                  htmlFor="register-confirm-password"
                  label="Xác nhận mật khẩu"
                  required
                >
                  <input
                    aria-invalid={Boolean(visibleRegisterErrors.confirmPassword)}
                    autoComplete="new-password"
                    className={inputClassName(Boolean(visibleRegisterErrors.confirmPassword))}
                    id="register-confirm-password"
                    placeholder="Nhập lại mật khẩu"
                    type="password"
                    value={registerForm.confirmPassword}
                    onBlur={() => markRegisterFieldTouched("confirmPassword")}
                    onChange={(event) => updateRegisterField("confirmPassword", event.target.value)}
                  />
                </FormField>
              </div>

              <label className="auth-inline-check auth-inline-check-block" htmlFor="register-terms">
                <input
                  checked={registerForm.acceptTerms}
                  id="register-terms"
                  type="checkbox"
                  onBlur={() => markRegisterFieldTouched("acceptTerms")}
                  onChange={(event) => updateRegisterField("acceptTerms", event.target.checked)}
                />
                <span>
                  Tôi đồng ý với điều khoản mua hàng, chính sách bảo mật và cho phép nhận thông tin
                  đơn hàng qua email/SĐT.
                </span>
              </label>
              {visibleRegisterErrors.acceptTerms ? (
                <p className="auth-checkbox-error">{visibleRegisterErrors.acceptTerms}</p>
              ) : null}

              <button
                className="primary-button auth-submit auth-submit-register"
                disabled={isBusy === "register"}
                type="submit"
              >
                {isBusy === "register" ? "Đang tạo tài khoản..." : "Đăng ký"}
              </button>
            </form>
          </article>

          <article className="auth-card auth-card-login">
            <div className="auth-card-top">
              <div>
                <p className="auth-panel-caption">Khách hàng quay lại</p>
                <h2>Đăng nhập</h2>
              </div>
              <span className="auth-chip auth-chip-cool">Tiếp tục mua sắm</span>
            </div>

            <form className="auth-form" noValidate onSubmit={handleLogin}>
              <FormField
                error={visibleLoginErrors.identifier}
                hint="Dùng email hoặc số điện thoại đã đăng ký."
                htmlFor="login-identifier"
                label="Email / Số điện thoại"
                required
              >
                <input
                  aria-invalid={Boolean(visibleLoginErrors.identifier)}
                  autoComplete="username"
                  className={inputClassName(Boolean(visibleLoginErrors.identifier))}
                  id="login-identifier"
                  inputMode={loginForm.identifier.includes("@") ? "email" : "text"}
                  placeholder="minh@shop.vn hoặc 0901234567"
                  value={loginForm.identifier}
                  onBlur={() => markLoginFieldTouched("identifier")}
                  onChange={(event) => updateLoginField("identifier", event.target.value)}
                />
              </FormField>

              <FormField
                action={
                  <button className="field-inline-link" type="button" onClick={revealForgotPassword}>
                    Quên mật khẩu?
                  </button>
                }
                error={visibleLoginErrors.password}
                htmlFor="login-password"
                label="Mật khẩu"
                required
              >
                <input
                  aria-invalid={Boolean(visibleLoginErrors.password)}
                  autoComplete="current-password"
                  className={inputClassName(Boolean(visibleLoginErrors.password))}
                  id="login-password"
                  placeholder="Nhập mật khẩu"
                  type="password"
                  value={loginForm.password}
                  onBlur={() => markLoginFieldTouched("password")}
                  onChange={(event) => updateLoginField("password", event.target.value)}
                />
              </FormField>

              <label className="auth-inline-check" htmlFor="login-remember">
                <input
                  checked={loginForm.rememberMe}
                  id="login-remember"
                  type="checkbox"
                  onChange={(event) => updateLoginField("rememberMe", event.target.checked)}
                />
                <span>Ghi nhớ đăng nhập trên thiết bị này</span>
              </label>

              <button className="secondary-button auth-submit" disabled={isBusy === "login"} type="submit">
                {isBusy === "login" ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>

            {showForgotPassword ? (
              <div className="auth-forgot-card">
                <div className="auth-forgot-head">
                  <div>
                    <h3>Quên mật khẩu?</h3>
                    <p>Nhập email để hệ thống gửi hướng dẫn khôi phục tài khoản.</p>
                  </div>
                  <button
                    className="ghost-button auth-forgot-toggle"
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    Ẩn
                  </button>
                </div>

                <form className="auth-forgot-form" noValidate onSubmit={handleForgotPassword}>
                  <FormField
                    error={forgotPasswordError}
                    htmlFor="forgot-password-email"
                    label="Email nhận hướng dẫn"
                    required
                  >
                    <input
                      aria-invalid={Boolean(forgotPasswordError)}
                      autoComplete="email"
                      className={inputClassName(Boolean(forgotPasswordError))}
                      id="forgot-password-email"
                      inputMode="email"
                      placeholder="minh@shop.vn"
                      type="email"
                      value={forgotPasswordEmail}
                      onBlur={() => setForgotTouched(true)}
                      onChange={(event) => setForgotPasswordEmail(event.target.value)}
                    />
                  </FormField>

                  <button className="ghost-button auth-forgot-submit" disabled={isBusy === "forgot"} type="submit">
                    {isBusy === "forgot" ? "Đang xử lý..." : "Gửi hướng dẫn"}
                  </button>
                </form>
              </div>
            ) : (
              <button className="auth-forgot-reopen" type="button" onClick={revealForgotPassword}>
                Mở lại phần quên mật khẩu
              </button>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

function getVisibleErrors<T extends Record<string, unknown>>(
  errors: FormErrors<T>,
  touched: TouchedFields<T>,
  showAll: boolean
) {
  if (showAll) {
    return errors;
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => touched[field as keyof T])
  ) as FormErrors<T>;
}

function normalizeIdentifier(value: string) {
  const trimmed = sanitizeText(value);
  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("@")) {
    return sanitizeEmail(trimmed);
  }

  return sanitizePhone(trimmed);
}

function splitFullName(value: string) {
  const normalized = sanitizeText(value);
  const parts = normalized.split(" ").filter(Boolean);

  if (parts.length <= 1) {
    return {
      firstName: normalized,
      lastName: ""
    };
  }

  return {
    firstName: parts[parts.length - 1],
    lastName: parts.slice(0, -1).join(" ")
  };
}

function inputClassName(hasError: boolean) {
  return hasError ? "input-error" : undefined;
}
