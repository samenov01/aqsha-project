import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { ApiError } from "../api/client";
import { deleteAdminAd, getAdminAds } from "../api/ads";
import { getAdminServices, deleteAdminService } from "../api/services";
import { getAdminAdChats, getAdminAdChat } from "../api/adChat";
import { verifyUser, getAdminOrders, approveAdminOrder } from "../api/admin";
import type { AdminOrder } from "../api/admin";
import type { Ad, User, Service } from "../types";
import { formatPrice } from "../lib/formatters";

type AdminAdsPageProps = {
  token: string | null;
  user: User | null;
};

export function AdminAdsPage({ token, user }: AdminAdsPageProps) {
  const [activeTab, setActiveTab] = useState<"ads" | "chats" | "services" | "orders">("ads");
  const [ads, setAds] = useState<Ad[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    if (!token || !user?.isAdmin) return;
    let isActive = true;
    setIsLoading(true);
    setError("");

    if (activeTab === "ads") {
      getAdminAds(token)
        .then((items) => {
          if (isActive) setAds(items);
        })
        .catch(handleErrors)
        .finally(() => {
          if (isActive) setIsLoading(false);
        });
    } else if (activeTab === "services") {
      getAdminServices(token)
        .then((items) => {
          if (isActive) setServices(items);
        })
        .catch(handleErrors)
        .finally(() => {
          if (isActive) setIsLoading(false);
        });
    } else if (activeTab === "orders") {
      getAdminOrders(token)
        .then((items) => {
          if (isActive) setOrders(items);
        })
        .catch(handleErrors)
        .finally(() => {
          if (isActive) setIsLoading(false);
        });
    } else {
      getAdminAdChats(token)
        .then((items) => {
          if (isActive) setChats(items);
        })
        .catch(handleErrors)
        .finally(() => {
          if (isActive) setIsLoading(false);
        });
    }

    function handleErrors(err: unknown) {
      if (err instanceof ApiError && isActive) {
        setError(err.message);
      }
    }

    return () => {
      isActive = false;
    };
  }, [token, user?.isAdmin, activeTab]);

  async function loadChatDetails(adId: number) {
    if (!token) return;
    setIsLoading(true);
    setSelectedChat(null);
    try {
      const data = await getAdminAdChat(adId, token);
      setSelectedChat(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <section className="section-grid">
        <p className="error-box">{t("admin.auth_warning")}</p>
        <Link className="primary" to="/profile">
          {t("publish.login_btn")}
        </Link>
      </section>
    );
  }

  if (!user?.isAdmin) {
    return (
      <section className="section-grid">
        <p className="error-box">{t("admin.no_access")}</p>
        <Link className="ghost" to="/">
          {t("admin.btn.home")}
        </Link>
      </section>
    );
  }

  async function handleDelete(adId: number) {
    if (!token) return;
    setError("");
    try {
      await deleteAdminAd(adId, token);
      setAds((prev) => prev.filter((ad) => ad.id !== adId));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  async function handleVerify(userId: number, verified: boolean) {
    if (!token) return;
    setError("");
    try {
      await verifyUser(userId, token, verified);
      setAds((prev) =>
        prev.map((ad) =>
          ad.user?.id === userId
            ? { ...ad, user: { ...ad.user, verified } }
            : ad
        )
      );
      setServices((prev) =>
        prev.map((service) =>
          service.user?.id === userId
            ? { ...service, user: { ...service.user, verified } }
            : service
        )
      );
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  async function handleDeleteService(serviceId: number) {
    if (!token) return;
    setError("");
    try {
      await deleteAdminService(serviceId, token);
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  async function handleApproveOrder(orderId: number) {
    if (!token) return;
    setError("");
    try {
      await approveAdminOrder(orderId, token);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "completed" } : o));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  const statusLabels: Record<string, string> = {
    active: t("admin.status.active"),
    archived: t("admin.status.archived"),
    sold: t("admin.status.sold"),
  };

  return (
    <section className="section-grid">
      <div style={{ marginBottom: "2rem" }}>
        <p className="eyebrow">{t("admin.eyebrow")}</p>
        <h1 style={{ marginBottom: "0.5rem" }}>{t("admin.title")}</h1>
      </div>

      {isLoading && <p className="muted">{t("admin.loading")}</p>}
      {error && <p className="error-box">{error}</p>}

      {!isLoading && activeTab === "ads" && ads.length === 0 && <p className="muted">{t("admin.empty.ads")}</p>}
      {!isLoading && activeTab === "services" && services.length === 0 && <p className="muted">{t("admin.empty.services")}</p>}
      {!isLoading && activeTab === "chats" && chats.length === 0 && <p className="muted">{t("admin.empty.chats")}</p>}

      <div style={{ marginBottom: "2rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <button
          className={`ghost ${activeTab === "ads" ? "active" : ""}`}
          onClick={() => { setActiveTab("ads"); setSelectedChat(null); }}
          style={{ borderColor: activeTab === "ads" ? "var(--md-primary)" : "var(--md-outline-variant)" }}
        >
          {t("admin.tab.ads")}
        </button>
        <button
          className={`ghost ${activeTab === "services" ? "active" : ""}`}
          onClick={() => { setActiveTab("services"); setSelectedChat(null); }}
          style={{ borderColor: activeTab === "services" ? "var(--md-primary)" : "var(--md-outline-variant)" }}
        >
          {t("admin.tab.services")}
        </button>
        <button
          className={`ghost ${activeTab === "chats" ? "active" : ""}`}
          onClick={() => { setActiveTab("chats"); setSelectedChat(null); }}
          style={{ borderColor: activeTab === "chats" ? "var(--md-primary)" : "var(--md-outline-variant)" }}
        >
          {t("admin.tab.chats", { count: chats.length.toString() })}
        </button>
      </div>

      {activeTab === "ads" && (
        <div className="admin-ads-grid">
          {ads.map((ad) => (
            <article key={ad.id} className="admin-ad-card">
              <div className="admin-ad-main">
                <div>
                  <h3>{ad.title}</h3>
                  <p className="muted">{ad.category}</p>
                </div>
                <span className={`status-chip status-${ad.status || "active"}`}>
                  {statusLabels[ad.status || "active"]}
                </span>
              </div>
              <div className="admin-ad-meta">
                <span className="price">{formatPrice(ad.price)}</span>
                <span className="muted">{ad.user?.name}</span>
                {ad.user?.verified && <span className="verified-badge small">{t("admin.ad.verified")}</span>}
              </div>
              <div className="admin-ad-actions">
                <Link className="ghost small" to={`/ad/${ad.id}`}>
                  {t("admin.btn.open")}
                </Link>
                {ad.user?.id && !ad.user?.verified && (
                  <button className="ghost small" onClick={() => handleVerify(ad.user?.id as number, true)}>
                    {t("admin.btn.verify")}
                  </button>
                )}
                <button className="ghost small" onClick={() => handleDelete(ad.id)}>
                  {t("admin.btn.delete")}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab === "services" && (
        <div className="admin-ads-grid">
          {services.map((service) => (
            <article key={service.id} className="admin-ad-card">
              <div className="admin-ad-main">
                <div>
                  <h3>{service.title}</h3>
                  <p className="muted">{service.category}</p>
                </div>
              </div>
              <div className="admin-ad-meta">
                <span className="price">{formatPrice(service.price)}</span>
                <span className="muted">{service.user?.name}</span>
                {service.user?.verified && <span className="verified-badge small">{t("admin.ad.verified")}</span>}
              </div>
              <div className="admin-ad-actions">
                <Link className="ghost small" to={`/services/${service.id}`}>
                  {t("admin.btn.open")}
                </Link>
                {service.user?.id && !service.user?.verified && (
                  <button className="ghost small" onClick={() => handleVerify(service.user?.id as number, true)}>
                    {t("admin.btn.verify")}
                  </button>
                )}
                <button className="ghost small" onClick={() => handleDeleteService(service.id as number)}>
                  {t("admin.btn.delete")}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab === "chats" && !selectedChat && (
        <div className="admin-ads-grid">
          {chats.map((chat) => (
            <article key={chat.id} className="admin-ad-card">
              <div className="admin-ad-main">
                <div>
                  <h3>{chat.title}</h3>
                  <p className="muted" style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                    {t("admin.chat.msg_count")}<b>{chat.messageCount}</b>
                  </p>
                </div>
                <span className={`status-chip status-${chat.status || "active"}`}>
                  {statusLabels[chat.status || "active"]}
                </span>
              </div>
              <div className="admin-ad-meta">
                <span className="muted">{t("admin.chat.owner", { name: chat.ownerName })}</span>
              </div>
              <div className="admin-ad-actions">
                <button className="primary small" onClick={() => loadChatDetails(chat.id)}>
                  {t("admin.btn.view_chat")}
                </button>
                <Link className="ghost small" to={`/ad/${chat.id}`}>
                  {t("admin.btn.open_ad")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab === "chats" && selectedChat && (
        <div className="admin-chat-viewer" style={{ background: "var(--md-surface)", padding: "2rem", borderRadius: "var(--md-radius-xl)", border: "1px solid var(--md-outline-variant)", marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>{t("admin.chat.title", { title: selectedChat.adTitle })}</h2>
              <p className="muted">{t("admin.chat.owner", { name: selectedChat.ownerName })}</p>
            </div>
            <button className="ghost" onClick={() => setSelectedChat(null)}>{t("admin.btn.back_to_list")}</button>
          </div>

          <div style={{ background: "var(--md-surface-container)", padding: "1rem", borderRadius: "12px", height: "400px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.8rem", border: "1px solid var(--md-outline-variant)" }}>
            {selectedChat.messages.length === 0 ? (
              <p className="muted">{t("admin.chat.empty")}</p>
            ) : (
              selectedChat.messages.map((msg: any) => (
                <div key={msg.id} style={{ alignSelf: msg.senderId === selectedChat.ownerId ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--md-on-surface-variant)", marginBottom: "3px", textAlign: msg.senderId === selectedChat.ownerId ? "right" : "left" }}>
                    {msg.senderName} {msg.senderId === selectedChat.ownerId && t("admin.chat.author")}
                  </div>
                  <div style={{ background: msg.senderId === selectedChat.ownerId ? "var(--md-primary)" : "white", color: msg.senderId === selectedChat.ownerId ? "white" : "var(--md-on-surface)", padding: "0.6rem 0.9rem", borderRadius: "12px", border: msg.senderId === selectedChat.ownerId ? "none" : "1px solid var(--md-outline-variant)" }}>
                    {msg.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "orders" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {orders.length === 0 ? (
            <p className="muted">{t("admin.empty.orders")}</p>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="order-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  padding: "2rem",
                  background: "var(--md-surface)",
                  borderRadius: "var(--md-radius-lg)",
                  border: "1px solid var(--md-outline-variant)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ margin: "0 0 0.5rem 0" }}>{t("admin.order.title", { id: String(order.id), title: order.serviceTitle })}</h3>
                    <p className="muted" style={{ margin: "0 0 0.5rem 0" }}>
                      {t("admin.order.client")}<strong>{order.clientName}</strong> | {t("admin.order.provider")}<strong>{order.providerName}</strong>
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span className={`status-chip status-${order.status}`}>
                        {order.status === "under_review" ? t("admin.order.status.under_review") : order.status === "completed" ? t("admin.order.status.completed") : order.status === "pending" ? t("admin.order.status.pending") : order.status === "accepted" ? t("admin.order.status.accepted") : order.status}
                      </span>
                      <strong style={{ color: "var(--md-primary)" }}>{formatPrice(order.price)}</strong>
                    </div>
                  </div>
                  <div>
                    {order.status === "under_review" && (
                      <button className="primary" onClick={() => handleApproveOrder(order.id)}>
                        {t("admin.btn.approve_payout")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
