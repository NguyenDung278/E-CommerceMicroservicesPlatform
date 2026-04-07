const AUTH_FLOW_LOG_STORAGE_KEY = "ecommerce_frontend_auth_flow_logs";
const MAX_AUTH_FLOW_LOG_ENTRIES = 200;

export type AuthFlowLogEntry = {
  timestamp: string;
  event: string;
  details: Record<string, unknown>;
};

export function appendAuthFlowLog(
  event: string,
  details: Record<string, unknown> = {}
): AuthFlowLogEntry | null {
  const entry: AuthFlowLogEntry = {
    timestamp: new Date().toISOString(),
    event: event.trim(),
    details,
  };

  if (typeof window === "undefined") {
    return entry;
  }

  const nextEntries = [...readAuthFlowLogs(), entry].slice(-MAX_AUTH_FLOW_LOG_ENTRIES);
  window.sessionStorage.setItem(AUTH_FLOW_LOG_STORAGE_KEY, JSON.stringify(nextEntries));
  console.info("[ND Shop auth flow]", entry);
  return entry;
}

export function readAuthFlowLogs(): AuthFlowLogEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.sessionStorage.getItem(AUTH_FLOW_LOG_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      clearAuthFlowLogs();
      return [];
    }

    return parsed.filter(isAuthFlowLogEntry);
  } catch {
    clearAuthFlowLogs();
    return [];
  }
}

export function clearAuthFlowLogs(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(AUTH_FLOW_LOG_STORAGE_KEY);
}

function isAuthFlowLogEntry(value: unknown): value is AuthFlowLogEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybeEntry = value as Partial<AuthFlowLogEntry>;
  return (
    typeof maybeEntry.timestamp === "string" &&
    typeof maybeEntry.event === "string" &&
    typeof maybeEntry.details === "object" &&
    maybeEntry.details !== null
  );
}
