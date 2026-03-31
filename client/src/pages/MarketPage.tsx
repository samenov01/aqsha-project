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
  const [showFilters, setShowFilters] = useState(false);
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
        if (err instanceof ApiError && isActive) setError(err.message);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }
    void load();
    return () => { isActive = false; };
  }, [filters]);

  function updateFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value); else next.delete(name);
    setSearchParams(next);
  }

  function resetFilters() {
    setSearchParams(favoritesOnly ? { favorites: "1" } : {});
  }

  function toggleFavoritesMode() {
    const next = new URLSearchParams(searchParams);
    if (favoritesOnly) next.delete("favorites"); else next.set("favorites", "1");
    setSearchParams(next);
  }

  const visibleAds = useMemo(
    () => favoritesOnly ? ads.filter((ad) => favorites.has(ad.id)) : ads,
    [ads, favorites, favoritesOnly]
  );

  const activeFiltersCount = [filters.category, filters.minPrice, filters.maxPrice, filters.sort].filter(Boolean).length;

  return (
    <div className="market-page">

      {/* ── Hero search block ── */}
      <section className="market-hero">
        <p className="market-hero-eyebrow">{t("market.eyebrow")}</p>
        <h1 className="market-hero-title">{t("market.title")}</h1>
        <div className="market-search-wrap">
          <div className="search-bar" role="group" aria-label="Поиск">
            <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7.5" strokeWidth="2" fill="none" />
              <path d="M20 20l-3.6-3.6" strokeWidth="2" fill="none" />
            </svg>
            <input
              className="search-field"
              type="search"
              placeholder={t("market.search.placeholder")}
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
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
      </section>

      {/* ── Filter bar ── */}
      <section className="market-filter-bar">
        {/* Category chips */}
        <div className="market-chips">
          <button
            className={`market-chip ${!filters.category ? "active" : ""}`}
            onClick={() => updateFilter("category", "")}
          >
            Все
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`market-chip ${filters.category === cat ? "active" : ""}`}
              onClick={() => updateFilter("category", filters.category === cat ? "" : cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div className="market-filter-actions">
          <button
            className={`market-chip ${favoritesOnly ? "active" : ""}`}
            onClick={toggleFavoritesMode}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={favoritesOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 4.01 4 6.5 4c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 17.99 4 20 6.01 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            {favoritesOnly ? t("market.show_all") : t("market.only_favorites")}
          </button>
          <button
            className={`market-chip ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
            </svg>
            {t("market.filters.title")}
            {activeFiltersCount > 0 && <span className="chip-badge">{activeFiltersCount}</span>}
          </button>
          {(activeFiltersCount > 0 || filters.search) && (
            <button className="market-chip reset-chip" onClick={resetFilters}>
              {t("market.reset")}
            </button>
          )}
        </div>
      </section>

      {/* ── Expanded filters panel ── */}
      {showFilters && (
        <section className="market-filters-panel">
          <label className="input-wrap">
            <span>{t("market.filters.sort")}</span>
            <select value={filters.sort} onChange={(e) => updateFilter("sort", e.target.value)}>
              <option value="">{t("market.sort.default")}</option>
              <option value="price_asc">{t("market.sort.cheap")}</option>
              <option value="price_desc">{t("market.sort.expensive")}</option>
            </select>
          </label>
          <label className="input-wrap">
            <span>{t("market.filters.price_from")}</span>
            <input type="number" min="0" value={filters.minPrice} onChange={(e) => updateFilter("minPrice", e.target.value)} />
          </label>
          <label className="input-wrap">
            <span>{t("market.filters.price_to")}</span>
            <input type="number" min="0" value={filters.maxPrice} onChange={(e) => updateFilter("maxPrice", e.target.value)} />
          </label>
        </section>
      )}

      {/* ── Results ── */}
      <section className="market-results">
        {!isLoading && !error && (
          <p className="market-results-count">
            {visibleAds.length > 0
              ? `${visibleAds.length} объявлений`
              : favoritesOnly ? t("market.empty.favorites") : t("market.empty.search")}
          </p>
        )}
        {isLoading && <p className="muted">{t("market.loading")}</p>}
        {error && <p className="error-box">{error}</p>}

        <div className="ad-grid">
          {visibleAds.map((ad) => (
            <AdCard key={ad.id} ad={ad} isFavorite={favorites.has(ad.id)} onToggleFavorite={onToggleFavorite} />
          ))}
        </div>
      </section>
    </div>
  );
}
