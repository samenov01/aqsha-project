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
    const isSameDay = date.toDateString() === now.toDateString();
    if (isSameDay) {
      const time = date.toLocaleTimeString(lang === "kk" ? "kk-KZ" : "ru-RU", { hour: "2-digit", minute: "2-digit" });
      return t("ad_card.today_at", { time });
    }
    return date.toLocaleDateString(lang === "kk" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "long", year: "numeric" });
  })();
  const meta = [location, dateLabel].filter(Boolean).join(" · ");

  function handleOpen() {
    navigate(`/ad/${ad.id}`);
  }

  return (
    <article
      className="ad-card"
      role="link"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpen();
        }
      }}
      aria-label={ad.title}
    >
      <div className="ad-thumb-wrap">
        <img
          className="ad-thumb"
          src={ad.images?.[0] || "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=60"}
          alt={ad.title}
          loading="lazy"
        />
      </div>
      <div className="ad-card-body">
        <div className="ad-card-main">
          <div className="ad-title-link">
            <h3>{ad.title}</h3>
          </div>
          <div className="badge-row">
            <span className="pill">{ad.category}</span>
            {ad.user?.verified && <span className="verified-badge">{t("ad_card.verified")}</span>}
          </div>
        </div>
        {meta && <p className="muted ad-meta">{meta}</p>}
      </div>
      <div className="ad-card-aside">
        <span className="price">{formatPrice(ad.price)}</span>
        <button
          className={`fav-icon ${isFavorite ? "active" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(ad.id);
          }}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? t("ad_card.remove_fav") : t("ad_card.add_fav")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 4.01 4 6.5 4c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 17.99 4 20 6.01 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
      </div>
    </article>
  );
}
