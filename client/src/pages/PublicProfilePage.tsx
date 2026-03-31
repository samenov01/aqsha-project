import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getUserProfile } from "../api/profile";
import { ApiError } from "../api/client";
import { formatPrice } from "../lib/formatters";
import { IconStar } from "../components/icons/Icons";
import type { PublicProfile } from "../types";

const BADGE_LABELS: Record<string, string> = {
  first_deal: "Первая сделка",
  deals_10: "10 сделок",
  deals_50: "50 сделок",
  top_rated: "Топ исполнитель",
};

function StarRating({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <IconStar
          key={n}
          size={14}
          className={n <= Math.round(value) ? "service-rating-star" : ""}
          style={{ opacity: n <= Math.round(value) ? 1 : 0.25 }}
        />
      ))}
    </span>
  );
}

export function PublicProfilePage() {
  const params = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const userId = Number(params.id);
    if (!userId || Number.isNaN(userId)) {
      setError("Некорректный ID пользователя");
      return;
    }
    let active = true;
    getUserProfile(userId)
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  if (error) {
    return (
      <section className="section-grid">
        <p className="error-box">{error}</p>
        <Link className="ghost" to="/">
          На главную
        </Link>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="section-grid">
        <p className="muted">Загрузка...</p>
      </section>
    );
  }

  return (
    <div className="page-stack">
      {/* Header */}
      <section className="section-grid">
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "var(--md-primary)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <h1 style={{ margin: 0 }}>{profile.name}</h1>
              {profile.isVerified && (
                <span className="verified-badge small">Верифицирован</span>
              )}
            </div>
            <p className="muted">{profile.university}</p>
            <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
              <span>
                <strong>{profile.stats.completedOrders}</strong>{" "}
                <span className="muted">сделок</span>
              </span>
              {profile.stats.ratingAvg !== null && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <StarRating value={profile.stats.ratingAvg} />
                  <strong>{profile.stats.ratingAvg?.toFixed(1)}</strong>
                  <span className="muted">({profile.stats.ratingCount} отзывов)</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Badges */}
        {profile.badges.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            {profile.badges.map((b) => (
              <span
                key={b.badge}
                className="pill"
                style={{ background: "var(--md-primary-container)", color: "var(--md-on-primary-container)" }}
                title={`Получен ${new Date(b.earnedAt).toLocaleDateString("ru-RU")}`}
              >
                {BADGE_LABELS[b.badge] ?? b.badge}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Services */}
      {profile.services.length > 0 && (
        <section className="section-grid">
          <h2>Услуги</h2>
          <div className="ads-grid">
            {profile.services.map((s) => (
              <Link key={s.id} to={`/services/${s.id}`} className="ad-card" style={{ textDecoration: "none", color: "inherit" }}>
                {s.image && (
                  <img className="ad-card-img" src={s.image} alt={s.title} loading="lazy" />
                )}
                <div className="ad-card-body">
                  <p className="muted" style={{ fontSize: "0.75rem" }}>{s.category}</p>
                  <p className="ad-card-title">{s.title}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.4rem" }}>
                    <span className="price">{formatPrice(s.price)}</span>
                    {s.ratingAvg !== null && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.8rem" }}>
                        <IconStar size={12} className="service-rating-star" />
                        {s.ratingAvg?.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Ads */}
      {profile.ads.length > 0 && (
        <section className="section-grid">
          <h2>Объявления</h2>
          <div className="ads-grid">
            {profile.ads.map((a) => (
              <Link key={a.id} to={`/ad/${a.id}`} className="ad-card" style={{ textDecoration: "none", color: "inherit" }}>
                {a.image && (
                  <img className="ad-card-img" src={a.image} alt={a.title} loading="lazy" />
                )}
                <div className="ad-card-body">
                  <p className="muted" style={{ fontSize: "0.75rem" }}>{a.category}</p>
                  <p className="ad-card-title">{a.title}</p>
                  <span className="price">{formatPrice(a.price)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      {profile.reviews.length > 0 && (
        <section className="section-grid">
          <h2>Отзывы</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {profile.reviews.map((r, i) => (
              <div key={i} className="review-card">
                <div className="review-head">
                  <strong>{r.clientName}</strong>
                  <StarRating value={r.rating} />
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                <p className="muted">{r.comment}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile.services.length === 0 && profile.ads.length === 0 && profile.reviews.length === 0 && (
        <section className="section-grid">
          <p className="muted">Пользователь пока ничего не публиковал.</p>
        </section>
      )}
    </div>
  );
}
