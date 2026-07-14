import { KeyRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { changePassword } from "../../services/user-service";
import { useAuth } from "../../state/auth-context";

const emptyPasswordForm = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

/** Đổi mật khẩu cho tài khoản đang đăng nhập. */
export function SecuritySection() {
  const { token } = useAuth();
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordStatus("Mật khẩu mới không khớp.");
      return;
    }

    try {
      setPasswordSubmitting(true);
      setPasswordStatus(null);
      await changePassword(token, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm(emptyPasswordForm);
      setPasswordStatus("Đã đổi mật khẩu.");
    } catch (err) {
      setPasswordStatus(err instanceof Error ? err.message : "Không đổi được mật khẩu");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  return (
    <section className="surface-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Security</span>
          <h2>Đổi mật khẩu</h2>
        </div>
        <KeyRound size={24} />
      </div>
      <form className="profile-form" onSubmit={handleChangePassword}>
        <div className="form-grid">
          <label>
            Mật khẩu hiện tại
            <input
              type="password"
              value={passwordForm.current_password}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  current_password: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            Mật khẩu mới
            <input
              type="password"
              value={passwordForm.new_password}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  new_password: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            Nhập lại mật khẩu mới
            <input
              type="password"
              value={passwordForm.confirm_password}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  confirm_password: event.target.value,
                }))
              }
              required
            />
          </label>
        </div>
        {passwordStatus ? <p className="muted-text">{passwordStatus}</p> : null}
        <button className="button button--secondary" type="submit" disabled={passwordSubmitting}>
          {passwordSubmitting ? "Đang đổi" : "Đổi mật khẩu"}
        </button>
      </form>
    </section>
  );
}
