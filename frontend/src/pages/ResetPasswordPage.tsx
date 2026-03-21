import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { FormField } from "../components/FormField";
import { api, getErrorMessage } from "../lib/api";
import { isStrongPassword } from "../utils/validation";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const token = searchParams.get("token")?.trim() ?? "";

  const passwordChecks = useMemo(
    () => [
      {
        label: "Từ 8 ký tự",
        passed: newPassword.trim().length >= 8
      },
      {
        label: "Có chữ cái",
        passed: /[A-Za-z]/.test(newPassword)
      },
      {
        label: "Có số",
        passed: /\d/.test(newPassword)
      }
    ],
    [newPassword]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setFeedback("Thiếu token đặt lại mật khẩu. Hãy yêu cầu lại liên kết từ màn hình đăng nhập.");
      return;
    }
    if (!isStrongPassword(newPassword)) {
      setFeedback("Mật khẩu mới cần ít nhất 8 ký tự và gồm cả chữ lẫn số.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    try {
      setIsBusy(true);
      await api.resetPassword({
        token,
        new_password: newPassword.trim()
      });
      setFeedback("Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Password Reset</span>
            <h1>Đặt lại mật khẩu</h1>
          </div>
        </div>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        <form className="card auth-form-stack" onSubmit={handleSubmit}>
          <FormField htmlFor="reset-password" label="Mật khẩu mới" required>
            <input
              id="reset-password"
              autoComplete="new-password"
              placeholder="Nhập mật khẩu mới"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
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

          <FormField htmlFor="reset-confirm-password" label="Xác nhận mật khẩu mới" required>
            <input
              id="reset-confirm-password"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </FormField>

          <button className="primary-button auth-submit-full" disabled={isBusy} type="submit">
            {isBusy ? "Đang cập nhật..." : "Lưu mật khẩu mới"}
          </button>

          <div className="summary-actions">
            <Link className="text-link" to="/login">
              Quay lại đăng nhập
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
