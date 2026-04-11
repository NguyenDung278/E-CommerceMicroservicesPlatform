import type { ReactNode } from "react";

import { StorefrontActionLink } from "./storefront-action-link";
import "./storefront-collection-card.css";

type StorefrontCollectionCardProps = {
  href: string;
  className?: string;
  imageSrc?: string;
  imageAlt: string;
  badge?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  priceLabel?: string;
  fallbackLabel?: string;
  footer?: ReactNode;
};

export function StorefrontCollectionCard({
  href,
  className,
  imageSrc,
  imageAlt,
  badge,
  eyebrow,
  title,
  description,
  priceLabel,
  fallbackLabel,
  footer,
}: StorefrontCollectionCardProps) {
  return (
    <StorefrontActionLink
      className={className ? `storefront-collection-card ${className}` : "storefront-collection-card"}
      href={href}
    >
      <div className="storefront-collection-card-media">
        {imageSrc ? (
          <img alt={imageAlt} src={imageSrc} />
        ) : (
          <div className="storefront-collection-card-fallback">
            {(fallbackLabel || title).slice(0, 1).toUpperCase()}
          </div>
        )}

        {badge ? <span className="storefront-collection-card-badge">{badge}</span> : null}
      </div>

      <div className="storefront-collection-card-copy">
        {eyebrow ? <span className="storefront-collection-card-eyebrow">{eyebrow}</span> : null}

        <div className="storefront-collection-card-head">
          <strong>{title}</strong>
          {priceLabel ? <em>{priceLabel}</em> : null}
        </div>

        {description ? <p>{description}</p> : null}

        {footer ? <div className="storefront-collection-card-footer">{footer}</div> : null}
      </div>
    </StorefrontActionLink>
  );
}
