import { Outlet } from "react-router-dom";
import { Header } from "./header";
import { SiteFooter } from "./site-footer";

export function AppShell() {
  return (
    <div className="app-shell">
      <Header />
      <main className="main-shell">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
