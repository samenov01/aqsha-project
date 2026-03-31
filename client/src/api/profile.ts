import type { PublicProfile } from "../types";
import { apiRequest } from "./client";

export function getUserProfile(userId: number | string) {
  return apiRequest<PublicProfile>(`/api/users/${userId}/profile`);
}
