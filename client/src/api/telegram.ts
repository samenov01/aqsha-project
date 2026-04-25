import { apiRequest } from "./client";

export function generateTelegramLinkToken(token: string) {
  return apiRequest<{ token: string; expiresAt: string }>("/api/telegram/link-token", {
    method: "POST",
    token,
  });
}

export function getTelegramStatus(token: string) {
  return apiRequest<{ linked: boolean }>("/api/telegram/status", { token });
}

export function unlinkTelegram(token: string) {
  return apiRequest<{ ok: boolean }>("/api/telegram/unlink", {
    method: "DELETE",
    token,
  });
}
