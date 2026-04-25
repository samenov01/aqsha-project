import type { Conversation, ConversationMessage } from "../types";
import { apiRequest } from "./client";

export function getMyConversations(token: string) {
  return apiRequest<Conversation[]>("/api/my/conversations", { token });
}

export function startConversation(adId: number, token: string, message?: string) {
  return apiRequest<{ conversation: Conversation }>(`/api/ads/${adId}/conversations`, {
    method: "POST",
    token,
    body: JSON.stringify({ message }),
  });
}

export function getConversationMessages(conversationId: number, token: string) {
  return apiRequest<{ conversation: Conversation; messages: ConversationMessage[] }>(
    `/api/conversations/${conversationId}/messages`,
    { token }
  );
}

export function sendConversationMessage(conversationId: number, body: string, token: string) {
  return apiRequest<{ message: ConversationMessage }>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify({ body }),
  });
}
