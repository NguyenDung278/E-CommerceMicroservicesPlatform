import { Link, NavLink } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCart } from "@/features/cart/hooks/use-cart";
import {
  storefrontBrandHref,
  storefrontCartHref,
  storefrontFallbackNavigation,
} from "@/constants/storefront-navigation";
import { getUserDisplayName } from "@/utils/dev-accounts";
import "./storefront-overlay-header.css";

type StorefrontOverlayHeaderProps = {
  tone?: "dark" | "light";
};

export function StorefrontOverlayHeader({ tone = "dark" }: StorefrontOverlayHeaderProps) {
  const { isAuthenticated, user } = useAuth();
  const { itemCount } = useCart();
  const accountHref = isAuthenticated ? "/profile" : "/login";
  const hasProfileName = Boolean(user?.first_name?.trim() || user?.last_name?.trim());
  const profileName = hasProfileName ? getUserDisplayName(user) : "";
  const accountLabel = isAuthenticated ? profileName || "Account" : "Login";
  const bagHref = isAuthenticated ? storefrontCartHref : "/login";
  const bagState = isAuthenticated
    ? undefined
    : {
        from: {
          pathname: storefrontCartHref,
          search: "",
          hash: "",
        },
      };
  const headerClassName =
    tone === "light"
      ? "storefront-overlay-header storefront-overlay-header-light"
      : "storefront-overlay-header";

  return (
    <header className={headerClassName}>
      <Link className="storefront-overlay-brand" to={storefrontBrandHref}>
        ND Shop
      </Link>

      <nav className="storefront-overlay-nav" aria-label="Storefront navigation">
        {storefrontFallbackNavigation.map((item) => (
          <NavLink
            className={({ isActive }) =>
              isActive
                ? "storefront-overlay-link storefront-overlay-link-active"
                : "storefront-overlay-link"
            }
            end={item.to === storefrontBrandHref}
            key={item.label}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="storefront-overlay-actions">
        <Link
          aria-label="Cart"
          className="storefront-overlay-bag-link"
          state={bagState}
          to={bagHref}
        >
          <span className="storefront-overlay-bag-icon" aria-hidden="true" />
          <span className="storefront-overlay-bag-count">{itemCount}</span>
        </Link>
        <NavLink className="storefront-overlay-account-pill" to={accountHref}>
          {isAuthenticated && profileName ? (
            <span className="storefront-overlay-account-copy">
              <span className="storefront-overlay-account-name">{accountLabel}</span>
              <span className="storefront-overlay-account-role">Account</span>
            </span>
          ) : (
            accountLabel
          )}
        </NavLink>
      </div>
    </header>
  );
}
