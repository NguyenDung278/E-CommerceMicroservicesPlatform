import type { AccountSidebarItem } from "../components/AccountSidebar";

export const accountNavigationItems: AccountSidebarItem[] = [
  { id: "personal-info", label: "Personal Info", to: "/profile", icon: "person", end: true },
  { id: "orders", label: "My Orders", to: "/myorders", icon: "orders" },
  { id: "addresses", label: "Addresses", to: "/addresses", icon: "pin" },
  { id: "payments", label: "Payments", to: "/payments", icon: "payments" },
  { id: "security", label: "Security", to: "/security", icon: "security" },
  { id: "notifications", label: "Notifications", to: "/notifications", icon: "notifications" },
];
