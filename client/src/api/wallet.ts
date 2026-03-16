import { apiRequest } from "./client";

export type Transaction = {
  id: number;
  amount: number;
  type: "income" | "expense";
  description: string;
  createdAt: string;
};

export type WalletData = {
  balance: number;
  transactions: Transaction[];
};

export function getWallet(token: string) {
  return apiRequest<WalletData>("/api/wallet", { token });
}

export function topupWallet(amount: number, token: string) {
  return apiRequest<{ ok: boolean; balance: number }>("/api/wallet/topup", {
    method: "POST",
    body: JSON.stringify({ amount }),
    token,
  });
}
