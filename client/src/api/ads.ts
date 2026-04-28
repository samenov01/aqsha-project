import type { Ad, AiMatchResult, MetaResponse } from "../types";
import { apiRequest } from "./client";

type AdsQuery = {
  search?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  limit?: number;
};

function buildQuery(params: AdsQuery): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getMeta() {
  return apiRequest<MetaResponse>("/api/meta");
}

export function getAds(params: AdsQuery = {}) {
  return apiRequest<Ad[]>(`/api/ads${buildQuery(params)}`);
}

export function getAdById(id: number | string) {
  return apiRequest<Ad>(`/api/ads/${id}`);
}

export function getMyAds(token: string) {
  return apiRequest<Ad[]>("/api/my/ads", { token });
}

export function deleteAd(id: number | string, token: string) {
  return apiRequest<{ ok: boolean }>(`/api/ads/${id}`, {
    method: "DELETE",
    token,
  });
}

export function updateAdStatus(id: number | string, status: "active" | "archived" | "sold", token: string) {
  return apiRequest<{ ok: boolean }>(`/api/ads/${id}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status }),
  });
}

export function getAdminAds(token: string, adminMfaToken?: string | null) {
  return apiRequest<Ad[]>("/api/admin/ads", {
    token,
    headers: adminMfaToken ? { "X-Admin-MFA": adminMfaToken } : undefined,
  });
}

export function deleteAdminAd(id: number | string, token: string, adminMfaToken?: string | null) {
  return apiRequest<{ ok: boolean }>(`/api/admin/ads/${id}`, {
    method: "DELETE",
    token,
    headers: adminMfaToken ? { "X-Admin-MFA": adminMfaToken } : undefined,
  });
}

export function createAd(
  payload: {
    title: string;
    category: string;
    price: string;
    description: string;
    phone: string;
    whatsapp: string;
    telegram: string;
    images: File[];
  },
  token: string
) {
  const formData = new FormData();
  formData.append("title", payload.title);
  formData.append("category", payload.category);
  formData.append("price", payload.price || "0");
  formData.append("description", payload.description);
  formData.append("phone", payload.phone);
  formData.append("whatsapp", payload.whatsapp);
  formData.append("telegram", payload.telegram);
  payload.images.forEach((file) => formData.append("images", file));

  return apiRequest<Ad>("/api/ads", {
    method: "POST",
    body: formData,
    token,
  });
}

export function getAiMatchJobs(token: string) {
  return apiRequest<AiMatchResult>("/api/ai/match", { token });
}

export function updateSkills(payload: { skills: string; bio: string }, token: string) {
  return apiRequest<{ ok: boolean }>("/api/auth/me/skills", {
    method: "PATCH",
    body: JSON.stringify(payload),
    token,
  });
}
