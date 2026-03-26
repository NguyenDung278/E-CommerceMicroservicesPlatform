import type { ReactNode } from "react";

import { useAuth } from "../../hooks/useAuth";
import { AccountSidebar } from "./AccountSidebar";
import { ACCOUNT_NAV_ITEMS } from "./accountConfig";
import "./AccountPageFrame.css";

type AccountPageFrameProps = {
  children: ReactNode;
};

export function AccountPageFrame({ children }: AccountPageFrameProps) {
  const { logout } = useAuth();

  return (
    <div className="page-stack account-page">
      <section className="account-shell">
        <div className="account-layout">
          <AccountSidebar items={ACCOUNT_NAV_ITEMS} onLogout={logout} />
          <div className="account-content">{children}</div>
        </div>
      </section>
    </div>
  );
}
