import type { Application } from "../types";
import { apiRequest } from "./client";

export function applyToJob(jobId: number | string, coverLetter: string, token: string) {
  return apiRequest<{ ok: boolean }>(`/api/jobs/${jobId}/apply`, {
    method: "POST",
    token,
    body: JSON.stringify({ coverLetter }),
  });
}

export function getJobApplications(jobId: number | string, token: string) {
  return apiRequest<Application[]>(`/api/jobs/${jobId}/applications`, { token });
}

export function getMyApplications(token: string) {
  return apiRequest<Application[]>("/api/my/applications", { token });
}

export function updateApplicationStatus(appId: number | string, status: "accepted" | "rejected", token: string) {
  return apiRequest<{ ok: boolean }>(`/api/applications/${appId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status }),
  });
}
