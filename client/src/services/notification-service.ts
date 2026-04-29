import { request } from "./http";
import { buildQuery } from "../utils/query";
import type { MarkNotificationReadResult, NotificationInboxItem } from "../types/api";

export async function listNotifications(
  token: string,
  limit = 20,
): Promise<NotificationInboxItem[]> {
  const response = await request<NotificationInboxItem[]>(
    `/api/v1/notifications/inbox${buildQuery({ limit })}`,
    { token },
  );
  return Array.isArray(response.data) ? response.data : [];
}

export async function markAllNotificationsRead(
  token: string,
): Promise<MarkNotificationReadResult> {
  const response = await request<MarkNotificationReadResult>("/api/v1/notifications/inbox/read", {
    method: "PUT",
    token,
    body: { mark_all: true },
  });
  return response.data;
}
