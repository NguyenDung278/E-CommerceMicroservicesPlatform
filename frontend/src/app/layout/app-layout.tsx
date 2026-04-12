import { useMemo } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { EditorialSignatureFooter } from "@/components";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCart } from "@/features/cart/hooks/use-cart";
import { useWishlist } from "@/features/wishlist";
import {
  normalizeStorefrontNavigationToken,
  storefrontArchiveHref,
  storefrontBrandHref,
  storefrontCartHref,
  storefrontFallbackNavigation,
  storefrontWishlistHref,
} from "@/constants/storefront-navigation";
import { getUserDisplayName, isDevelopmentAccount } from "@/utils/dev-accounts";
import "./app-layout.css";

const atelierCategoryTokens = new Set([
  "shop men",
  "shop-men",
  "men",
  "shop women",
  "shop-women",
  "women",
  "footwear",
  "accessories",
]);

export function AppLayout() {
  const location = useLocation();
  const { isAuthenticated, canAccessAdmin, logout, user } = useAuth();
  const { itemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const categoryNavigation = storefrontFallbackNavigation;
  const isTransactionalSurface =
    location.pathname === "/checkout" || location.pathname.startsWith("/orders/");
  const isAccountSurface = [
    "/profile",
    "/myorders",
    "/addresses",
    "/payments",
    "/security",
    "/notifications",
  ].some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const transactionalNavigation = useMemo(
    () =>
      categoryNavigation
        .filter((item) => item.identifier)
        .map((item) => ({
          label: item.label,
          to: item.to,
        })),
    [categoryNavigation]
  );
  const accountHref = isAuthenticated ? "/profile" : "/login";
  const accountLabel = isAuthenticated ? "Account" : "Login";
  const cartHref = isAuthenticated ? storefrontCartHref : "/login";
  const cartState = isAuthenticated
    ? undefined
    : {
        from: {
          pathname: storefrontCartHref,
          search: "",
          hash: "",
        },
      };
  const profileDisplayName = getUserDisplayName(user);
  const showDevBadge = isAuthenticated && isDevelopmentAccount(user);
  const isHomeSurface = location.pathname === "/";
  const currentCategory = location.pathname.startsWith("/categories/")
    ? decodeURIComponent(location.pathname.replace("/categories/", ""))
    : "";
  const normalizedCurrentCategory = normalizeStorefrontNavigationToken(currentCategory);
  const isAtelierCategorySurface =
    location.pathname.startsWith("/categories/") &&
    atelierCategoryTokens.has(normalizedCurrentCategory);
  const isArchiveSurface = location.pathname === storefrontArchiveHref;
  const isChromelessEditorialSurface =
    isHomeSurface || isAtelierCategorySurface || isArchiveSurface;

  const shellClassName = isTransactionalSurface
    ? "editorial-app-shell editorial-app-shell-transactional"
    : "editorial-app-shell";
  const headerClassName = isTransactionalSurface
    ? "editorial-site-header editorial-site-header-transactional"
    : "editorial-site-header";
  const footerClassName = isTransactionalSurface
    ? "editorial-site-footer editorial-site-footer-transactional"
    : "editorial-site-footer";

  return (
    <div className={shellClassName}>
      {isChromelessEditorialSurface || isAccountSurface ? null : (
        <header className={headerClassName}>
          <div className="editorial-header-inner">
            <div className="editorial-header-brand-slot">
              <NavLink
                className={
                  isTransactionalSurface
                    ? "editorial-brand-mark editorial-brand-mark-transactional"
                    : "editorial-brand-mark"
                }
                to={storefrontBrandHref}
              >
                ND Shop
              </NavLink>
            </div>

            <nav className="editorial-main-nav" aria-label="Main navigation">
              {isTransactionalSurface
                ? transactionalNavigation.map((item) => (
                    <Link
                      className="editorial-nav-link editorial-nav-link-transactional"
                      key={item.label}
                      to={item.to}
                    >
                      {item.label}
                    </Link>
                  ))
                : categoryNavigation.map((item) => {
                    const isActive = item.identifier
                      ? item.aliases.some(
                          (alias) =>
                            normalizeStorefrontNavigationToken(alias) === normalizedCurrentCategory
                        )
                      : location.pathname === storefrontArchiveHref;

                    return (
                      <Link
                        className={
                          isActive
                            ? "editorial-nav-link editorial-nav-link-active"
                            : "editorial-nav-link"
                        }
                        key={item.label}
                        to={item.to}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
            </nav>

            <div className="editorial-header-actions">
              {isTransactionalSurface ? (
                <div className="editorial-account-area editorial-account-area-transactional">
                  <NavLink
                    aria-label="Wishlist"
                    className="editorial-wishlist-link"
                    to={storefrontWishlistHref}
                  >
                    <span className="editorial-wishlist-icon" aria-hidden="true" />
                    <span className="editorial-wishlist-count">{wishlistCount}</span>
                  </NavLink>
                  <NavLink
                    aria-label="Cart"
                    className="editorial-bag-link"
                    state={cartState}
                    to={cartHref}
                  >
                    <span className="editorial-bag-icon" aria-hidden="true" />
                    <span className="editorial-bag-count">{itemCount}</span>
                  </NavLink>
                  <NavLink
                    aria-label={accountLabel}
                    className="editorial-person-link"
                    to={accountHref}
                  >
                    <span className="editorial-person-icon" aria-hidden="true" />
                  </NavLink>
                </div>
              ) : isAccountSurface && isAuthenticated ? (
                <div className="editorial-account-area editorial-account-area-profile">
                  <NavLink className="editorial-profile-pill" to="/profile">
                    <span>{profileDisplayName}</span>
                    <span className="editorial-profile-pill-dot" aria-hidden="true" />
                  </NavLink>
                  <NavLink
                    aria-label="Wishlist"
                    className="editorial-wishlist-link"
                    to={storefrontWishlistHref}
                  >
                    <span className="editorial-wishlist-icon" aria-hidden="true" />
                    <span className="editorial-wishlist-count">{wishlistCount}</span>
                  </NavLink>
                  <NavLink
                    aria-label="Cart"
                    className="editorial-bag-link"
                    state={cartState}
                    to={cartHref}
                  >
                    <span className="editorial-bag-icon" aria-hidden="true" />
                    <span className="editorial-bag-count">{itemCount}</span>
                  </NavLink>
                  <NavLink
                    aria-label={accountLabel}
                    className="editorial-account-circle-link editorial-account-circle-link-active"
                    to={accountHref}
                  >
                    <span className="editorial-account-circle-icon" aria-hidden="true" />
                  </NavLink>
                </div>
              ) : (
                <div className="editorial-account-area">
                  {canAccessAdmin ? (
                    <NavLink
                      className={({ isActive }) =>
                        isActive
                          ? "editorial-utility-link editorial-utility-link-active"
                          : "editorial-utility-link"
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
                    {showDevBadge ? (
                      <span className="editorial-account-badge">Dev Only</span>
                    ) : null}
                  </NavLink>
                  <NavLink className="editorial-wishlist-link" to={storefrontWishlistHref}>
                    <span className="editorial-wishlist-icon" aria-hidden="true" />
                    <span className="editorial-wishlist-count">{wishlistCount}</span>
                  </NavLink>
                  <NavLink className="editorial-bag-link" state={cartState} to={cartHref}>
                    <span className="editorial-bag-icon" aria-hidden="true" />
                    <span className="editorial-bag-count">{itemCount}</span>
                  </NavLink>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="editorial-page-frame">
        <Outlet />
      </main>

      {isChromelessEditorialSurface ? null : (
        <footer className={footerClassName}>
          {isTransactionalSurface ? (
            <div className="editorial-footer-inner">
              <div className="editorial-footer-brand">
                <strong>ND Shop</strong>
                <p>2026 ND Shop. All rights reserved.</p>
              </div>
              <div className="editorial-footer-links">
                {transactionalNavigation.map((item) => (
                  <NavLink key={item.label} to={item.to}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ) : isAccountSurface ? (
            <div className="editorial-signature-footer-frame">
              <EditorialSignatureFooter variant="layout" />
            </div>
          ) : (
            <div className="editorial-footer-inner">
              <div className="editorial-footer-brand">
                <strong>ND Shop</strong>
                <p>2026 ND Shop. Editorial storefront layered on the current Go commerce platform.</p>
              </div>
              <div className="editorial-footer-links">
                <NavLink to="/">Home</NavLink>
                <NavLink to={storefrontArchiveHref}>Archive</NavLink>
                <NavLink to={storefrontWishlistHref}>Wishlist</NavLink>
                <NavLink to="/cart">Bag</NavLink>
                <NavLink to={accountHref}>{accountLabel}</NavLink>
                {canAccessAdmin ? <NavLink to="/admin">Admin</NavLink> : null}
              </div>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
