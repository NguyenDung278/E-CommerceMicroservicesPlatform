import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { FormField } from "../ui/form/FormField";
import { api, getErrorMessage } from "../lib/api";
import { isStrongPassword } from "../utils/validation";
import "./AuthPages.css";

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
      <section className="auth-status-shell">
        <aside className="auth-status-story">
          <div className="auth-status-brand">ND Shop</div>

          <div className="auth-status-copy">
            <span className={`auth-status-pill auth-status-pill-${token ? "idle" : "error"}`}>
              {token ? "Secure reset" : "Token missing"}
            </span>
            <h1>Đặt lại mật khẩu với một panel gọn, rõ trạng thái và bám đúng flow backend.</h1>
            <p>
              Reset password tiếp tục dùng token từ query string, không tạo thêm bước OTP. Frontend chỉ lo validate dữ
              liệu mới và phản hồi lại kết quả từ API.
            </p>
          </div>

          <div className="auth-status-story-list">
            <article>
              <strong>Password rules rõ ràng</strong>
              <span>Tối thiểu 8 ký tự và cần có cả chữ lẫn số trước khi gửi request.</span>
            </article>
            <article>
              <strong>Token-safe flow</strong>
              <span>Nếu thiếu hoặc hết hạn token, người dùng nhận được đường quay lại luồng recovery ngay.</span>
            </article>
            <article>
              <strong>Consistent auth surfaces</strong>
              <span>Visual language được giữ đồng bộ với login và register, không còn tách rời khỏi storefront.</span>
            </article>
          </div>
        </aside>

        <article className="auth-status-panel">
          <div className="auth-status-panel-inner">
            <div className="auth-status-head">
              <span className="section-kicker">Password Reset</span>
              <h2>Đặt lại mật khẩu</h2>
              <p>Nhập mật khẩu mới để hoàn tất khôi phục truy cập cho tài khoản của bạn.</p>
            </div>

            {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

            <form className="auth-status-form" onSubmit={handleSubmit}>
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
            </form>

            <div className="summary-actions">
              <Link className="text-link" to="/login">
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
