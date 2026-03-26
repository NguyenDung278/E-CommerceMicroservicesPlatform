import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { FormField } from "../ui/form/FormField";
import { api, getErrorMessage } from "../lib/api";
import { sanitizeEmail } from "../utils/sanitize";
import { isValidEmail } from "../utils/validation";
import "./AuthPages.css";

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
      setFeedback("Nếu email tồn tại trong hệ thống, chúng tôi sẽ gửi liên kết đặt lại mật khẩu trong ít phút.");
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
            ND Shop
          </Link>
        </div>
      </header>

      <main className="auth-focus-main">
        <section className="auth-recovery-card">
          <div className="auth-recovery-head">
            <h1>Recover Password</h1>
            <p>Enter your email to receive a verification code</p>
          </div>

          {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}
          {error ? <div className="feedback feedback-error">{error}</div> : null}

          <form className="auth-recovery-form" noValidate onSubmit={handleSubmit}>
            <FormField htmlFor="forgot-password-email" label="Email Address" required>
              <input
                id="forgot-password-email"
                autoComplete="email"
                className="auth-underline-input"
                inputMode="email"
                placeholder="your@email.com"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>

            <div className="auth-recovery-actions">
              <button className="primary-button auth-submit-full" disabled={isBusy} type="submit">
                {isBusy ? "Đang gửi liên kết..." : "Send Verification Code"}
              </button>

              <div className="auth-recovery-back">
                <Link className="auth-text-link" to="/login">
                  Back to Login
                </Link>
              </div>
            </div>
          </form>
        </section>
      </main>

      <footer className="auth-minimal-footer">
        <div className="auth-minimal-footer-inner">
          <p>© 2024 ND Shop. All Rights Reserved.</p>
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
