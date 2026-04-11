import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type StorefrontActionLinkProps = {
  href: string;
  className?: string;
  fallbackHref?: string;
  children: ReactNode;
};

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export function StorefrontActionLink({
  href,
  className,
  fallbackHref,
  children,
}: StorefrontActionLinkProps) {
  const resolvedHref = href.trim() || fallbackHref || "/";

  if (isExternalHref(resolvedHref)) {
    return (
      <a className={className} href={resolvedHref} rel="noreferrer" target="_blank">
        {children}
      </a>
    );
  }

  return (
    <Link className={className} to={resolvedHref}>
      {children}
    </Link>
  );
}
