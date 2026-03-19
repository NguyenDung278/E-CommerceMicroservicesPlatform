import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { FormField } from "../components/FormField";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../lib/api";
import { sanitizeEmail, sanitizeText } from "../utils/sanitize";
import { validateLogin, validateRegister } from "../utils/validation";

export function AuthPage() {
  const { isAuthenticated, register, login, error, clearError } = useAuth();
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: ""
  });
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });
  const [feedback, setFeedback] = useState("");
  const [isBusy, setIsBusy] = useState("");

  if (isAuthenticated) {
    return <Navigate replace to="/profile" />;
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();

    const payload = {
      email: sanitizeEmail(registerForm.email),
      password: registerForm.password.trim(),
      first_name: sanitizeText(registerForm.firstName),
      last_name: sanitizeText(registerForm.lastName)
    };

    const errors = validateRegister({
      email: payload.email,
      password: payload.password,
      firstName: payload.first_name,
      lastName: payload.last_name
    });

    if (errors.length > 0) {
      setFeedback(errors.join(" "));
      return;
    }

    try {
      setIsBusy("register");
      await register(payload);
      setFeedback("Đăng ký thành công. JWT đã được lưu trong session hiện tại.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsBusy("");
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();

    const payload = {
      email: sanitizeEmail(loginForm.email),
      password: loginForm.password.trim()
    };

    const errors = validateLogin(payload);
    if (errors.length > 0) {
      setFeedback(errors.join(" "));
      return;
    }

    try {
      setIsBusy("login");
      await login(payload);
      setFeedback("Đăng nhập thành công. Bạn có thể tiếp tục mua hàng.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsBusy("");
    }
  }

  return (
    <div className="page-stack">
      <section className="content-section auth-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Tài khoản</span>
            <h1>Đăng ký hoặc đăng nhập để mua hàng</h1>
          </div>
        </div>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}
        {error ? <div className="feedback feedback-error">{error}</div> : null}

        <div className="two-column-grid">
          <form className="card" onSubmit={handleRegister}>
            <h2>Tạo tài khoản mới</h2>
            <FormField htmlFor="register-email" label="Email">
              <input
                id="register-email"
                type="email"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </FormField>
            <FormField htmlFor="register-password" label="Mật khẩu" hint="Tối thiểu 8 ký tự">
              <input
                id="register-password"
                type="password"
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </FormField>
            <div className="inline-grid">
              <FormField htmlFor="register-first-name" label="Tên">
                <input
                  id="register-first-name"
                  value={registerForm.firstName}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, firstName: event.target.value }))
                  }
                />
              </FormField>
              <FormField htmlFor="register-last-name" label="Họ">
                <input
                  id="register-last-name"
                  value={registerForm.lastName}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, lastName: event.target.value }))
                  }
                />
              </FormField>
            </div>
            <button className="primary-button" disabled={isBusy === "register"} type="submit">
              {isBusy === "register" ? "Đang tạo..." : "Đăng ký"}
            </button>
          </form>

          <form className="card" onSubmit={handleLogin}>
            <h2>Đăng nhập</h2>
            <FormField htmlFor="login-email" label="Email">
              <input
                id="login-email"
                type="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </FormField>
            <FormField htmlFor="login-password" label="Mật khẩu">
              <input
                id="login-password"
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </FormField>
            <button className="secondary-button" disabled={isBusy === "login"} type="submit">
              {isBusy === "login" ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
