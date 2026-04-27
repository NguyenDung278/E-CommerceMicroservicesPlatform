import { Outlet } from "react-router-dom";
import { Header } from "./header";

export function AppShell() {
  return (
    <div className="app-shell">
      <Header />
      <main className="main-shell">
        <Outlet />
      </main>
    </div>
  );
}
