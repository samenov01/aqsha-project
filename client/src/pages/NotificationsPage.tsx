import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { ApiError } from "../api/client";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications";
import type { Notification } from "../types";

type NotificationsPageProps = {
  token: string | null;
  onRefresh: () => void;
};

export function NotificationsPage({ token, onRefresh }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    if (!token) return;
    let isActive = true;
    setIsLoading(true);
    setError("");

    getNotifications(token)
      .then((data) => {
        if (!isActive) return;
        setNotifications(data);
        onRefresh();
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && isActive) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [token, onRefresh]);

  if (!token) {
    return (
      <section className="section-grid">
        <p className="error-box">{t("notifications.auth_warning")}</p>
        <Link className="primary" to="/profile">
          {t("publish.login_btn")}
        </Link>
      </section>
    );
  }

  async function handleMarkAll() {
    if (!token) return;
    setError("");
    try {
      await markAllNotificationsRead(token);
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  async function handleMarkOne(id: number) {
    if (!token) return;
    setError("");
    try {
      await markNotificationRead(id, token);
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <section className="section-grid">
      <div className="section-head-row">
        <div>
          <p className="eyebrow">{t("notifications.eyebrow")}</p>
          <h1>{t("notifications.title")}</h1>
        </div>
        {notifications.length > 0 && (
          <button className="ghost" onClick={handleMarkAll}>
            {t("notifications.mark_all")}
          </button>
        )}
      </div>

      {isLoading && <p className="muted">{t("notifications.loading")}</p>}
      {error && <p className="error-box">{error}</p>}

      {!isLoading && notifications.length === 0 && <p className="muted">{t("notifications.empty")}</p>}

      {!isLoading && notifications.length > 0 && (
        <div className="notifications-grid">
          {notifications.map((item) => {
            const time = new Date(item.createdAt).toLocaleString("ru-RU", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <article key={item.id} className={`notification-card ${item.isRead ? "read" : ""}`}>
                <div className="notification-head">
                  <strong>{item.title}</strong>
                  <span className="muted">{time}</span>
                </div>
                <p>{item.body}</p>
                <div style={{ display: "flex", gap: "0.8rem", marginTop: "0.5rem" }}>
                  {item.link && (
                    <Link className="primary small" to={item.link}>
                      {t("notifications.btn.go")}
                    </Link>
                  )}
                  {!item.isRead && (
                    <button className="ghost small" onClick={() => handleMarkOne(item.id)}>
                      {t("notifications.btn.mark_read")}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {unreadCount === 0 && notifications.length > 0 && <p className="muted">{t("notifications.all_read")}</p>}
    </section>
  );
}
