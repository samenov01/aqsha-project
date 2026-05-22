import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { ApiError } from "../api/client";
import { deleteAdminAd, getAdminAds } from "../api/ads";
import { getAdminServices, deleteAdminService } from "../api/services";
import { getAdminAdChats, getAdminAdChat } from "../api/adChat";
import { verifyUser, getAdminOrders, approveAdminOrder, changeAdminOrderStatus } from "../api/admin";
import type { AdminOrder } from "../api/admin";
import type { Ad, User, Service } from "../types";
import { formatPrice, formatDateTime } from "../lib/formatters";

type AdminAdsPageProps = {
  token: string | null;
  user: User | null;
};

const ORDER_STATUSES: { value: string; label: string; color: string }[] = [
  { value: "pending",      label: "Ожидает",       color: "#f59e0b" },
  { value: "accepted",     label: "В работе",       color: "#3b82f6" },
  { value: "frozen",       label: "Заморожен",      color: "#8b5cf6" },
  { value: "under_review", label: "На проверке",    color: "#f97316" },
  { value: "completed",    label: "Завершён",        color: "#22c55e" },
  { value: "cancelled",    label: "Отменён",         color: "#ef4444" },
];

function statusLabel(s: string) {
  return ORDER_STATUSES.find((x) => x.value === s)?.label ?? s;
}
function statusColor(s: string) {
  return ORDER_STATUSES.find((x) => x.value === s)?.color ?? "var(--md-on-surface-variant)";
}

