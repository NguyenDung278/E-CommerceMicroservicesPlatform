import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listOrders } from "../services/order-service";
import { useAuth } from "../state/auth-context";
import type { Order } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

export function AccountPage() {
  const { token, user, loading, login, register, logout } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      if (!token) {
        setOrders([]);
        return;
      }

      const data = await listOrders(token).catch(() => []);
      if (active) {
        setOrders(data);
      }
    }

    void loadOrders();

    return () => {
      active = false;
    };
  }, [token]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      await login(email, password);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      await register({
        email,
        phone: phone.trim() || undefined,
        password,
        first_name: firstName,
        last_name: lastName,
      });
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="surface-section">
        <p>Đang tải tài khoản...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="account-layout">
        <section className="surface-section account-panel">
          <span className="eyebrow">Account</span>
          <h1>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h1>
          <form className="auth-form" onSubmit={mode === "login" ? handleLogin : handleRegister}>
            {mode === "register" ? (
              <div className="form-grid">
                <label>
                  Tên
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Họ
                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </label>
              </div>
            ) : null}
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            {mode === "register" ? (
              <label>
                Số điện thoại
                <input value={phone} onChange={(event) => setPhone(event.target.value)} />
              </label>
            ) : null}
            <label>
              Mật khẩu
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {error ? <p className="inline-error">{error}</p> : null}
            <button className="button button--primary" type="submit" disabled={submitting}>
              {submitting ? "Đang xử lý" : mode === "login" ? "Đăng nhập" : "Đăng ký"}
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
            >
              {mode === "login" ? "Tạo tài khoản mới" : "Tôi đã có tài khoản"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="surface-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Account</span>
            <h1>{user.first_name || user.email}</h1>
            <p>{user.email}</p>
          </div>
          <button className="button button--ghost" type="button" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </section>

      <section className="surface-section" id="orders">
        <div className="section-heading">
          <h2>Đơn hàng</h2>
          <Link to="/products">Mua thêm</Link>
        </div>
        {orders.length === 0 ? (
          <p>Chưa có đơn hàng.</p>
        ) : (
          <div className="order-list">
            {orders.map((order) => (
              <article key={order.id} className="order-card">
                <div>
                  <strong>{order.id}</strong>
                  <p>{formatDate(order.created_at)}</p>
                </div>
                <span>{order.status}</span>
                <strong>{formatCurrency(order.total_price)}</strong>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
