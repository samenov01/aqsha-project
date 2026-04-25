import type { PublicProfile, User } from "../types";
import { apiRequest } from "./client";

export function getUserProfile(userId: number | string) {
  return apiRequest<PublicProfile>(`/api/users/${userId}/profile`);
}

export function updateProfile(
  payload: { skills?: string; role?: string; preferredMicrorayon?: string },
  token: string
) {
  return apiRequest<{ ok: boolean; user: User }>("/api/auth/me", {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}
