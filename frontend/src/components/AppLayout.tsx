import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { isDevelopmentAccount } from "../utils/devAccounts";
import "./app-layout.css";

export function AppLayout() {
  const location = useLocation();
  const { isAuthenticated, canAccessAdmin, logout, user } = useAuth();
  const { itemCount } = useCart();
  const categoryNavigation = [
    { label: "Men", category: "Shop Men" },
    { label: "Women", category: "Shop Women" },
    { label: "Footwear", category: "Footwear" },
    { label: "Accessories", category: "Accessories" }
  ];
  const accountHref = isAuthenticated ? "/profile" : "/login";
  const accountLabel = isAuthenticated ? "Account" : "Login";
  const showDevBadge = isAuthenticated && isDevelopmentAccount(user);
  const currentCategory =
    location.pathname.startsWith("/categories/") ? decodeURIComponent(location.pathname.replace("/categories/", "")) : "";

  return (
    <div className="editorial-app-shell">
      <header className="editorial-site-header">
        <div className="editorial-header-inner">
          <div className="editorial-header-left">
            <NavLink className="editorial-brand-mark" to="/">
              ND Shop
            </NavLink>

            <nav className="editorial-main-nav" aria-label="Main navigation">
              {categoryNavigation.map((item, index) => {
                const isActive = currentCategory === item.category || (location.pathname === "/" && index === 0);

                return (
                  <Link
                    className={isActive ? "editorial-nav-link editorial-nav-link-active" : "editorial-nav-link"}
                    key={item.category}
                    to={`/categories/${encodeURIComponent(item.category)}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="editorial-header-actions">
            <div className="editorial-account-area">
              {canAccessAdmin ? (
                <NavLink
                  className={({ isActive }) =>
                    isActive ? "editorial-utility-link editorial-utility-link-active" : "editorial-utility-link"
                  }
                  to="/admin"
                >
                  Admin
                </NavLink>
              ) : null}
              {isAuthenticated ? (
                <button className="editorial-utility-link" type="button" onClick={logout}>
                  Logout
                </button>
              ) : null}
              <NavLink className="editorial-account-pill" to={accountHref}>
                <span>{accountLabel}</span>
                {showDevBadge ? <span className="editorial-account-badge">Dev Only</span> : null}
              </NavLink>
              <NavLink className="editorial-bag-link" to="/cart">
                <span className="editorial-bag-icon" aria-hidden="true" />
                <span className="editorial-bag-count">{itemCount}</span>
              </NavLink>
            </div>
          </div>
        </div>
      </header>

      <main className="editorial-page-frame">
        <Outlet />
      </main>

      <footer className="editorial-site-footer">
        <div className="editorial-footer-inner">
          <div className="editorial-footer-brand">
            <strong>ND Shop</strong>
            <p>2026 ND Shop. Editorial storefront layered on the current Go commerce platform.</p>
          </div>
          <div className="editorial-footer-links">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/products">Archive</NavLink>
            <NavLink to="/cart">Bag</NavLink>
            <NavLink to={accountHref}>{accountLabel}</NavLink>
            {canAccessAdmin ? <NavLink to="/admin">Admin</NavLink> : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
