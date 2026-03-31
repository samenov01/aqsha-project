import type { Favorite } from "../types";
import { apiRequest } from "./client";

export function getFavorites(token: string) {
  return apiRequest<Favorite[]>("/api/favorites", { token });
}

export function getFavoriteIds(token: string) {
  return apiRequest<{ adIds: number[]; serviceIds: number[] }>("/api/favorites/ids", { token });
}

export function addFavorite(params: { adId?: number; serviceId?: number }, token: string) {
  return apiRequest<{ ok: boolean; id: number }>("/api/favorites", {
    method: "POST",
    token,
    body: JSON.stringify(params),
  });
}

export function removeFavorite(params: { adId?: number; serviceId?: number }, token: string) {
  const query = params.adId ? `adId=${params.adId}` : `serviceId=${params.serviceId}`;
  return apiRequest<{ ok: boolean }>(`/api/favorites?${query}`, {
    method: "DELETE",
    token,
  });
}
