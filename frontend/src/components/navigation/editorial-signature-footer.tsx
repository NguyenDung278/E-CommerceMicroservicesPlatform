import { Link } from "react-router-dom";

import "./editorial-signature-footer.css";

export type EditorialSignatureFooterLink = {
  position?: number;
  label: string;
  href: string;
};

const defaultFooterLinks: EditorialSignatureFooterLink[] = [
  {
    position: 1,
    label: "Sustainability",
    href: "/products",
  },
  {
    position: 2,
    label: "Atelier Services",
    href: "/products",
  },
  {
    position: 3,
    label: "Privacy",
    href: "/products",
  },
  {
    position: 4,
    label: "Terms",
    href: "/products",
  },
];

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function normalizeFooterLinks(links?: EditorialSignatureFooterLink[]) {
  const sourceLinks = links?.filter((link) => link.label.trim() && link.href.trim()) ?? [];
  const resolvedLinks = sourceLinks.length > 0 ? sourceLinks : defaultFooterLinks;

  return resolvedLinks
    .slice()
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
}

export function EditorialSignatureFooter({
  variant = "page",
  brandName = "ND Shop",
  caption = "Crafted for the Discerning",
  note = "An editorial storefront shaped for clear browsing, product discovery, and quick returns.",
  links,
}: {
  variant?: "page" | "layout";
  brandName?: string;
  caption?: string;
  note?: string;
  links?: EditorialSignatureFooterLink[];
}) {
  const footerLinks = normalizeFooterLinks(links);
  const footerClassName =
    variant === "layout"
      ? "editorial-signature-footer editorial-signature-footer-layout"
      : "editorial-signature-footer editorial-signature-footer-page";

  return (
    <div className={footerClassName}>
      <div className="editorial-signature-footer-brand">
        <strong>{brandName}</strong>
        <p>{caption}</p>
      </div>

      <nav aria-label="Footer" className="editorial-signature-footer-links">
        {footerLinks.map((link) =>
          isExternalHref(link.href) ? (
            <a
              className="editorial-signature-footer-link"
              href={link.href}
              key={`${link.position ?? 0}-${link.label}`}
              rel="noreferrer"
              target="_blank"
            >
              {link.label}
            </a>
          ) : (
            <Link
              className="editorial-signature-footer-link"
              key={`${link.position ?? 0}-${link.label}`}
              to={link.href}
            >
              {link.label}
            </Link>
          )
        )}
      </nav>

      <p className="editorial-signature-footer-note">{note}</p>
    </div>
  );
}
