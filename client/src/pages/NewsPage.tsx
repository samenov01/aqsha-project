import { useEffect, useState } from "react";
import { getNews } from "../api/news";
import type { NewsItem } from "../types";
import { ApiError } from "../api/client";

export function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getNews()
      .then(setItems)
      .catch((err: unknown) => {
        if (err instanceof ApiError) setError(err.message);
        else setError("Не удалось загрузить новости");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="section-grid">
      <div>
        <p className="eyebrow">Yessenov University</p>
        <h1>Жаңалықтар</h1>
        <p className="muted">Новости университета с официального сайта yu.edu.kz</p>
      </div>

      {loading && <p className="muted">Загрузка новостей...</p>}
      {error && <p className="error-box">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="muted">Новости временно недоступны. Посетите сайт напрямую: yu.edu.kz</p>
      )}

      <div className="news-list">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="news-card"
          >
            {item.imageUrl && (
              <div className="news-card-image">
                <img src={item.imageUrl} alt={item.title} loading="lazy" />
              </div>
            )}
            <div className="news-card-body">
              <p className="news-card-title">{item.title}</p>
              {item.publishedAt && <p className="muted news-card-date">{item.publishedAt}</p>}
            </div>
          </a>
        ))}
      </div>

      {!loading && (
        <p className="muted" style={{ fontSize: "0.8rem", marginTop: "1rem" }}>
          Источник:{" "}
          <a href="https://yu.edu.kz" target="_blank" rel="noopener noreferrer">
            yu.edu.kz
          </a>
        </p>
      )}
    </section>
  );
}
