import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { isExternalRouteHref, prefetchRouteIntent } from "@/app/router/route-prefetch";

type StorefrontActionLinkProps = {
  href: string;
  className?: string;
  fallbackHref?: string;
  children: ReactNode;
};

export function StorefrontActionLink({
  href,
  className,
  fallbackHref,
  children,
}: StorefrontActionLinkProps) {
  const resolvedHref = href.trim() || fallbackHref || "/";
  const handlePrefetch = () => {
    void prefetchRouteIntent(resolvedHref);
  };

  if (isExternalRouteHref(resolvedHref)) {
    return (
      <a className={className} href={resolvedHref} rel="noreferrer" target="_blank">
        {children}
      </a>
    );
  }

  return (
    <Link
      className={className}
      onFocus={handlePrefetch}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
      to={resolvedHref}
    >
      {children}
    </Link>
  );
}
