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
  const location = ad.microrayon || ad.user?.university || ad.university;

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

  const imgSrc = ad.images?.[0] || "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=60";

  return (
    <article
      style={{
        background: "#ffffff",
        border: "1px solid rgba(0,0,0,0.09)",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        cursor: "pointer",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.2s, transform 0.2s",
      }}
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/ad/${ad.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/ad/${ad.id}`); }
      }}
      aria-label={ad.title}
    >
      {/* Image — classic padding-bottom aspect-ratio trick, works everywhere */}
      <div style={{ position: "relative", width: "100%", paddingBottom: "62.5%", overflow: "hidden", background: "#ede9fe" }}>
        <img
          src={imgSrc}
          alt={ad.title}
          loading="lazy"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />

        <button
          style={{
            position: "absolute", top: 10, right: 10,
            background: "#fff", border: "none", borderRadius: "50%",
            width: 34, height: 34,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", padding: 0,
          }}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(ad.id); }}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? t("ad_card.remove_fav") : t("ad_card.add_fav")}
        >
          <svg viewBox="0 0 24 24" width="16" height="16"
            fill={isFavorite ? "#7c3aed" : "none"}
            stroke={isFavorite ? "#7c3aed" : "#888"}
            strokeWidth="2" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 4.01 4 6.5 4c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 17.99 4 20 6.01 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>

        {ad.user?.verified && (
          <span style={{
            position: "absolute", bottom: 8, left: 8,
            background: "#7c3aed", color: "#fff",
            fontSize: "0.68rem", fontWeight: 600,
            padding: "0.15rem 0.6rem", borderRadius: "20px",
          }}>{t("ad_card.verified")}</span>
        )}

        {ad.employmentType && (
          <span style={{
            position: "absolute", top: 8, left: 8,
            background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)",
            color: "#333", fontSize: "0.68rem", fontWeight: 600,
            padding: "0.15rem 0.55rem", borderRadius: "20px",
            border: "1px solid rgba(0,0,0,0.1)",
          }}>
            {ad.employmentType}
          </span>
        )}
      </div>

      <div style={{ padding: "1rem 1.25rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.45rem", flex: 1 }}>
        <span style={{
          display: "inline-block", fontSize: "0.75rem", fontWeight: 500,
          background: "#ede9fe", color: "#5b21b6",
          padding: "3px 10px", borderRadius: "20px", width: "fit-content",
        }}>{ad.category}</span>

        <h3 style={{
          fontSize: "1rem", fontWeight: 500, lineHeight: 1.4, color: "#1c1b1f", margin: 0,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>{ad.title}</h3>

        {ad.experienceLevel && (
          <div style={{ fontSize: "0.75rem", color: "#777" }}>Опыт: {ad.experienceLevel}</div>
        )}

        <div style={{
          marginTop: "auto", paddingTop: "0.625rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: "1px solid rgba(0,0,0,0.07)", flexWrap: "wrap", gap: "0.4rem",
        }}>
          <span style={{ fontSize: "1rem", fontWeight: 700, color: "#7c3aed", letterSpacing: "-0.01em" }}>
            {ad.price > 0 ? `${formatPrice(ad.price)}/мес` : t("ad_card.negotiable")}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {location && (
              <span style={{ fontSize: "0.75rem", color: "#49454f", display: "flex", alignItems: "center", gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
                {location}
              </span>
            )}
            {dateLabel && <span style={{ fontSize: "0.75rem", color: "#49454f" }}>{dateLabel}</span>}
          </div>
        </div>
      </div>
    </article>
  );
}
