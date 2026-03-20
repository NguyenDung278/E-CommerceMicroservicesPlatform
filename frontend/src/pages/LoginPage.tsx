import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, type Location as RouterLocation } from "react-router-dom";

import { FormField } from "../components/FormField";
import { NotificationStack, type NotificationItem } from "../components/NotificationStack";
import { AuthShell } from "../components/auth/AuthShell";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../lib/api";
import { getVisibleErrors, inputClassName, normalizeIdentifier, type TouchedFields } from "../utils/authForm";
import { clearRememberedLogin, readRememberedLogin, saveRememberedLogin } from "../utils/authStorage";
import { sanitizeEmail } from "../utils/sanitize";
import { isValidEmail, type LoginFormValues, validateLoginFields } from "../utils/validation";

type AuthLocationState = {
  from?: RouterLocation;
};

const defaultLoginForm: LoginFormValues = {
  identifier: "",
  password: "",
  rememberMe: false
};

const loginStats = [
  {
    value: "1 chạm",
    label: "Mở lại phiên mua sắm đang dang dở"
  },
  {
    value: "Cục bộ",
    label: "Lưu tài khoản trên thiết bị bằng localStorage"
  },
  {
    value: "Responsive",
    label: "Form tối ưu cho mobile và desktop"
  }
];

const loginHighlights = [
  {
    title: "Luồng đăng nhập rõ ràng",
    description: "Trường thông tin gọn, CTA nổi bật và đường đi sang đăng ký nhìn thấy ngay."
  },
  {
    title: "Bám sát hành vi mua hàng",
    description: "Sau khi đăng nhập xong, người dùng được trả về đúng nơi họ đang thao tác trước đó."
  },
  {
    title: "Nhớ tài khoản theo yêu cầu",
    description: "Checkbox ghi nhớ chỉ lưu tài khoản cục bộ để lần sau điền lại nhanh hơn mà không giữ plaintext password."
  }
];

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, login, error, clearError } = useAuth();
  const [loginForm, setLoginForm] = useState<LoginFormValues>(() => {
    const remembered = readRememberedLogin();

    if (!remembered) {
      return defaultLoginForm;
    }

    return {
      identifier: remembered.identifier,
      password: "",
      rememberMe: true
    };
  });
  const [touched, setTouched] = useState<TouchedFields<LoginFormValues>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showRecoveryHelp, setShowRecoveryHelp] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [delayRedirect, setDelayRedirect] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const navigationState = location.state as AuthLocationState | null;
  const redirectTo = navigationState?.from
    ? `${navigationState.from.pathname}${navigationState.from.search}${navigationState.from.hash}`
    : "/profile";
  const loginErrors = validateLoginFields(loginForm);
  const visibleErrors = getVisibleErrors(loginErrors, touched, submitted);
  const recoveryEmail = isValidEmail(loginForm.identifier) ? sanitizeEmail(loginForm.identifier) : "";

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
        password: true
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
          password
        },
        { remember: loginForm.rememberMe }
      );

      if (loginForm.rememberMe) {
        saveRememberedLogin({
          identifier: loginForm.identifier
        });
      } else {
        clearRememberedLogin();
      }

      setDelayRedirect(true);
      pushNotification("success", "Đăng nhập thành công", "Đang đưa bạn quay lại khu vực mua sắm.");
      window.setTimeout(() => navigate(redirectTo, { replace: true }), 450);
    } catch (reason) {
      pushNotification("error", "Không thể đăng nhập", getErrorMessage(reason));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <NotificationStack items={notifications} onDismiss={dismissNotification} />

      <AuthShell
        badge="Đăng nhập"
        description="Trang đăng nhập riêng giúp người dùng quay lại mua hàng nhanh hơn, ít nhiễu hơn và rõ ràng hơn trên mọi kích thước màn hình."
        highlights={loginHighlights}
        mode="login"
        panelDescription="Điền thông tin đăng nhập để tiếp tục checkout, xem đơn hàng và quản lý tài khoản."
        panelLabel="Chào mừng trở lại"
        panelTitle="Đăng nhập tài khoản"
        stats={loginStats}
        title="Truy cập lại tài khoản của bạn trong một giao diện gọn, sáng và chuyên nghiệp."
      >
        <form className="auth-form-stack" noValidate onSubmit={handleLogin}>
          <FormField
            error={visibleErrors.identifier}
            hint="Nhập email đã đăng ký hoặc số điện thoại dùng để đăng nhập."
            htmlFor="login-identifier"
            label="Email / Số điện thoại"
            required
          >
            <input
              aria-invalid={Boolean(visibleErrors.identifier)}
              autoComplete="username"
              className={inputClassName(Boolean(visibleErrors.identifier))}
              id="login-identifier"
              inputMode={loginForm.identifier.includes("@") ? "email" : "text"}
              placeholder="name@example.com"
              value={loginForm.identifier}
              onBlur={() => markTouched("identifier")}
              onChange={(event) => updateField("identifier", event.target.value)}
            />
          </FormField>

          <FormField
            error={visibleErrors.password}
            htmlFor="login-password"
            label="Mật khẩu"
            required
          >
            <input
              aria-invalid={Boolean(visibleErrors.password)}
              autoComplete="current-password"
              className={inputClassName(Boolean(visibleErrors.password))}
              id="login-password"
              placeholder="Nhập mật khẩu"
              type="password"
              value={loginForm.password}
              onBlur={() => markTouched("password")}
              onChange={(event) => updateField("password", event.target.value)}
            />
          </FormField>

          <div className="auth-meta-row">
            <label className="auth-shell-check" htmlFor="login-remember">
              <input
                checked={loginForm.rememberMe}
                id="login-remember"
                type="checkbox"
                onChange={(event) => updateField("rememberMe", event.target.checked)}
              />
              <span>Ghi nhớ tài khoản</span>
            </label>

            <button
              className="auth-text-link"
              type="button"
              onClick={() => setShowRecoveryHelp((current) => !current)}
            >
              Quên mật khẩu?
            </button>
          </div>

          <p className="auth-storage-note">
            Khi bật, hệ thống sẽ lưu lại tài khoản trên thiết bị này để điền nhanh hơn ở lần sau.
          </p>

          {showRecoveryHelp ? (
            <div className="auth-help-card">
              <strong>Khôi phục mật khẩu</strong>
              <p>
                Backend hiện chưa cung cấp API đặt lại mật khẩu, nên mình đã chừa sẵn luồng UI để
                bạn nối tiếp sau này mà không phải sửa lại layout.
              </p>
              <p>
                {recoveryEmail
                  ? `Email gợi ý để gửi hướng dẫn sau này: ${recoveryEmail}.`
                  : "Hãy dùng email đăng ký của bạn để hệ thống có thể gửi hướng dẫn khi tính năng này được bật."}
              </p>
            </div>
          ) : null}

          <button className="secondary-button auth-submit-full" disabled={isBusy} type="submit">
            {isBusy ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p className="auth-switch-copy">
          Chưa có tài khoản?{" "}
          <Link className="auth-switch-link" state={location.state} to="/register">
            Đăng ký ngay
          </Link>
        </p>
      </AuthShell>
    </div>
  );
}
