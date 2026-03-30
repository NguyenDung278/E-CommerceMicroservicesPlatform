import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../features/auth/hooks/useAuth";
import { clearPendingOAuthRemember, readPendingOAuthRemember } from "../features/auth/storage/oauthSessionStorage";
import { getErrorMessage } from "../shared/api/error-handler";
import "./AuthPages.css";

type AuthCallbackStatus = "idle" | "success" | "error";

export function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { exchangeOAuthTicket } = useAuth();
  const [status, setStatus] = useState<AuthCallbackStatus>("idle");
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập mạng xã hội...");
  const [nextPath, setNextPath] = useState("/profile");

  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.startsWith("#") ? location.hash.slice(1) : "");
    const ticket = hashParams.get("ticket")?.trim() ?? "";
    const error = hashParams.get("error")?.trim() ?? "";
    const errorMessage = hashParams.get("message")?.trim() ?? "";
    const next = normalizeClientRedirect(hashParams.get("next"));

    setNextPath(next);

    if (error) {
      clearPendingOAuthRemember();
      setStatus("error");
      setMessage(errorMessage || "Đăng nhập mạng xã hội không thành công.");
      return;
    }

    if (!ticket) {
      clearPendingOAuthRemember();
      setStatus("error");
      setMessage("Thiếu mã đăng nhập từ backend. Hãy thử lại từ màn hình đăng nhập.");
      return;
    }

    let active = true;

    void exchangeOAuthTicket(ticket, { remember: readPendingOAuthRemember() })
      .then(() => {
        if (!active) {
          return;
        }

        setStatus("success");
        setMessage("Đăng nhập thành công. Đang đưa bạn quay lại trải nghiệm mua sắm...");
        window.setTimeout(() => navigate(next, { replace: true }), 500);
      })
      .catch((reason) => {
        if (!active) {
          return;
        }

        clearPendingOAuthRemember();
        setStatus("error");
        setMessage(getErrorMessage(reason));
      });

    return () => {
      active = false;
    };
  }, [exchangeOAuthTicket, location.hash, navigate]);

  return (
    <div className="page-stack">
      <section className="auth-status-shell">
        <aside className="auth-status-story">
          <div className="auth-status-brand">ND Shop</div>

          <div className="auth-status-copy">
            <span className={`auth-status-pill auth-status-pill-${status}`}>
              {status === "success" ? "Social login ready" : status === "error" ? "Action needed" : "Connecting"}
            </span>
            <h1>Đăng nhập mạng xã hội được hoàn tất qua backend callback an toàn.</h1>
            <p>
              Trang này chỉ nhận ticket ngắn hạn từ gateway, đổi sang token pair chuẩn của hệ thống rồi điều hướng bạn
              trở về luồng mua sắm trước đó.
            </p>
          </div>

          <div className="auth-status-story-list">
            <article>
              <strong>No JWT in URL</strong>
              <span>Token truy cập thật chỉ được trả về qua API exchange sau khi frontend đã quay lại origin an toàn.</span>
            </article>
            <article>
              <strong>Session hợp nhất</strong>
              <span>Google, Facebook và email/password đều đi qua cùng một cơ chế lưu token và bootstrap profile.</span>
            </article>
            <article>
              <strong>Redirect chính xác</strong>
              <span>Bạn sẽ được đưa về đúng route trước khi đăng nhập, thay vì luôn rơi về profile hoặc trang chủ.</span>
            </article>
          </div>
        </aside>

        <article className="auth-status-panel">
          <div className="auth-status-panel-inner">
            <div className="auth-status-head">
              <span className="section-kicker">OAuth Callback</span>
              <h2>Hoàn tất đăng nhập</h2>
              <p>Frontend đang xử lý kết quả callback và đồng bộ phiên với hệ thống ND Shop.</p>
            </div>

            <div className={status === "error" ? "feedback feedback-error" : "feedback feedback-info"}>{message}</div>

            <div className="auth-status-actions">
              {status === "error" ? (
                <Link
                  className="primary-link"
                  state={{ from: { pathname: nextPath, search: "", hash: "" } }}
                  to="/login"
                >
                  Quay lại đăng nhập
                </Link>
              ) : null}
              <Link className={status === "error" ? "ghost-button" : "primary-link"} to="/">
                Về trang chủ
              </Link>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

function normalizeClientRedirect(value: string | null): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/profile";
  }

  return trimmed;
}
