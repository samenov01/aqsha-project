import { apiRequest } from "./client";

export function sendTypingStatus(recipientId: number, isTyping: boolean, contextId: string, token: string) {
  return apiRequest<{ ok: boolean }>("/api/stream/typing", {
    method: "POST",
    token,
    body: JSON.stringify({ recipientId, isTyping, contextId }),
  });
}
