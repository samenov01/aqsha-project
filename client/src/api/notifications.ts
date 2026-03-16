import type { Notification } from "../types";
import { apiRequest } from "./client";

export function getNotifications(token: string) {
  return apiRequest<Notification[]>("/api/notifications", { token });
}

export function getUnreadCount(token: string) {
  return apiRequest<{ count: number }>("/api/notifications/unread-count", { token });
}

export function markNotificationRead(id: number | string, token: string) {
  return apiRequest<{ ok: boolean }>(`/api/notifications/${id}/read`, {
    method: "PATCH",
    token,
  });
}

export function markAllNotificationsRead(token: string) {
  return apiRequest<{ ok: boolean }>("/api/notifications/read-all", {
    method: "PATCH",
    token,
  });
}
