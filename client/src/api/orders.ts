import type { ServiceMessage, ServiceOrder } from "../types";
import { apiRequest } from "./client";

export function createOrder(serviceId: number | string, token: string) {
  return apiRequest<ServiceOrder>("/api/orders", {
    method: "POST",
    token,
    body: JSON.stringify({ serviceId }),
  });
}

export function getOrders(token: string) {
  return apiRequest<ServiceOrder[]>("/api/orders", { token });
}

export function getOrderById(id: number | string, token: string) {
  return apiRequest<ServiceOrder>(`/api/orders/${id}`, { token });
}

export function updateOrderStatus(id: number | string, status: ServiceOrder["status"], token: string) {
  return apiRequest<ServiceOrder>(`/api/orders/${id}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status }),
  });
}

export function updatePaymentStatus(id: number | string, status: "paid", token: string) {
  return apiRequest<ServiceOrder>(`/api/orders/${id}/payment`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status }),
  });
}

export function getOrderMessages(id: number | string, token: string) {
  return apiRequest<ServiceMessage[]>(`/api/orders/${id}/messages`, { token });
}

export function sendOrderMessage(id: number | string, message: string, token: string) {
  return apiRequest<ServiceMessage>(`/api/orders/${id}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify({ message }),
  });
}

export function markOrderMessagesRead(id: number | string, token: string) {
  return apiRequest<{ ok: boolean }>(`/api/orders/${id}/messages/read`, {
    method: "PATCH",
    token,
  });
}

export function createReview(id: number | string, rating: number, comment: string, token: string) {
  return apiRequest<{ ok: boolean }>(`/api/orders/${id}/review`, {
    method: "POST",
    token,
    body: JSON.stringify({ rating, comment }),
  });
}
