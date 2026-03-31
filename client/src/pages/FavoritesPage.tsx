import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getFavorites, removeFavorite } from "../api/favorites";
import { ApiError } from "../api/client";
import { formatPrice } from "../lib/formatters";
import type { Favorite } from "../types";

type FavoritesPageProps = {
  token: string | null;
};

export function FavoritesPage({ token }: FavoritesPageProps) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getFavorites(token)
      .then(setFavorites)
      .catch((err: unknown) => {
        if (err instanceof ApiError) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleRemove(fav: Favorite) {
    if (!token) return;
    try {
      await removeFavorite(
        fav.adId ? { adId: fav.adId } : { serviceId: fav.serviceId },
        token
      );
      setFavorites((prev) => prev.filter((f) => f.id !== fav.id));
    } catch (_err) {
      // ignore
    }
  }

  if (!token) {
    return (
      <section className="section-grid">
        <p className="error-box">Войдите, чтобы увидеть избранное</p>
        <Link className="primary" to="/profile">
          Войти
        </Link>
      </section>
    );
  }

  return (
    <section className="section-grid">
      <div>
        <p className="eyebrow">Мои закладки</p>
        <h1>Избранное</h1>
      </div>

      {loading && <p className="muted">Загрузка...</p>}
      {error && <p className="error-box">{error}</p>}

      {!loading && favorites.length === 0 && (
        <p className="muted">Вы ещё ничего не добавили в избранное.</p>
      )}

      <div className="ads-grid">
        {favorites.map((fav) => {
          const isAd = Boolean(fav.adId && fav.ad);
          const title = isAd ? fav.ad?.title : fav.service?.title;
          const price = isAd ? fav.ad?.price : fav.service?.price;
          const category = isAd ? fav.ad?.category : fav.service?.category;
          const image = isAd ? fav.ad?.image : fav.service?.image;
          const href = isAd ? `/ad/${fav.adId}` : `/services/${fav.serviceId}`;

          return (
            <div key={fav.id} className="ad-card" style={{ position: "relative" }}>
              {image && (
                <Link to={href}>
                  <img
                    className="ad-card-img"
                    src={image}
                    alt={title}
                    loading="lazy"
                  />
                </Link>
              )}
              <div className="ad-card-body">
                <span className="pill" style={{ fontSize: "0.7rem" }}>
                  {isAd ? "Объявление" : "Услуга"}
                </span>
                <Link to={href} className="ad-card-title">
                  {title}
                </Link>
                <p className="muted" style={{ fontSize: "0.8rem" }}>
                  {category}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                  <span className="price">{formatPrice(price ?? 0)}</span>
                  <button
                    className="ghost"
                    style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}
                    onClick={() => handleRemove(fav)}
                    title="Убрать из избранного"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
