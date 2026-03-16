import type { AdMessage, AdChatResponse } from "../types";
import { apiRequest } from "./client";

export type AdChatParticipant = {
  id: number;
  name: string;
  unread_count: number;
  last_message_at: string;
};

export function getAdChats(adId: number, token: string) {
  return apiRequest<AdChatParticipant[]>(`/api/ads/${adId}/chats`, { token });
}

export function getAdMessages(adId: number, token: string, clientId?: number) {
  const url = clientId ? `/api/ads/${adId}/messages?clientId=${clientId}` : `/api/ads/${adId}/messages`;
  return apiRequest<AdChatResponse>(url, { token });
}

export function sendAdMessage(adId: number, message: string, token: string, clientId?: number) {
  return apiRequest<AdMessage>(`/api/ads/${adId}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify({ message, clientId }),
  });
}

export function markAdMessagesRead(adId: number, token: string, clientId?: number) {
  return apiRequest<{ ok: boolean }>(`/api/ads/${adId}/messages/read`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ clientId }),
  });
}

export type AdminAdChat = {
  id: number;
  title: string;
  status: string;
  ownerName: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
};

export function getAdminAdChats(token: string) {
  return apiRequest<AdminAdChat[]>("/api/admin/ad-chats", { token });
}

export function getAdminAdChat(adId: number, token: string) {
  return apiRequest<AdChatResponse>(`/api/admin/ad-chats/${adId}`, { token });
}
