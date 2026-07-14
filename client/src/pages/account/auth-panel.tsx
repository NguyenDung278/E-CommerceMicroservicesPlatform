import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { forgotPassword, getGoogleOAuthStartUrl, resetPassword } from "../../services/auth-service";
import { useAuth } from "../../state/auth-context";

type AuthMode = "login" | "register" | "forgot" | "reset";

const modeTitles: Record<AuthMode, string> = {
  login: "Đăng nhập",
  register: "Tạo tài khoản",
  forgot: "Quên mật khẩu",
  reset: "Đặt lại mật khẩu",
};

/** Khối đăng nhập / đăng ký / quên & đặt lại mật khẩu khi chưa có session. */
export function AuthPanel() {
  const { login, register } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const state = location.state as { authError?: string } | null;
    if (state?.authError) {
      setError(state.authError);
    }
  }, [location.state]);

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

  function handleGoogleLogin() {
    setError(null);
    window.location.assign(getGoogleOAuthStartUrl("/account"));
  }

  return (
    <div className="account-layout">
      <section className="surface-section account-panel">
        <span className="eyebrow">Account</span>
        <h1>{modeTitles[mode]}</h1>
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
