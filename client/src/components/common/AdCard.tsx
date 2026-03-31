import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n";
import type { Ad } from "../../types";
import { formatPrice } from "../../lib/formatters";

type AdCardProps = {
  ad: Ad;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
};

export function AdCard({ ad, isFavorite, onToggleFavorite }: AdCardProps) {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const location = ad.user?.university || ad.university;

  const dateLabel = (() => {
    if (!ad.createdAt) return "";
    const date = new Date(ad.createdAt);
    if (Number.isNaN(date.getTime())) return "";
    const now = new Date();
    const diffH = Math.floor((now.getTime() - date.getTime()) / 3_600_000);
    const diffD = Math.floor(diffH / 24);
    if (diffH < 1) return "только что";
    if (diffH < 24) return `${diffH} ч. назад`;
    if (diffD < 7) return `${diffD} дн. назад`;
    return date.toLocaleDateString(lang === "kk" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "short" });
  })();

  return (
    <article
      className="ad-card"
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/ad/${ad.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/ad/${ad.id}`); }
      }}
      aria-label={ad.title}
    >
      <div className="ad-card-image">
        <img
          src={ad.images?.[0] || "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=60"}
          alt={ad.title}
          loading="lazy"
        />
        <button
          className={`ad-fav-btn ${isFavorite ? "active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(ad.id); }}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? t("ad_card.remove_fav") : t("ad_card.add_fav")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 4.01 4 6.5 4c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 17.99 4 20 6.01 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
        {ad.user?.verified && (
          <span className="ad-verified-overlay">{t("ad_card.verified")}</span>
        )}
      </div>

      <div className="ad-card-content">
        <span className="ad-category-chip">{ad.category}</span>
        <h3 className="ad-card-title">{ad.title}</h3>
        <div className="ad-card-footer">
          <span className="ad-card-price">{formatPrice(ad.price)}</span>
          <div className="ad-card-meta">
            {location && (
              <span className="ad-card-location">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
                {location}
              </span>
            )}
            {dateLabel && <span className="ad-card-date">{dateLabel}</span>}
          </div>
        </div>
      </div>
    </article>
  );
}
