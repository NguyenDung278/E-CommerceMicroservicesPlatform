import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../features/auth/hooks/useAuth";
import { api, getErrorMessage } from "../shared/api";
import "./AuthPages.css";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, refreshProfile } = useAuth();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("Đang xác minh email của bạn...");
  const statusLabel =
    status === "success" ? "Verified" : status === "error" ? "Action needed" : "Processing token";

  useEffect(() => {
    const token = searchParams.get("token")?.trim() ?? "";
    if (!token) {
      setStatus("error");
      setMessage("Liên kết xác minh không hợp lệ hoặc đã thiếu token.");
      return;
    }

    let active = true;

    void api
      .verifyEmail({ token })
      .then(async () => {
        if (!active) {
          return;
        }
        if (isAuthenticated) {
          try {
            await refreshProfile();
          } catch {
            // Best-effort refresh only.
          }
        }
        setStatus("success");
        setMessage("Email đã được xác minh thành công. Bạn có thể tiếp tục sử dụng tài khoản.");
      })
      .catch((reason) => {
        if (!active) {
          return;
        }
        setStatus("error");
        setMessage(getErrorMessage(reason));
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, refreshProfile, searchParams]);

  return (
    <div className="page-stack">
      <section className="auth-status-shell">
        <aside className="auth-status-story">
          <div className="auth-status-brand">ND Shop</div>

          <div className="auth-status-copy">
            <span className={`auth-status-pill auth-status-pill-${status}`}>{statusLabel}</span>
            <h1>Xác minh email trong cùng luồng storefront hiện tại.</h1>
            <p>
              Màn này bám trực tiếp contract backend hiện có: token được đọc từ query string, gửi sang gateway, rồi
              cập nhật profile cục bộ nếu phiên người dùng đang tồn tại.
            </p>
          </div>

          <div className="auth-status-story-list">
            <article>
              <strong>Token-backed verification</strong>
              <span>Không thêm OTP hay route phụ. Flow giữ nguyên theo backend contract hiện tại.</span>
            </article>
            <article>
              <strong>Profile refresh an toàn</strong>
              <span>Frontend chỉ refresh profile sau khi verify thành công và đang có phiên đăng nhập.</span>
            </article>
            <article>
              <strong>Recovery rõ ràng</strong>
              <span>Người dùng luôn có đường quay lại account, login hoặc trang chủ sau khi xử lý.</span>
            </article>
          </div>
        </aside>

        <article className="auth-status-panel">
          <div className="auth-status-panel-inner">
            <div className="auth-status-head">
              <span className="section-kicker">Email Verification</span>
              <h2>Xác minh địa chỉ email</h2>
              <p>Trạng thái hiện tại được phản hồi trực tiếp từ API Gateway và `user-service`.</p>
            </div>

            <div className={status === "error" ? "feedback feedback-error" : "feedback feedback-info"}>{message}</div>

            <div className="auth-status-actions">
              <Link className="primary-link" to={isAuthenticated ? "/profile" : "/login"}>
                {isAuthenticated ? "Quay lại tài khoản" : "Đi đến đăng nhập"}
              </Link>
              <Link className="ghost-button" to="/">
                Về trang chủ
              </Link>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
