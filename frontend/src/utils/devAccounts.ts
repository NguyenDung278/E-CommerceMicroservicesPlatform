import type { UserProfile } from "../types/api";

const developmentEmailSuffix = ".dev@ndshop.local";

export function isDevelopmentAccount(user: Pick<UserProfile, "email"> | null | undefined) {
  const email = user?.email?.trim().toLowerCase() ?? "";
  return email.endsWith(developmentEmailSuffix);
}

export function formatRoleLabel(role?: string) {
  switch ((role ?? "").trim().toLowerCase()) {
    case "admin":
      return "Admin";
    case "staff":
      return "Staff";
    case "user":
      return "User";
    default:
      return "Guest";
  }
}

export function getUserDisplayName(user: Pick<UserProfile, "first_name" | "last_name"> | null | undefined) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return fullName || user?.first_name || "Người dùng";
}

export function getUserInitial(user: Pick<UserProfile, "first_name" | "last_name"> | null | undefined) {
  const source = getUserDisplayName(user);
  return source.charAt(0).toUpperCase() || "U";
}
