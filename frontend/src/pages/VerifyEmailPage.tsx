import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { api, getErrorMessage } from "../lib/api";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, refreshProfile } = useAuth();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("Đang xác minh email của bạn...");

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
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Email Verification</span>
            <h1>Xác minh địa chỉ email</h1>
          </div>
        </div>

        <div className={status === "error" ? "feedback feedback-error" : "feedback feedback-info"}>
          {message}
        </div>

        <div className="summary-actions">
          <Link className="primary-link" to={isAuthenticated ? "/profile" : "/login"}>
            {isAuthenticated ? "Quay lại tài khoản" : "Đi đến đăng nhập"}
          </Link>
          <Link className="ghost-button" to="/">
            Về trang chủ
          </Link>
        </div>
      </section>
    </div>
  );
}
