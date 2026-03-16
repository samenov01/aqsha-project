import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getAds } from "../api/ads";
import { useTranslation } from "../i18n";
import { AdCard } from "../components/common/AdCard";
import type { Ad } from "../types";
import { ApiError } from "../api/client";

type MarketPageProps = {
  categories: string[];
  favorites: Set<number>;
  onToggleFavorite: (id: number) => void;
};

export function MarketPage({ categories, favorites, onToggleFavorite }: MarketPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();
  const favoritesOnly = searchParams.get("favorites") === "1";

  const filters = useMemo(
    () => ({
      search: searchParams.get("search") || "",
      category: searchParams.get("category") || "",
      minPrice: searchParams.get("minPrice") || "",
      maxPrice: searchParams.get("maxPrice") || "",
      sort: searchParams.get("sort") || "",
    }),
    [searchParams]
  );

  useEffect(() => {
    let isActive = true;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const items = await getAds({ ...filters, limit: 36 });
        if (isActive) setAds(items);
      } catch (err: unknown) {
        if (err instanceof ApiError && isActive) {
          setError(err.message);
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [filters]);

  function updateFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(name, value);
    } else {
      next.delete(name);
    }
    setSearchParams(next);
  }

  function resetFilters() {
    setSearchParams(favoritesOnly ? { favorites: "1" } : {});
  }

  function toggleFavoritesMode() {
    const next = new URLSearchParams(searchParams);
    if (favoritesOnly) {
      next.delete("favorites");
    } else {
      next.set("favorites", "1");
    }
    setSearchParams(next);
  }

  const visibleAds = useMemo(() => {
    if (!favoritesOnly) return ads;
    return ads.filter((ad) => favorites.has(ad.id));
  }, [ads, favorites, favoritesOnly]);

  return (
    <div className="page-stack">
      <section className="market-header">
        <div className="section-head-row">
          <div>
            <p className="eyebrow">{t("market.eyebrow")}</p>
            <h1>{t("market.title")}</h1>
          </div>
          <button className="ghost" onClick={resetFilters}>
            {t("market.reset")}
          </button>
        </div>
        <div className="market-switch-row">
          <button className={`ghost small ${favoritesOnly ? "active-chip" : ""}`} onClick={toggleFavoritesMode}>
            {favoritesOnly ? t("market.show_all") : t("market.only_favorites")}
          </button>
        </div>

        <div className="market-block-stack">
          <div className="market-block search-block">
            <div className="search-bar" role="group" aria-label="Поиск и университет">
              <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7.5" strokeWidth="2" fill="none" />
                <path d="M20 20l-3.6-3.6" strokeWidth="2" fill="none" />
              </svg>
              <input
                className="search-field"
                type="search"
                placeholder={t("market.search.placeholder")}
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                aria-label="Поиск"
              />
              <div className="search-divider" aria-hidden="true" />
              <select
                className="search-university-select"
                disabled
                value="Есенов"
                aria-label="Университет"
              >
                <option value="Есенов">Есенов</option>
              </select>
            </div>
          </div>

          <div className="market-block">
            <p className="eyebrow market-block-title">{t("market.filters.title")}</p>
            <div className="filters-grid">
              <label className="input-wrap">
                <span>{t("market.filters.category")}</span>
                <select
                  value={filters.category}
                  onChange={(event) => updateFilter("category", event.target.value)}
                >
                  <option value="">{t("market.filters.all")}</option>
                  {categories.map((category) => (
                    <option value={category} key={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="input-wrap">
                <span>{t("market.filters.sort")}</span>
                <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
                  <option value="">{t("market.sort.default")}</option>
                  <option value="price_asc">{t("market.sort.cheap")}</option>
                  <option value="price_desc">{t("market.sort.expensive")}</option>
                </select>
              </label>

              <label className="input-wrap">
                <span>{t("market.filters.price_from")}</span>
                <input
                  type="number"
                  min="0"
                  value={filters.minPrice}
                  onChange={(event) => updateFilter("minPrice", event.target.value)}
                />
              </label>

              <label className="input-wrap">
                <span>{t("market.filters.price_to")}</span>
                <input
                  type="number"
                  min="0"
                  value={filters.maxPrice}
                  onChange={(event) => updateFilter("maxPrice", event.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="ads-stack">
        {isLoading && <p className="muted">{t("market.loading")}</p>}
        {error && <p className="error-box">{error}</p>}

        {!isLoading && !error && visibleAds.length === 0 && (
          <p className="muted">
            {favoritesOnly ? t("market.empty.favorites") : t("market.empty.search")}
          </p>
        )}

        <div className="ad-grid">
          {visibleAds.map((ad) => (
            <AdCard key={ad.id} ad={ad} isFavorite={favorites.has(ad.id)} onToggleFavorite={onToggleFavorite} />
          ))}
        </div>
      </section>
    </div>
  );
}
