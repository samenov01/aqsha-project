import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { getWallet, topupWallet } from "../api/wallet";
import type { WalletData } from "../api/wallet";
import { ApiError } from "../api/client";
import { formatPrice } from "../lib/formatters";
import type { User } from "../types";

type WalletPageProps = {
  token: string | null;
  user: User | null;
  updateUser: (updates: Partial<User>) => void;
};

export function WalletPage({ token, user, updateUser }: WalletPageProps) {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const [isToppingUp, setIsToppingUp] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!token) return;
    let isActive = true;

    getWallet(token)
      .then((res) => {
        if (isActive) {
          setData(res);
          updateUser({ balance: res.balance });
        }
      })
      .catch((err) => {
        if (isActive && err instanceof ApiError) setError(err.message);
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [token, updateUser]);

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) return;

    setIsToppingUp(true);
    setError("");

    try {
      const res = await topupWallet(amount, token);
      updateUser({ balance: res.balance });
      const newData = await getWallet(token);
      setData(newData);
      setTopupAmount("");
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setIsToppingUp(false);
    }
  }

  if (!token) {
    return (
      <section className="section-grid">
        <p className="error-box">{t("wallet.auth_warning")}</p>
        <Link className="primary" to="/profile">{t("publish.login_btn")}</Link>
      </section>
    );
  }

  return (
    <section className="section-grid" style={{ maxWidth: "600px", margin: "0 auto" }}>
      <p className="eyebrow">{t("wallet.eyebrow")}</p>
      <h1>{t("wallet.title", { name: user?.name || "" })}</h1>

      {loading && <p className="muted">{t("wallet.loading")}</p>}
      {error && <p className="error-box">{error}</p>}

      {!loading && data && (
        <>
          <div style={{
            background: "linear-gradient(135deg, var(--brand), #0066cc)",
            color: "white",
            padding: "2rem",
            borderRadius: "16px",
            marginBottom: "2rem",
            boxShadow: "0 10px 30px rgba(0, 114, 255, 0.2)"
          }}>
            <p style={{ opacity: 0.8, marginBottom: "0.5rem" }}>{t("wallet.balance")}</p>
            <h2 style={{ fontSize: "2.5rem", margin: 0 }}>{formatPrice(data.balance)}</h2>
          </div>

          <form onSubmit={handleTopup} style={{ display: "flex", gap: "1rem", marginBottom: "3rem", background: "var(--bg-soft)", padding: "1.5rem", borderRadius: "12px" }}>
            <div style={{ flex: 1 }}>
              <label>{t("wallet.topup.label")}</label>
              <input 
                type="number" 
                value={topupAmount} 
                onChange={(e) => setTopupAmount(e.target.value)} 
                placeholder={t("wallet.topup.placeholder")}
                min="1"
                disabled={isToppingUp}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="primary" type="submit" disabled={isToppingUp || !topupAmount}>
                {isToppingUp ? t("wallet.topup.btn_loading") : t("wallet.topup.btn")}
              </button>
            </div>
          </form>

          <h3>{t("wallet.history.title")}</h3>
          {data.transactions.length === 0 ? (
            <p className="muted">{t("wallet.history.empty")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
              {data.transactions.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", background: "white", border: "1px solid var(--line)", borderRadius: "12px" }}>
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: "4px" }}>{t.description}</p>
                    <p className="muted" style={{ fontSize: "0.85rem" }}>{new Date(t.createdAt).toLocaleString("ru-KZ")}</p>
                  </div>
                  <div style={{ 
                    fontWeight: "bold", 
                    fontSize: "1.1rem",
                    color: t.type === "income" ? "#10b981" : "var(--text)"
                  }}>
                    {t.type === "income" ? "+" : "-"}{formatPrice(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
