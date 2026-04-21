import type { AdminNavItem } from "./admin-console-types";

type AdminConsoleSidebarProps = {
  adminNavItems: AdminNavItem[];
  currentRoleLabel: string;
  isDevelopmentOperator: boolean;
  snapshotLabel: string;
  onNavigate: (sectionId: string) => void;
};

export function AdminConsoleSidebar({
  adminNavItems,
  currentRoleLabel,
  isDevelopmentOperator,
  snapshotLabel,
  onNavigate,
}: AdminConsoleSidebarProps) {
  const groupNames = Array.from(new Set(adminNavItems.map((item) => item.group)));

  return (
    <aside className="admin-console-sidebar">
      <div className="admin-console-sidebar-brand">
        <span className="admin-console-sidebar-mark">ND Admin</span>
      </div>

      <div className="admin-console-sidebar-groups">
        {groupNames.map((groupName) => (
          <div className="admin-console-sidebar-group" key={groupName}>
            <p className="admin-console-sidebar-label">{groupName}</p>
            <div className="admin-console-sidebar-links">
              {adminNavItems
                .filter((item) => item.group === groupName)
                .map((item) => (
                  <button
                    className="admin-console-sidebar-link"
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.helper}</span>
                  </button>
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
          Current access: <strong>{currentRoleLabel}</strong>
          {isDevelopmentOperator ? " • Preview workspace" : ""}
        </p>
      </div>
    </aside>
  );
}
