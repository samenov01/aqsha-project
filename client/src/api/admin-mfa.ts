import { apiRequest } from "./client";

export function getAdminMfaStatus(token: string) {
  return apiRequest<{ registered: boolean }>("/api/admin/webauthn/status", { token });
}

export function getAdminMfaRegistrationOptions(token: string) {
  return apiRequest<unknown>("/api/admin/webauthn/register/options", {
    method: "POST",
    token,
  });
}

export function verifyAdminMfaRegistration(token: string, response: unknown) {
  return apiRequest<{ ok: boolean; registered: boolean }>("/api/admin/webauthn/register/verify", {
    method: "POST",
    token,
    body: JSON.stringify({ response }),
  });
}

export function getAdminMfaAuthOptions(token: string) {
  return apiRequest<unknown>("/api/admin/webauthn/auth/options", {
    method: "POST",
    token,
  });
}

export function verifyAdminMfaAuth(token: string, response: unknown) {
  return apiRequest<{ ok: boolean; adminMfaToken: string; expiresInMin: number }>(
    "/api/admin/webauthn/auth/verify",
    {
      method: "POST",
      token,
      body: JSON.stringify({ response }),
    }
  );
}
