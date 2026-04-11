import type { ReactNode } from "react";

import "./storefront-filter-section.css";

type StorefrontFilterSectionProps = {
  title: string;
  summary: string;
  expanded: boolean;
  className?: string;
  children: ReactNode;
  onToggle: () => void;
};

export function StorefrontFilterSection({
  title,
  summary,
  expanded,
  className,
  children,
  onToggle,
}: StorefrontFilterSectionProps) {
  return (
    <section className={className ? `storefront-filter-section ${className}` : "storefront-filter-section"}>
      <button
        aria-expanded={expanded}
        className="storefront-filter-section-toggle"
        type="button"
        onClick={onToggle}
      >
        <span className="storefront-filter-section-toggle-copy">
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        <span aria-hidden="true" className="storefront-filter-section-toggle-icon">
          {expanded ? "-" : "+"}
        </span>
      </button>

      {expanded ? <div className="storefront-filter-section-body">{children}</div> : null}
    </section>
  );
}
