import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  type Location as RouterLocation,
} from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { appendAuthFlowLog } from "@/features/auth/storage/auth-flow-log-storage";
import {
  clearRememberedLogin,
  readRememberedLogin,
  saveRememberedLogin,
} from "@/features/auth/storage/remembered-login-storage";
import {
  getVisibleErrors,
  inputClassName,
  normalizeIdentifier,
  type TouchedFields,
} from "@/features/auth/utils/auth-form";
import { NotificationStack, type NotificationItem } from "@/components/feedback/notification-stack";
import { FormField } from "@/components/form/form-field";
import { getErrorMessage } from "@/services/api";
import { type LoginFormValues, validateLoginFields } from "@/utils/validation";
import "@/styles/pages/auth/auth-pages.css";

type AuthLocationState = {
  from?: RouterLocation;
  message?: string;
};

const defaultLoginForm: LoginFormValues = {
  identifier: "",
  password: "",
  rememberMe: false,
};

const loginVisualHighlights = [
  "Theo dõi catalog, đơn hàng, returns và payments trong cùng một nơi.",
  "Một runtime riêng cho staff/admin, tách biệt hoàn toàn với storefront ND Shop.",
];

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, login, beginOAuthLogin, error, clearError } = useAuth();
  const [loginForm, setLoginForm] = useState<LoginFormValues>(() => {
    const remembered = readRememberedLogin();

    if (!remembered) {
      return defaultLoginForm;
    }

    return {
      identifier: remembered.identifier,
      password: "",
      rememberMe: true,
    };
  });
  const [touched, setTouched] = useState<TouchedFields<LoginFormValues>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [delayRedirect, setDelayRedirect] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const navigationState = location.state as AuthLocationState | null;
  const redirectTo = navigationState?.from
    ? `${navigationState.from.pathname}${navigationState.from.search}${navigationState.from.hash}`
    : "/admin";
  const loginPromptMessage = navigationState?.message?.trim() ?? "";
  const loginErrors = validateLoginFields(loginForm);
  const visibleErrors = getVisibleErrors(loginErrors, touched, submitted);

  useEffect(() => {
    if (!error) {
      return;
    }

    pushNotification("error", "Có lỗi xác thực", error);
  }, [error]);

  useEffect(() => {
    if (!loginPromptMessage) {
      return;
    }

    pushNotification("info", "Yêu cầu đăng nhập", loginPromptMessage);
    appendAuthFlowLog("login_prompt_displayed", {
      redirectTo,
      message: loginPromptMessage,
    });
  }, [loginPromptMessage, redirectTo]);

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

  function updateField<Key extends keyof LoginFormValues>(field: Key, value: LoginFormValues[Key]) {
    setLoginForm((current) => ({ ...current, [field]: value }));
    clearError();
  }

  function markTouched<Key extends keyof LoginFormValues>(field: Key) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    clearError();

    if (Object.keys(loginErrors).length > 0) {
      setTouched({
        identifier: true,
        password: true,
      });
      pushNotification(
        "error",
        "Đăng nhập chưa thành công",
        "Vui lòng kiểm tra lại tài khoản và mật khẩu trước khi tiếp tục."
      );
      return;
    }

    const identifier = normalizeIdentifier(loginForm.identifier);
    const password = loginForm.password.trim();

    try {
      setIsBusy(true);
      await login(
        {
          identifier,
          email: identifier.includes("@") ? identifier : undefined,
          password,
        },
        { remember: loginForm.rememberMe }
      );

      if (loginForm.rememberMe) {
        saveRememberedLogin({
          identifier: loginForm.identifier,
        });
      } else {
        clearRememberedLogin();
      }

      setDelayRedirect(true);
      pushNotification(
        "success",
        "Đăng nhập thành công",
        "Đang đưa bạn vào khu vực quản trị và workbook."
      );
      window.setTimeout(() => navigate(redirectTo, { replace: true }), 450);
    } catch (reason) {
      pushNotification("error", "Không thể đăng nhập", getErrorMessage(reason));
    } finally {
      setIsBusy(false);
    }
  }

  function handleOAuthLogin(provider: "google") {
    clearError();
    beginOAuthLogin(provider, {
      redirectTo,
      remember: loginForm.rememberMe,
    });
  }

  return (
    <div className="auth-page auth-page-login">
      <NotificationStack items={notifications} onDismiss={dismissNotification} />

      <header className="auth-minimal-topbar">
        <div className="auth-minimal-topbar-inner">
          <Link className="auth-minimal-brand" to="/">
            ND Admin
          </Link>
        </div>
      </header>

      {isAuthenticated && !delayRedirect ? (
        <Navigate replace to={redirectTo} />
      ) : (
        <main className="auth-login-shell">
          <section className="auth-login-visual">
            <div className="auth-login-visual-backdrop" />
            <div className="auth-login-visual-overlay" />

            <div className="auth-login-visual-content">
              <div className="auth-login-brand">ND Admin</div>
              <div className="auth-login-copy">
                <h1>Không gian vận hành cho catalog, đơn hàng và doanh thu.</h1>
                <p>
                  Đăng nhập để thêm sản phẩm, theo dõi đơn đã thanh toán, xử lý returns, và xem
                  analytics tăng trưởng từ cùng một dashboard.
                </p>
              </div>

              <div className="auth-login-visual-list">
                {loginVisualHighlights.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

            <div className="auth-login-featured-note">
              <span>Runtime</span>
              <strong>ND Admin</strong>
            </div>
          </section>

          <section className="auth-login-form-panel">
            <div className="auth-login-form-card">
              <header className="auth-login-form-head">
                <h2>Đăng nhập ND Admin</h2>
                <p>Dùng tài khoản staff/admin để mở backoffice vận hành.</p>
              </header>

              <form className="auth-login-form" noValidate onSubmit={handleLogin}>
                <FormField
                  error={visibleErrors.identifier}
                  htmlFor="login-identifier"
                  label="Email hoặc số điện thoại"
                  required
                >
                  <input
                    aria-invalid={Boolean(visibleErrors.identifier)}
                    autoComplete="username"
                    className={inputClassName(Boolean(visibleErrors.identifier))}
                    id="login-identifier"
                    inputMode={loginForm.identifier.includes("@") ? "email" : "text"}
                    placeholder="admin@ndshop.vn"
                    value={loginForm.identifier}
                    onBlur={() => markTouched("identifier")}
                    onChange={(event) => updateField("identifier", event.target.value)}
                  />
                </FormField>

                <FormField
                  action={
                    <button
                      className="auth-inline-action"
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  }
                  error={visibleErrors.password}
                  htmlFor="login-password"
                  label="Password"
                  required
                >
                  <input
                    aria-invalid={Boolean(visibleErrors.password)}
                    autoComplete="current-password"
                    className={inputClassName(Boolean(visibleErrors.password))}
                    id="login-password"
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    value={loginForm.password}
                    onBlur={() => markTouched("password")}
                    onChange={(event) => updateField("password", event.target.value)}
                  />
                </FormField>

                <div className="auth-login-options">
                  <label className="auth-checkbox-row" htmlFor="login-remember">
                    <input
                      checked={loginForm.rememberMe}
                      id="login-remember"
                      type="checkbox"
                      onChange={(event) => updateField("rememberMe", event.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>

                  <Link className="auth-forgot-link" to="/forgot-password">
                    Forgot password?
                  </Link>
                </div>

                <button className="primary-button auth-submit-full" disabled={isBusy} type="submit">
                  <span>{isBusy ? "Đang đăng nhập..." : "Login"}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </form>

              <div className="auth-login-separator">
                <span>Or continue with</span>
              </div>

              <div className="auth-social-grid">
                <button
                  className="auth-social-button"
                  type="button"
                  onClick={() => handleOAuthLogin("google")}
                >
                  <span>G</span>
                  <span>Continue with Google</span>
                </button>
              </div>

              <footer className="auth-login-footer">
                <p>
                  Don&apos;t have an account?
                  <Link state={location.state} to="/register">
                    Register
                  </Link>
                </p>
              </footer>
            </div>
          </section>
        </main>
      )}

      <footer className="auth-global-footer">
        <div className="auth-global-footer-inner">
          <div className="auth-global-footer-brand">ND Admin</div>
          <div className="auth-global-footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Contact Support</a>
          </div>
          <div className="auth-global-footer-copy">© 2024 ND Admin. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
