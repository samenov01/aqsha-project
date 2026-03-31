import type { Report } from "../types";
import { apiRequest } from "./client";

export function createReport(
  targetType: "ad" | "service" | "user",
  targetId: number,
  reason: string,
  comment: string,
  token: string
) {
  return apiRequest<{ ok: boolean }>("/api/reports", {
    method: "POST",
    token,
    body: JSON.stringify({ targetType, targetId, reason, comment }),
  });
}

export function getAdminReports(token: string) {
  return apiRequest<Report[]>("/api/admin/reports", { token });
}

export function updateReportStatus(
  id: number,
  status: "reviewed" | "dismissed",
  token: string
) {
  return apiRequest<{ ok: boolean }>(`/api/admin/reports/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status }),
  });
}
