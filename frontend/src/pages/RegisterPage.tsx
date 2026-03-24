import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, type Location as RouterLocation } from "react-router-dom";

import { FormField } from "../components/FormField";
import { NotificationStack, type NotificationItem } from "../components/NotificationStack";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../lib/api";
import { getVisibleErrors, inputClassName, splitFullName, type TouchedFields } from "../utils/authForm";
import { sanitizeEmail, sanitizeText } from "../utils/sanitize";
import { type RegisterFormValues, validateRegisterFields } from "../utils/validation";

type AuthLocationState = {
  from?: RouterLocation;
};

const defaultRegisterForm: RegisterFormValues = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  agreeToTerms: false
};

export function RegisterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, register, error, clearError } = useAuth();
  const [form, setForm] = useState(defaultRegisterForm);
  const [touched, setTouched] = useState<TouchedFields<RegisterFormValues>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [delayRedirect, setDelayRedirect] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const navigationState = location.state as AuthLocationState | null;
  const redirectTo = navigationState?.from
    ? `${navigationState.from.pathname}${navigationState.from.search}${navigationState.from.hash}`
    : "/profile";
  const formErrors = validateRegisterFields(form);
  const visibleErrors = getVisibleErrors(formErrors, touched, submitted);

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

  function updateField<Key extends keyof RegisterFormValues>(field: Key, value: RegisterFormValues[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
    clearError();
  }

  function markTouched<Key extends keyof RegisterFormValues>(field: Key) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    clearError();

    if (Object.keys(formErrors).length > 0) {
      setTouched({
        fullName: true,
        email: true,
        phone: true,
        password: true,
        confirmPassword: true,
        agreeToTerms: true
      });
      pushNotification(
        "error",
        "Đăng ký chưa hoàn tất",
        "Thông tin còn thiếu hoặc chưa đúng định dạng. Hãy kiểm tra lại các trường đang được báo lỗi."
      );
      return;
    }

    const name = splitFullName(form.fullName);

    try {
      setIsBusy(true);
      await register(
        {
          email: sanitizeEmail(form.email),
          phone: sanitizeText(form.phone),
          password: form.password.trim(),
          first_name: name.firstName,
          last_name: name.lastName
        },
        { remember: false }
      );

      setDelayRedirect(true);
      pushNotification(
        "success",
        "Tạo tài khoản thành công",
        "Tài khoản đã được tạo. Hãy kiểm tra email để xác minh địa chỉ của bạn."
      );
      window.setTimeout(() => navigate(redirectTo, { replace: true }), 550);
    } catch (reason) {
      pushNotification("error", "Không thể tạo tài khoản", getErrorMessage(reason));
    } finally {
      setIsBusy(false);
    }
  }

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
            <header className="auth-register-head">
              <h1>Create Account</h1>
              <p>Begin your journey with ND Shop.</p>
            </header>

            <form className="auth-register-form" noValidate onSubmit={handleRegister}>
              <div className="auth-register-fields">
                <FormField error={visibleErrors.fullName} htmlFor="register-full-name" label="Full Name" required>
                  <input
                    aria-invalid={Boolean(visibleErrors.fullName)}
                    autoComplete="name"
                    className={inputClassName(Boolean(visibleErrors.fullName))}
                    id="register-full-name"
                    placeholder="Julianna Thorne"
                    value={form.fullName}
                    onBlur={() => markTouched("fullName")}
                    onChange={(event) => updateField("fullName", event.target.value)}
                  />
                </FormField>

                <FormField error={visibleErrors.email} htmlFor="register-email" label="Email" required>
                  <input
                    aria-invalid={Boolean(visibleErrors.email)}
                    autoComplete="email"
                    className={inputClassName(Boolean(visibleErrors.email))}
                    id="register-email"
                    inputMode="email"
                    placeholder="hello@example.com"
                    type="email"
                    value={form.email}
                    onBlur={() => markTouched("email")}
                    onChange={(event) => updateField("email", event.target.value)}
                  />
                </FormField>

                <FormField error={visibleErrors.phone} htmlFor="register-phone" label="Phone Number">
                  <input
                    aria-invalid={Boolean(visibleErrors.phone)}
                    autoComplete="tel"
                    className={inputClassName(Boolean(visibleErrors.phone))}
                    id="register-phone"
                    inputMode="tel"
                    placeholder="+1 (555) 000-0000"
                    type="tel"
                    value={form.phone}
                    onBlur={() => markTouched("phone")}
                    onChange={(event) => updateField("phone", event.target.value)}
                  />
                </FormField>

                <FormField error={visibleErrors.password} htmlFor="register-password" label="Password" required>
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

              <div className="auth-register-checkbox-wrap">
                <label className="auth-checkbox-row auth-checkbox-row-start" htmlFor="register-terms">
                  <input
                    checked={form.agreeToTerms}
                    id="register-terms"
                    type="checkbox"
                    onChange={(event) => updateField("agreeToTerms", event.target.checked)}
                  />
                  <span>Agree to Terms &amp; Privacy</span>
                </label>
                {visibleErrors.agreeToTerms ? <span className="field-error">{visibleErrors.agreeToTerms}</span> : null}
              </div>

              <button className="primary-button auth-submit-full" disabled={isBusy} type="submit">
                {isBusy ? "Đang tạo tài khoản..." : "Register"}
              </button>

              <div className="auth-register-footer">
                <p>
                  Already have an account?
                  <Link state={location.state} to="/login">
                    Login
                  </Link>
                </p>
              </div>
            </form>
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
