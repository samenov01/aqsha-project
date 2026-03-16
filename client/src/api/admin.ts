import { apiRequest } from "./client";

export function verifyUser(
  userId: number | string,
  token: string,
  verified = true,
  adminMfaToken?: string | null
) {
  return apiRequest<{ ok: boolean; verified: boolean }>(`/api/admin/users/${userId}/verify`, {
    method: "PATCH",
    token,
    headers: adminMfaToken ? { "X-Admin-MFA": adminMfaToken } : undefined,
    body: JSON.stringify({ verified }),
  });
}
export type AdminOrder = {
  id: number;
  serviceId: number;
  serviceTitle: string;
  price: number;
  clientId: number;
  clientName: string;
  providerId: number;
  providerName: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  completedAt?: string;
};

export function getAdminOrders(token: string) {
  return apiRequest<AdminOrder[]>("/api/admin/orders", { token });
}

export function approveAdminOrder(orderId: number, token: string) {
  return apiRequest<{ ok: boolean }>(`/api/admin/orders/${orderId}/approve`, {
    method: "POST",
    token,
  });
}