export function AdminAdsPage({ token, user }: AdminAdsPageProps) {
  const [activeTab, setActiveTab] = useState<"ads" | "chats" | "services" | "orders">("ads");
  const [ads, setAds] = useState<Ad[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [changingOrderId, setChangingOrderId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    if (!token || !user?.isAdmin) return;
    let isActive = true;
    setIsLoading(true);
    setError("");

    const load = () => {
      if (activeTab === "ads") return getAdminAds(token).then((items) => { if (isActive) setAds(items); });
      if (activeTab === "services") return getAdminServices(token).then((items) => { if (isActive) setServices(items); });
      if (activeTab === "orders") return getAdminOrders(token).then((items) => { if (isActive) setOrders(items); });
      return getAdminAdChats(token).then((items) => { if (isActive) setChats(items); });
    };

    load()
      .catch((err: unknown) => { if (err instanceof ApiError && isActive) setError(err.message); })
      .finally(() => { if (isActive) setIsLoading(false); });

    return () => { isActive = false; };
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
        <Link className="primary" to="/profile">{t("publish.login_btn")}</Link>
      </section>
    );
  }

  if (!user?.isAdmin) {
    return (
      <section className="section-grid">
        <p className="error-box">{t("admin.no_access")}</p>
        <Link className="ghost" to="/">{t("admin.btn.home")}</Link>
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
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function handleVerify(userId: number, verified: boolean) {
    if (!token) return;
    setError("");
    try {
      await verifyUser(userId, token, verified);
      setAds((prev) => prev.map((ad) => ad.user?.id === userId ? { ...ad, user: { ...ad.user, verified } } : ad));
      setServices((prev) => prev.map((s) => s.user?.id === userId ? { ...s, user: { ...s.user, verified } } : s));
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function handleDeleteService(serviceId: number) {
    if (!token) return;
    setError("");
    try {
      await deleteAdminService(serviceId, token);
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function handleApproveOrder(orderId: number) {
    if (!token) return;
    setError("");
    try {
      await approveAdminOrder(orderId, token);
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "completed" } : o));
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function handleChangeOrderStatus(orderId: number, status: string) {
    if (!token) return;
    setError("");
    setChangingOrderId(orderId);
    try {
      await changeAdminOrderStatus(orderId, status, token);
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setChangingOrderId(null);
    }
  }

  const adStatusLabels: Record<string, string> = {
    active: t("admin.status.active"),
    archived: t("admin.status.archived"),
    sold: t("admin.status.sold"),
  };

  const tabs = [
    { key: "ads" as const,      label: `${t("admin.tab.ads")} (${ads.length || ""})` },
    { key: "services" as const, label: `${t("admin.tab.services")} (${services.length || ""})` },
    { key: "orders" as const,   label: `Заказы (${orders.length || ""})` },
    { key: "chats" as const,    label: t("admin.tab.chats", { count: chats.length.toString() }) },
  ];

  return (
    <section className="section-grid">
      <div style={{ marginBottom: "2rem" }}>
        <p className="eyebrow">{t("admin.eyebrow")}</p>
        <h1 style={{ marginBottom: "0.5rem" }}>{t("admin.title")}</h1>
      </div>

      {error && <p className="error-box">{error}</p>}

      {/* Tabs */}
      <div style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", borderBottom: "1px solid var(--md-outline-variant)", paddingBottom: "0.75rem" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedChat(null); }}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "var(--md-shape-full)",
              border: "none",
              fontWeight: activeTab === tab.key ? 700 : 400,
              background: activeTab === tab.key ? "var(--md-primary)" : "var(--md-surface-container)",
              color: activeTab === tab.key ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
              cursor: "pointer",
              fontSize: "0.9rem",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="muted">{t("admin.loading")}</p>}

      {/* ADS */}
      {activeTab === "ads" && !isLoading && (
        <div className="admin-ads-grid">
          {ads.length === 0 && <p className="muted">{t("admin.empty.ads")}</p>}
          {ads.map((ad) => (
            <article key={ad.id} className="admin-ad-card">
              <div className="admin-ad-main">
                <div>
                  <h3>{ad.title}</h3>
                  <p className="muted">{ad.category}</p>
                </div>
                <span className={`status-chip status-${ad.status || "active"}`}>
                  {adStatusLabels[ad.status || "active"]}
                </span>
              </div>
              <div className="admin-ad-meta">
                <span className="price">{formatPrice(ad.price)}</span>
                <span className="muted">{ad.user?.name}</span>
                {ad.user?.verified && <span className="verified-badge small">{t("admin.ad.verified")}</span>}
              </div>
              <div className="admin-ad-actions">
                <Link className="ghost small" to={`/ad/${ad.id}`}>{t("admin.btn.open")}</Link>
                {ad.user?.id && !ad.user?.verified && (
                  <button className="ghost small" onClick={() => handleVerify(ad.user?.id as number, true)}>
                    {t("admin.btn.verify")}
                  </button>
                )}
                <button className="ghost small" onClick={() => handleDelete(ad.id)}>{t("admin.btn.delete")}</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* SERVICES */}
      {activeTab === "services" && !isLoading && (
        <div className="admin-ads-grid">
          {services.length === 0 && <p className="muted">{t("admin.empty.services")}</p>}
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
                <Link className="ghost small" to={`/services/${service.id}`}>{t("admin.btn.open")}</Link>
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

      {/* ORDERS */}
      {activeTab === "orders" && !isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {orders.length === 0 && <p className="muted">{t("admin.empty.orders")}</p>}
          {orders.map((order) => (
            <div
              key={order.id}
              style={{
                background: "var(--md-surface)",
                borderRadius: "var(--md-radius-lg)",
                border: "1px solid var(--md-outline-variant)",
                padding: "1.25rem 1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "1rem" }}>#{order.id} — {order.serviceTitle}</span>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: "999px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      background: statusColor(order.status) + "20",
                      color: statusColor(order.status),
                      border: `1px solid ${statusColor(order.status)}40`,
                    }}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 0.25rem" }}>
                    Клиент: <strong>{order.clientName}</strong> · Исполнитель: <strong>{order.providerName}</strong>
                  </p>
                  <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>
                    Создан: {formatDateTime(order.createdAt)}
                    {order.completedAt && ` · Завершён: ${formatDateTime(order.completedAt)}`}
                    {" · "}Оплата: <strong>{order.paymentStatus === "paid" ? "Оплачен" : "Не оплачен"}</strong>
                    {" · "}<strong style={{ color: "var(--md-primary)" }}>{formatPrice(order.price)}</strong>
                  </p>
                </div>
              </div>

              {/* Status controls */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--md-on-surface-variant)", marginRight: "0.25rem" }}>Изменить статус:</span>
                {ORDER_STATUSES.filter((s) => s.value !== order.status).map((s) => (
                  <button
                    key={s.value}
                    disabled={changingOrderId === order.id}
                    onClick={() => handleChangeOrderStatus(order.id, s.value)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "999px",
                      border: `1px solid ${s.color}60`,
                      background: s.color + "15",
                      color: s.color,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      opacity: changingOrderId === order.id ? 0.6 : 1,
                    }}
                  >
                    {s.label}
                  </button>
                ))}
                {order.status === "under_review" && (
                  <button
                    className="primary"
                    style={{ padding: "4px 14px", fontSize: "0.85rem" }}
                    onClick={() => handleApproveOrder(order.id)}
                    disabled={changingOrderId === order.id}
                  >
                    Одобрить выплату
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CHATS LIST */}
      {activeTab === "chats" && !isLoading && !selectedChat && (
        <div className="admin-ads-grid">
          {chats.length === 0 && <p className="muted">{t("admin.empty.chats")}</p>}
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
                  {adStatusLabels[chat.status || "active"]}
                </span>
              </div>
              <div className="admin-ad-meta">
                <span className="muted">{t("admin.chat.owner", { name: chat.ownerName })}</span>
              </div>
              <div className="admin-ad-actions">
                <button className="primary small" onClick={() => loadChatDetails(chat.id)}>
                  {t("admin.btn.view_chat")}
                </button>
                <Link className="ghost small" to={`/ad/${chat.id}`}>{t("admin.btn.open_ad")}</Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* CHAT VIEWER */}
      {activeTab === "chats" && !isLoading && selectedChat && (
        <div style={{ background: "var(--md-surface)", padding: "1.5rem", borderRadius: "var(--md-radius-xl)", border: "1px solid var(--md-outline-variant)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "0.25rem" }}>{t("admin.chat.title", { title: selectedChat.adTitle })}</h2>
              <p className="muted" style={{ fontSize: "0.85rem" }}>{t("admin.chat.owner", { name: selectedChat.ownerName })} · {selectedChat.messages.length} сообщ.</p>
            </div>
            <button className="ghost small" onClick={() => setSelectedChat(null)}>{t("admin.btn.back_to_list")}</button>
          </div>

          <div style={{
            background: "var(--md-surface-container)",
            borderRadius: "12px",
            height: "420px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            padding: "1rem",
            border: "1px solid var(--md-outline-variant)",
          }}>
            {selectedChat.messages.length === 0 ? (
              <p className="muted" style={{ textAlign: "center", margin: "auto" }}>{t("admin.chat.empty")}</p>
            ) : (
              selectedChat.messages.map((msg: any) => {
                const isOwner = msg.senderId === selectedChat.ownerId;
                return (
                  <div key={msg.id} style={{ alignSelf: isOwner ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--md-on-surface-variant)", marginBottom: "3px", textAlign: isOwner ? "right" : "left" }}>
                      {msg.senderName}{isOwner ? " (автор)" : ""}
                    </div>
                    <div style={{
                      background: isOwner ? "var(--md-primary)" : "var(--md-surface)",
                      color: isOwner ? "var(--md-on-primary)" : "var(--md-on-surface)",
                      padding: "0.55rem 0.9rem",
                      borderRadius: isOwner ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      border: isOwner ? "none" : "1px solid var(--md-outline-variant)",
                      fontSize: "0.9rem",
                    }}>
                      {msg.message}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--md-on-surface-variant)", marginTop: "3px", textAlign: isOwner ? "right" : "left" }}>
                      {formatDateTime(msg.createdAt)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
