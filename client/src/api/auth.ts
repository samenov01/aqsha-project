import type { AuthResponse } from "../types";
import { apiRequest } from "./client";

export function register(payload: { name: string; email: string; password: string }) {
  return apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: { email: string; password: string }) {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMe(token: string) {
  return apiRequest<{ user: import("../types").User }>("/api/auth/me", {
    token,
  });
}

/* ─── Camera FaceID ─── */

export function getFaceIdStatus(token: string) {
  return apiRequest<{ registered: boolean }>("/api/auth/faceid/status", { token });
}

export function registerFaceId(token: string, descriptor: number[]) {
  return apiRequest<{ ok: boolean; registered: boolean }>("/api/auth/faceid/register", {
    method: "POST",
    token,
    body: JSON.stringify({ descriptor }),
  });
}

export function loginWithFaceId(descriptor: number[]) {
  return apiRequest<AuthResponse & { distance?: number }>("/api/auth/faceid/login", {
    method: "POST",
    body: JSON.stringify({ descriptor }),
  });
}
