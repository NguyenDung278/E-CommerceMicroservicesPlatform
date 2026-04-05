import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../features/auth/hooks/useAuth";
import { useCart } from "../../features/cart/hooks/useCart";
import { api } from "../../shared/api";
import {
  mergeWithStorefrontNavigation,
  normalizeStorefrontNavigationToken,
  storefrontArchiveHref,
  storefrontBrandHref,
  storefrontCartHref,
  storefrontFallbackNavigation,
  type StorefrontNavigationItem,
} from "../../shared/navigation/storefront";
import type { StorefrontCategory } from "../../shared/types/api";
import { getUserDisplayName, isDevelopmentAccount } from "../../shared/utils/devAccounts";
import "./AppLayout.css";

type NavigationItem = StorefrontNavigationItem;

function isVisibleNavigationValue(value: string) {
  return !value.trim().toLowerCase().includes("smoke");
}

const fallbackCategoryNavigation: NavigationItem[] = storefrontFallbackNavigation;

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

function buildNavigationItem(category: StorefrontCategory): NavigationItem {
  const identifier =
    category.aliases[0] || category.display_name || category.slug;

  return {
    label: category.nav_label || category.display_name || identifier,
    identifier,
    aliases: [
      category.slug,
      category.display_name,
      category.nav_label,
      ...category.aliases,
    ]
      .map((item) => item.trim())
      .filter(Boolean),
    to: `/categories/${encodeURIComponent(identifier)}`,
  };
}

export function AppLayout() {
  const location = useLocation();
  const { isAuthenticated, canAccessAdmin, logout, user } = useAuth();
  const { itemCount } = useCart();
  const [categoryNavigation, setCategoryNavigation] = useState<NavigationItem[]>(
    fallbackCategoryNavigation
  );
  const isTransactionalSurface = location.pathname === "/checkout" || location.pathname.startsWith("/orders/");
  const isAccountSurface = ["/profile", "/myorders", "/addresses", "/payments", "/security", "/notifications"].some(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  );
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
  const currentCategory =
    location.pathname.startsWith("/categories/") ? decodeURIComponent(location.pathname.replace("/categories/", "")) : "";
  const normalizedCurrentCategory = normalizeStorefrontNavigationToken(currentCategory);
  const isAtelierCategorySurface =
    location.pathname.startsWith("/categories/") &&
    atelierCategoryTokens.has(normalizedCurrentCategory);
  const isChromelessEditorialSurface = isHomeSurface || isAtelierCategorySurface;

  useEffect(() => {
    let active = true;

    void api
      .listStorefrontCategories()
      .then((response) => {
        if (!active || response.data.length === 0) {
          return;
        }

        const mappedCategories = response.data
          .filter((category) =>
            [category.slug, category.display_name, category.nav_label, ...category.aliases]
              .filter(Boolean)
              .every((value) => isVisibleNavigationValue(value))
          )
          .map((category) => buildNavigationItem(category));

        setCategoryNavigation(mergeWithStorefrontNavigation(mappedCategories));
      })
      .catch(() => {
        if (active) {
          setCategoryNavigation(fallbackCategoryNavigation);
        }
      });

    return () => {
      active = false;
    };
  }, []);

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
      {isChromelessEditorialSurface ? null : (
        <header className={headerClassName}>
          <div className="editorial-header-inner">
            <div className="editorial-header-brand-slot">
              <NavLink
                className={isTransactionalSurface ? "editorial-brand-mark editorial-brand-mark-transactional" : "editorial-brand-mark"}
                to={storefrontBrandHref}
              >
                ND Shop
              </NavLink>
            </div>

            <nav className="editorial-main-nav" aria-label="Main navigation">
              {isTransactionalSurface
                ? transactionalNavigation.map((item) => (
                    <Link className="editorial-nav-link editorial-nav-link-transactional" key={item.label} to={item.to}>
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
                        className={isActive ? "editorial-nav-link editorial-nav-link-active" : "editorial-nav-link"}
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
                  <NavLink aria-label="Cart" className="editorial-bag-link" state={cartState} to={cartHref}>
                    <span className="editorial-bag-icon" aria-hidden="true" />
                    <span className="editorial-bag-count">{itemCount}</span>
                  </NavLink>
                  <NavLink aria-label={accountLabel} className="editorial-person-link" to={accountHref}>
                    <span className="editorial-person-icon" aria-hidden="true" />
                  </NavLink>
                </div>
              ) : isAccountSurface && isAuthenticated ? (
                <div className="editorial-account-area editorial-account-area-profile">
                  <NavLink className="editorial-profile-pill" to="/profile">
                    <span>{profileDisplayName}</span>
                    <span className="editorial-profile-pill-dot" aria-hidden="true" />
                  </NavLink>
                  <NavLink aria-label="Cart" className="editorial-bag-link" state={cartState} to={cartHref}>
                    <span className="editorial-bag-icon" aria-hidden="true" />
                    <span className="editorial-bag-count">{itemCount}</span>
                  </NavLink>
                  <NavLink aria-label={accountLabel} className="editorial-account-circle-link editorial-account-circle-link-active" to={accountHref}>
                    <span className="editorial-account-circle-icon" aria-hidden="true" />
                  </NavLink>
                </div>
              ) : (
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
          <div className="editorial-footer-inner">
            <div className="editorial-footer-brand">
              <strong>ND Shop</strong>
              <p>
                {isTransactionalSurface
                  ? "2026 ND Shop. All rights reserved."
                  : "2026 ND Shop. Editorial storefront layered on the current Go commerce platform."}
              </p>
            </div>
            <div className="editorial-footer-links">
              {isTransactionalSurface ? (
                <>
                  {transactionalNavigation.map((item) => (
                    <NavLink key={item.label} to={item.to}>
                      {item.label}
                    </NavLink>
                  ))}
                </>
              ) : (
                <>
                  <NavLink to="/">Home</NavLink>
                  <NavLink to={storefrontArchiveHref}>Archive</NavLink>
                  <NavLink to="/cart">Bag</NavLink>
                  <NavLink to={accountHref}>{accountLabel}</NavLink>
                  {canAccessAdmin ? <NavLink to="/admin">Admin</NavLink> : null}
                </>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
