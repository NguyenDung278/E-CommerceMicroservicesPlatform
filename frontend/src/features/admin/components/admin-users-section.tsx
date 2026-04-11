import { formatRoleLabel, isDevelopmentAccount } from "@/utils/dev-accounts";
import type { UserProfile } from "@/types/api";

type AdminUsersSectionProps = {
  busyUserId: string;
  isLoadingUsers: boolean;
  users: UserProfile[];
  onRoleChange: (userId: string, role: string) => void;
};

export function AdminUsersSection({
  busyUserId,
  isLoadingUsers,
  users,
  onRoleChange,
}: AdminUsersSectionProps) {
  return (
    <section className="admin-console-panel admin-user-card" id="admin-user-governance">
      <div className="section-heading">
        <div>
          <h2>Phân quyền người dùng</h2>
          <p className="history-subtle">
            Review access levels and promote trusted operators when your team expands.
          </p>
        </div>
      </div>

      {isLoadingUsers ? <div className="page-state">Đang tải danh sách người dùng...</div> : null}

      <div className="history-grid">
        {users.map((adminUser) => (
          <article className="history-card admin-console-record" key={adminUser.id}>
            <div className="history-card-head">
              <div className="admin-console-user-block">
                <div className="admin-console-user-head">
                  <strong>{adminUser.email}</strong>
                  {isDevelopmentAccount(adminUser) ? (
                    <span className="account-flag">PREVIEW</span>
                  ) : null}
                </div>
                <p className="history-subtle">
                  {adminUser.first_name} {adminUser.last_name}
                  {adminUser.phone ? ` • ${adminUser.phone}` : ""}
                </p>
              </div>
              <span
                className={
                  adminUser.email_verified
                    ? "status-pill status-pill-success"
                    : "status-pill status-pill-neutral"
                }
              >
                {adminUser.email_verified ? "Email đã xác minh" : "Email chưa xác minh"}
              </span>
            </div>

            <div className="history-meta-grid">
              <div>
                <span>Vai trò hiện tại</span>
                <strong>{formatRoleLabel(adminUser.role)}</strong>
              </div>
              <div>
                <span>Cập nhật quyền</span>
                <select
                  disabled={busyUserId === adminUser.id}
                  value={adminUser.role}
                  onChange={(event) => onRoleChange(adminUser.id, event.target.value)}
                >
                  <option value="user">user</option>
                  <option value="staff">staff</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
          </article>
        ))}

        {!isLoadingUsers && users.length === 0 ? (
          <p className="history-empty">Chưa có người dùng nào để phân quyền.</p>
        ) : null}
      </div>
    </section>
  );
}
