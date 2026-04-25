import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { getUserProfile } from "../api/profile";
import { formatDate } from "../lib/formatters";
import type { PublicProfile as PublicUserProfile } from "../types";

export function FreelancerProfilePage() {
  const params = useParams();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const userId = Number(params.id);
    if (!userId || Number.isNaN(userId)) {
      setError("Некорректный id пользователя");
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError("");

    getUserProfile(userId)
      .then((response) => {
        if (!isActive) return;
        setProfile(response as unknown as PublicUserProfile);
      })
      .catch((err: unknown) => {
        if (!isActive) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Не удалось загрузить профиль");
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => { isActive = false; };
  }, [params.id]);

  if (isLoading) {
    return (
      <section className="section-grid">
        <p className="muted">Загрузка профиля...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section-grid">
        <p className="error-box">{error}</p>
        <Link className="ghost" to="/market">Назад</Link>
      </section>
    );
  }

  if (!profile) return null;

  return (
    <div className="page-stack">
      <section className="section-grid">
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="m3-avatar-large" style={{ width: 80, height: 80, flexShrink: 0 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="eyebrow">Профиль пользователя</p>
            <h1 style={{ marginTop: "0.25rem" }}>{profile.name}</h1>
            <p className="muted" style={{ marginTop: "0.25rem" }}>{profile.university}</p>
            {profile.isVerified && (
              <span className="verified-badge small" style={{ marginTop: "0.5rem", display: "inline-flex" }}>
                ✓ Проверен
              </span>
            )}
          </div>
        </div>

        <div className="m3-stat-grid" style={{ marginTop: "0.5rem" }}>
          <div className="m3-stat-card">
            <span className="label">Рейтинг</span>
            <span className="value" style={{ color: "var(--md-primary)" }}>
              {(profile.stats.ratingAvg ?? 0).toFixed(1)} / 5
            </span>
          </div>
          <div className="m3-stat-card">
            <span className="label">Оценок</span>
            <span className="value">{profile.stats.ratingCount}</span>
          </div>
          <div className="m3-stat-card">
            <span className="label">Заказов</span>
            <span className="value">{profile.stats.completedOrders}</span>
          </div>
          <div className="m3-stat-card">
            <span className="label">На платформе с</span>
            <span className="value" style={{ fontSize: "0.95rem" }}>{formatDate(profile.joinedAt)}</span>
          </div>
        </div>
      </section>

      {profile.reviews.length > 0 && (
        <section className="section-grid">
          <p className="eyebrow">Отзывы</p>
          <h2>Оценки от клиентов</h2>
          <div className="review-list">
            {profile.reviews.map((r, i) => (
              <div key={i} className="review-card">
                <div className="review-head">
                  <span className="review-rating">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  <strong style={{ fontSize: "0.9rem" }}>{r.clientName}</strong>
                  <span className="muted" style={{ fontSize: "0.78rem", marginLeft: "auto" }}>
                    {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                {r.comment && <p style={{ fontSize: "0.9rem" }}>{r.comment}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div>
        <Link className="ghost" to="/market">← Назад к вакансиям</Link>
      </div>
    </div>
  );
}
