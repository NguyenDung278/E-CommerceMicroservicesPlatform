import { NavLink } from "react-router-dom";

import type { AdminNavItem } from "./admin-console-types";

type AdminConsoleSidebarProps = {
  adminNavItems: AdminNavItem[];
  currentRoleLabel: string;
  isDevelopmentOperator: boolean;
  snapshotLabel: string;
};

export function AdminConsoleSidebar({
  adminNavItems,
  currentRoleLabel,
  isDevelopmentOperator,
  snapshotLabel,
}: AdminConsoleSidebarProps) {
  const groupNames = Array.from(new Set(adminNavItems.map((item) => item.group)));

  return (
    <aside className="admin-console-sidebar">
      <div className="admin-console-sidebar-brand">
        <span className="admin-console-sidebar-mark">ND Admin</span>
        <p>Catalog, orders, payments, returns và analytics cho toàn bộ nền tảng.</p>
      </div>

      <div className="admin-console-sidebar-groups">
        {groupNames.map((groupName) => (
          <div className="admin-console-sidebar-group" key={groupName}>
            <p className="admin-console-sidebar-label">{groupName}</p>
            <div className="admin-console-sidebar-links">
              {adminNavItems
                .filter((item) => item.group === groupName)
                .map((item) => (
                  <NavLink
                    className={({ isActive }) =>
                      isActive
                        ? "admin-console-sidebar-link admin-console-sidebar-link-active"
                        : "admin-console-sidebar-link"
                    }
                    end={item.href === "/admin"}
                    key={item.id}
                    to={item.href}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.helper}</span>
                  </NavLink>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="admin-console-health-card">
        <span className="admin-console-health-label">Operations Snapshot</span>
        <strong>{snapshotLabel}</strong>
        <div className="admin-console-health-track" aria-hidden="true">
          <span className="admin-console-health-fill" />
        </div>
        <p>
          Quyền hiện tại: <strong>{currentRoleLabel}</strong>
          {isDevelopmentOperator ? " • Preview workspace" : ""}
        </p>
      </div>
    </aside>
  );
}
