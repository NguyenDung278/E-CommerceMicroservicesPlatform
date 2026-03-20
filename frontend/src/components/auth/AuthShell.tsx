import type { ReactNode } from "react";

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
  return (
    <section className={`content-section auth-shell auth-shell-${mode}`}>
      <div className="auth-shell-grid">
        <aside className="auth-story-card">
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

          <div className="auth-highlight-list">
            {highlights.map((item) => (
              <article className="auth-highlight-item" key={item.title}>
                <span className="auth-highlight-mark" aria-hidden="true" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <article className="auth-form-surface">
          <div className="auth-form-header">
            <span className={`auth-panel-pill auth-panel-pill-${mode}`}>{panelLabel}</span>
            <h2>{panelTitle}</h2>
            <p>{panelDescription}</p>
          </div>

          {children}
        </article>
      </div>
    </section>
  );
}
