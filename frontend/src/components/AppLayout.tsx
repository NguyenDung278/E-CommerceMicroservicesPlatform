import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { formatRoleLabel, getUserDisplayName, getUserInitial, isDevelopmentAccount } from "../utils/devAccounts";

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link nav-link-active" : "nav-link";
}

export function AppLayout() {
  const { isAuthenticated, canAccessAdmin, logout, user } = useAuth();
  const { itemCount } = useCart();
  const isDevelopmentUser = isDevelopmentAccount(user);
  const displayName = getUserDisplayName(user);
  const userInitial = getUserInitial(user);
  const roleLabel = formatRoleLabel(user?.role);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-block">
          <NavLink className="brand-mark" to="/">
            ND Shop
          </NavLink>
          <p className="brand-copy">Storefront demo cho hệ thống e-commerce microservices bằng Go.</p>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <NavLink className={navClassName} to="/">
            Trang chủ
          </NavLink>
          <NavLink className={navClassName} to="/products">
            Sản phẩm
          </NavLink>
          <NavLink className={navClassName} to="/cart">
            Giỏ hàng ({itemCount})
          </NavLink>
          <NavLink className={navClassName} to="/checkout">
            Đặt hàng
          </NavLink>
          {isAuthenticated ? (
            <NavLink className={navClassName} to="/profile">
              Tài khoản
            </NavLink>
          ) : (
            <NavLink className={navClassName} to="/login">
              Đăng nhập
            </NavLink>
          )}
          {isAuthenticated ? (
            <NavLink className={navClassName} to="/payments">
              Thanh toán
            </NavLink>
          ) : null}
          {canAccessAdmin ? (
            <NavLink className={navClassName} to="/admin">
              Quản trị
            </NavLink>
          ) : null}
        </nav>

        <div className="header-actions">
          {isAuthenticated ? (
            <>
              <div className="account-chip">
                <div className="account-avatar" aria-hidden="true">
                  {userInitial}
                </div>

                <div className="account-copy">
                  <div className="account-copy-head">
                    <strong>{displayName}</strong>
                    {isDevelopmentUser ? <span className="account-flag">DEV ONLY</span> : null}
                  </div>

                  <div className="account-copy-meta">
                    <span className="account-role">{roleLabel}</span>
                    {user?.email ? <span className="account-email">{user.email}</span> : null}
                  </div>
                </div>
              </div>
              <button className="ghost-button" type="button" onClick={logout}>
                Đăng xuất
              </button>
            </>
          ) : (
            <NavLink className="primary-link" to="/register">
              Bắt đầu
            </NavLink>
          )}
        </div>
      </header>

      <main className="page-frame">
        <Outlet />
      </main>

      <footer className="site-footer">
        <p>Frontend đã được gom theo page, context và API layer để dễ scale và dễ maintain.</p>
      </footer>
    </div>
  );
}
