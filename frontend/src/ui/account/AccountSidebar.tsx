import { NavLink } from "react-router-dom";

import "./AccountSidebar.css";

export type AccountSidebarIconName =
  | "person"
  | "orders"
  | "pin"
  | "payments"
  | "security"
  | "notifications";

export type AccountSidebarItem = {
  id: string;
  label: string;
  to: string;
  icon: AccountSidebarIconName;
  end?: boolean;
};

type AccountSidebarProps = {
  items: AccountSidebarItem[];
  onLogout: () => void;
  title?: string;
  subtitle?: string;
};

export function AccountSidebar({
  items,
  onLogout,
  title = "My Account",
  subtitle = "Manage your preferences"
}: AccountSidebarProps) {
  return (
    <aside className="account-sidebar">
      <div className="account-sidebar-panel">
        <div className="account-sidebar-head">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        <nav className="account-sidebar-nav" aria-label="Account navigation">
          {items.map((item) => (
            <NavLink
              className={({ isActive }) =>
                isActive ? "account-sidebar-link account-sidebar-link-active" : "account-sidebar-link"
              }
              end={item.end}
              key={item.id}
              to={item.to}
            >
              <span className="account-sidebar-icon" aria-hidden="true">
                <AccountSidebarIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="account-sidebar-footer">
          <button className="account-sidebar-logout" type="button" onClick={onLogout}>
            <span className="account-sidebar-icon" aria-hidden="true">
              <LogoutIcon />
            </span>
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function AccountSidebarIcon({ name }: { name: AccountSidebarIconName }) {
  switch (name) {
    case "person":
      return (
        <svg fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="8.2" r="3.1" />
          <path d="M5.8 18.7c1.45-2.9 3.85-4.45 6.2-4.45s4.75 1.55 6.2 4.45" />
        </svg>
      );
    case "orders":
      return (
        <svg fill="none" viewBox="0 0 24 24">
          <path d="M8.1 7.8h7.8v10.1H8.1z" />
          <path d="M9.7 7.8V6.6c0-1.28 1.02-2.3 2.3-2.3s2.3 1.02 2.3 2.3v1.2" />
          <path d="M10.2 11.6h3.6" />
          <path d="M10.2 14.6h3.6" />
        </svg>
      );
    case "pin":
      return (
        <svg fill="none" viewBox="0 0 24 24">
          <path d="M12 19.55s4.7-4.92 4.7-8.65a4.7 4.7 0 1 0-9.4 0c0 3.73 4.7 8.65 4.7 8.65Z" />
          <circle cx="12" cy="10.95" r="1.55" />
        </svg>
      );
    case "payments":
      return (
        <svg fill="none" viewBox="0 0 24 24">
          <rect height="10.8" rx="2.3" width="15.5" x="4.25" y="6.6" />
          <path d="M4.6 10.2h14.8" />
        </svg>
      );
    case "security":
      return (
        <svg fill="none" viewBox="0 0 24 24">
          <path d="M12 4.5 6.8 6.7v4.5c0 3.72 2.18 6.22 5.2 7.6 3.02-1.38 5.2-3.88 5.2-7.6V6.7L12 4.5Z" />
        </svg>
      );
    case "notifications":
      return (
        <svg fill="none" viewBox="0 0 24 24">
          <path d="M8.4 15.95h7.2c-.78-.73-1.12-1.84-1.12-3.32v-2.08A2.52 2.52 0 0 0 12 7.95a2.52 2.52 0 0 0-2.48 2.6v2.08c0 1.48-.34 2.59-1.12 3.32Z" />
          <path d="M10.5 18.05a1.78 1.78 0 0 0 3 0" />
        </svg>
      );
  }
}

function LogoutIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24">
      <path d="M10.2 6.3H7.7a2.2 2.2 0 0 0-2.2 2.2v7a2.2 2.2 0 0 0 2.2 2.2h2.5" />
      <path d="M12.55 8.35 16.2 12l-3.65 3.65" />
      <path d="M9.7 12h6.1" />
    </svg>
  );
}
