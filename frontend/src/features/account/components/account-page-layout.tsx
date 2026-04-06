import type { ReactNode } from "react";

import { useAuth } from "../../auth/hooks/use-auth";
import { accountNavigationItems } from "../constants/account-navigation";
import { AccountSidebar } from "./account-sidebar";
import "./account-page-layout.css";

type AccountPageLayoutProps = {
  children: ReactNode;
};

export function AccountPageLayout({ children }: AccountPageLayoutProps) {
  const { logout } = useAuth();

  return (
    <div className="page-stack account-page">
      <section className="account-shell">
        <div className="account-layout">
          <AccountSidebar items={accountNavigationItems} onLogout={logout} />
          <div className="account-content">{children}</div>
        </div>
      </section>
    </div>
  );
}
