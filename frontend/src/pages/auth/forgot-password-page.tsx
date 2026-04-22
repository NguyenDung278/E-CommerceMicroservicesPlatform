import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { FormField } from "@/components/form/form-field";
import { api, getErrorMessage } from "@/services/api";
import { sanitizeEmail } from "@/utils/sanitize";
import { isValidEmail } from "@/utils/validation";
import "@/styles/pages/auth/auth-pages.css";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = sanitizeEmail(email);
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      setError("Hãy nhập email hợp lệ để nhận liên kết đặt lại mật khẩu.");
      setFeedback("");
      return;
    }

    try {
      setIsBusy(true);
      setError("");
      await api.forgotPassword({ email: normalizedEmail });
      setFeedback(
        "Nếu email tồn tại trong hệ thống, chúng tôi sẽ gửi liên kết đặt lại mật khẩu trong ít phút."
      );
    } catch (reason) {
      setFeedback("");
      setError(getErrorMessage(reason));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="auth-focus-page auth-forgot-page">
      <header className="auth-minimal-topbar">
        <div className="auth-minimal-topbar-inner">
          <Link className="auth-minimal-brand" to="/">
            ND Admin
          </Link>
        </div>
      </header>

      <main className="auth-focus-main">
        <section className="auth-recovery-card">
          <div className="auth-recovery-head">
            <h1>Khôi phục mật khẩu</h1>
            <p>Nhập email để nhận liên kết đặt lại mật khẩu cho tài khoản admin/staff.</p>
          </div>

          {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}
          {error ? <div className="feedback feedback-error">{error}</div> : null}

          <form className="auth-recovery-form" noValidate onSubmit={handleSubmit}>
            <FormField htmlFor="forgot-password-email" label="Email" required>
              <input
                id="forgot-password-email"
                autoComplete="email"
                className="auth-underline-input"
                inputMode="email"
                placeholder="admin@ndshop.vn"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>

            <div className="auth-recovery-actions">
              <button className="primary-button auth-submit-full" disabled={isBusy} type="submit">
                {isBusy ? "Đang gửi liên kết..." : "Gửi liên kết đặt lại"}
              </button>

              <div className="auth-recovery-back">
                <Link className="auth-text-link" to="/login">
                  Quay lại đăng nhập
                </Link>
              </div>
            </div>
          </form>
        </section>
      </main>

      <footer className="auth-minimal-footer">
        <div className="auth-minimal-footer-inner">
          <p>© 2024 ND Admin. All rights reserved.</p>
          <nav>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Support</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
