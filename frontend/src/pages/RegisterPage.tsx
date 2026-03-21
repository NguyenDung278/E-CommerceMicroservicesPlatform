import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, type Location as RouterLocation } from "react-router-dom";

import { FormField } from "../components/FormField";
import { NotificationStack, type NotificationItem } from "../components/NotificationStack";
import { AuthShell } from "../components/auth/AuthShell";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../lib/api";
import { getVisibleErrors, inputClassName, splitFullName, type TouchedFields } from "../utils/authForm";
import { sanitizeEmail } from "../utils/sanitize";
import { type RegisterFormValues, validateRegisterFields } from "../utils/validation";

type AuthLocationState = {
  from?: RouterLocation;
};

const defaultRegisterForm: RegisterFormValues = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: ""
};

const registerStats = [
  {
    value: "4 trường",
    label: "Form gọn đúng với yêu cầu tạo tài khoản"
  },
  {
    value: "Realtime",
    label: "Validation client-side rõ ràng ngay khi nhập"
  },
  {
    value: "Fast",
    label: "Đăng ký xong có thể đi thẳng vào tài khoản"
  }
];

const registerHighlights = [
  {
    title: "Tập trung vào chuyển đổi",
    description: "Không nhồi quá nhiều trường, chỉ giữ lại dữ liệu thực sự cần cho bước khởi tạo."
  },
  {
    title: "Thiết kế dễ tin cậy",
    description: "Mảng sáng, khoảng thở rộng, typography đậm và CTA rõ như các landing auth hiện đại."
  },
  {
    title: "Sẵn sàng tích hợp thật",
    description: "Frontend tách riêng page và route nên sau này nối SSO hoặc OTP cũng không phải phá layout."
  }
];

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
  const passwordChecks = [
    {
      label: "Từ 8 ký tự",
      passed: form.password.trim().length >= 8
    },
    {
      label: "Có chữ cái",
      passed: /[A-Za-z]/.test(form.password)
    },
    {
      label: "Có số",
      passed: /\d/.test(form.password)
    }
  ];

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
        password: true,
        confirmPassword: true
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
          phone: "",
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
    <div className="page-stack">
      <NotificationStack items={notifications} onDismiss={dismissNotification} />

      <AuthShell
        badge="Đăng ký"
        description="Trang đăng ký được tách riêng để người dùng mới tập trung hoàn tất thông tin nhanh, ít nhầm lẫn và dễ thao tác hơn trên mobile."
        highlights={registerHighlights}
        mode="register"
        panelDescription="Tạo tài khoản mới với form sạch, validation rõ và cấu trúc sẵn sàng tích hợp vào luồng thương mại điện tử thực tế."
        panelLabel="Khách hàng mới"
        panelTitle="Tạo tài khoản"
        stats={registerStats}
        title="Đăng ký tài khoản mới với trải nghiệm gọn, hiện đại và đủ tin cậy để dùng như một storefront thật."
      >
        <form className="auth-form-stack" noValidate onSubmit={handleRegister}>
          <FormField
            error={visibleErrors.fullName}
            hint="Nhập đúng họ tên để thuận tiện cho giao hàng và chăm sóc đơn hàng."
            htmlFor="register-full-name"
            label="Họ và tên"
            required
          >
            <input
              aria-invalid={Boolean(visibleErrors.fullName)}
              autoComplete="name"
              className={inputClassName(Boolean(visibleErrors.fullName))}
              id="register-full-name"
              placeholder="Nguyễn Văn Minh"
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
              placeholder="name@example.com"
              type="email"
              value={form.email}
              onBlur={() => markTouched("email")}
              onChange={(event) => updateField("email", event.target.value)}
            />
          </FormField>

          <FormField
            error={visibleErrors.password}
            hint="Mật khẩu nên có chữ và số để đủ mạnh nhưng vẫn dễ nhớ."
            htmlFor="register-password"
            label="Mật khẩu"
            required
          >
            <input
              aria-invalid={Boolean(visibleErrors.password)}
              autoComplete="new-password"
              className={inputClassName(Boolean(visibleErrors.password))}
              id="register-password"
              placeholder="Tạo mật khẩu"
              type="password"
              value={form.password}
              onBlur={() => markTouched("password")}
              onChange={(event) => updateField("password", event.target.value)}
            />
          </FormField>

          <div className="auth-password-grid" aria-live="polite">
            {passwordChecks.map((item) => (
              <div
                className={item.passed ? "auth-password-item auth-password-item-checked" : "auth-password-item"}
                key={item.label}
              >
                {item.label}
              </div>
            ))}
          </div>

          <FormField
            error={visibleErrors.confirmPassword}
            htmlFor="register-confirm-password"
            label="Xác nhận mật khẩu"
            required
          >
            <input
              aria-invalid={Boolean(visibleErrors.confirmPassword)}
              autoComplete="new-password"
              className={inputClassName(Boolean(visibleErrors.confirmPassword))}
              id="register-confirm-password"
              placeholder="Nhập lại mật khẩu"
              type="password"
              value={form.confirmPassword}
              onBlur={() => markTouched("confirmPassword")}
              onChange={(event) => updateField("confirmPassword", event.target.value)}
            />
          </FormField>

          <button className="primary-button auth-submit-full" disabled={isBusy} type="submit">
            {isBusy ? "Đang tạo tài khoản..." : "Đăng ký"}
          </button>
        </form>

        <p className="auth-switch-copy">
          Đã có tài khoản?{" "}
          <Link className="auth-switch-link" state={location.state} to="/login">
            Đăng nhập ngay
          </Link>
        </p>
      </AuthShell>
    </div>
  );
}
