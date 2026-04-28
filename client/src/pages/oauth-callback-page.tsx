import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoadingView } from "../components/status-view";
import { useAuth } from "../state/auth-context";

function readOAuthParams(): URLSearchParams {
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const rawSearch = window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;

  return new URLSearchParams(rawHash || rawSearch);
}

function normalizeInternalPath(value: string | null): string {
  const fallback = "/account";
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { completeOAuthLogin } = useAuth();

  useEffect(() => {
    let active = true;

    async function completeLogin() {
      const params = readOAuthParams();
      const next = normalizeInternalPath(params.get("next"));
      const ticket = params.get("ticket");
      const providerMessage = params.get("message");
      const providerError = params.get("error");

      window.history.replaceState(null, "", "/auth/callback");

      if (providerError || !ticket) {
        navigate("/account", {
          replace: true,
          state: {
            authError: providerMessage || "Không thể hoàn tất đăng nhập Gmail. Vui lòng thử lại.",
          },
        });
        return;
      }

      try {
        await completeOAuthLogin(ticket);
        if (active) {
          navigate(next, { replace: true });
        }
      } catch (err) {
        if (active) {
          navigate("/account", {
            replace: true,
            state: {
              authError:
                err instanceof Error
                  ? err.message
                  : "Không thể hoàn tất đăng nhập Gmail. Vui lòng thử lại.",
            },
          });
        }
      }
    }

    void completeLogin();

    return () => {
      active = false;
    };
  }, [completeOAuthLogin, navigate]);

  return (
    <div className="page-stack">
      <LoadingView label="Đang hoàn tất đăng nhập Gmail" />
      <Link to="/account" className="text-link">
        Trở lại tài khoản
      </Link>
    </div>
  );
}
