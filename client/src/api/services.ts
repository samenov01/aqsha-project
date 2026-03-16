import type { Service } from "../types";
import { apiRequest } from "./client";

type ServicesQuery = {
  search?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  sort?: string;
  limit?: number;
};

function buildQuery(params: ServicesQuery): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getServices(params: ServicesQuery = {}) {
  return apiRequest<Service[]>(`/api/services${buildQuery(params)}`);
}

export function getServiceById(id: number | string) {
  return apiRequest<Service>(`/api/services/${id}`);
}

export function getMyServices(token: string) {
  return apiRequest<Service[]>("/api/my/services", { token });
}

export function deleteService(id: number | string, token: string) {
  return apiRequest<{ ok: boolean }>(`/api/services/${id}`, {
    method: "DELETE",
    token,
  });
}

export function updateService(
  id: number | string,
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

  return apiRequest<Service>(`/api/services/${id}`, {
    method: "PATCH",
    body: formData,
    token,
  });
}

export function createService(
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

  return apiRequest<Service>("/api/services", {
    method: "POST",
    body: formData,
    token,
  });
}

export function getAdminServices(token: string) {
  return apiRequest<Service[]>("/api/admin/services", { token });
}

export function deleteAdminService(id: number | string, token: string) {
  return apiRequest<{ ok: boolean }>(`/api/admin/services/${id}`, {
    method: "DELETE",
    token,
  });
}
