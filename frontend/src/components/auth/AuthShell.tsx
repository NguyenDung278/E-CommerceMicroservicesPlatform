import type { ReactNode } from "react";
import "./auth-shell.css";

type AuthStat = {
  value: string;
  label: string;
};

type AuthHighlight = {
  title: string;
  description: string;
};

type AuthShellProps = {
  mode: "login" | "register";
  badge: string;
  title: string;
  description: string;
  panelLabel: string;
  panelTitle: string;
  panelDescription: string;
  stats: AuthStat[];
  highlights: AuthHighlight[];
  children: ReactNode;
};

export function AuthShell({
  mode,
  badge,
  title,
  description,
  panelLabel,
  panelTitle,
  panelDescription,
  stats,
  highlights,
  children
}: AuthShellProps) {
  const featuredHighlight = highlights[0];
  const supportingHighlights = highlights.slice(1);

  return (
    <section className={`auth-shell auth-shell-${mode}`}>
      <div className="auth-shell-grid">
        <aside className="auth-story-card">
          <div className="auth-story-overlay" />

          <div className="auth-story-content">
            <div className="auth-brand-mark">ND Shop</div>

            <div className="auth-story-head">
              <span className="section-kicker auth-story-kicker">{badge}</span>
              <h1>{title}</h1>
              <p className="auth-story-copy">{description}</p>
            </div>

            <div className="auth-story-grid">
              {stats.map((stat) => (
                <div className="auth-story-stat" key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>

            {supportingHighlights.length > 0 ? (
              <div className="auth-highlight-list">
                {supportingHighlights.map((highlight, index) => (
                  <article className="auth-highlight-item" key={`${highlight.title}-${index}`}>
                    <span className="auth-highlight-mark" aria-hidden="true" />
                    <div>
                      <strong>{highlight.title}</strong>
                      <p>{highlight.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>

          <div className="auth-story-note">
            <span>{panelLabel}</span>
            <strong>{featuredHighlight?.title || panelTitle}</strong>
            <p>{featuredHighlight?.description || panelDescription}</p>
          </div>
        </aside>

        <article className="auth-form-surface">
          <div className="auth-form-inner">
            <div className="auth-form-header">
              <span className={`auth-panel-pill auth-panel-pill-${mode}`}>{panelLabel}</span>
              <h2>{panelTitle}</h2>
              <p>{panelDescription}</p>
            </div>

            {children}
          </div>
        </article>
      </div>
    </section>
  );
}
